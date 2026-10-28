import { supabaseAdmin, SUPABASE_BUCKET } from './supabase';

// ---------------------------------------------------------------------------
// Types & Sentinels
// ---------------------------------------------------------------------------

export interface CollectionRef {
  __type: 'collection';
  name: string;
}

export interface DocRef {
  __type: 'doc';
  collectionName: string;
  id: string;
}

export interface QueryConstraint {
  __type: 'where' | 'orderBy' | 'limit';
  field?: string;
  op?: string;
  value?: any;
  direction?: 'asc' | 'desc';
  limitCount?: number;
}

export interface QueryRef {
  __type: 'query';
  collectionName: string;
  constraints: QueryConstraint[];
}

export function serverTimestamp() {
  return { __type: 'serverTimestamp' };
}

export function increment(delta: number) {
  return { __type: 'increment', delta };
}

export function getFirestore(_app?: any) {
  return { __type: 'supabase_db' };
}

// ---------------------------------------------------------------------------
// In-Memory + Supabase Cloud Storage & PostgreSQL Sync Engine
// ---------------------------------------------------------------------------

const memoryStore = new Map<string, Map<string, Record<string, any>>>();
const loadedCollections = new Set<string>();
const loadingPromises = new Map<string, Promise<Map<string, Record<string, any>>>>();
const listeners = new Map<string, Set<() => void>>();
const pgTableStatus = new Map<string, boolean>(); // true if SQL table exists, false if not yet created

function getLocalCacheKey(colName: string): string {
  return `sb_col_cache_v1_${colName}`;
}

function getCollectionMapSync(colName: string): Map<string, Record<string, any>> {
  if (!memoryStore.has(colName)) {
    const map = new Map<string, Record<string, any>>();
    try {
      const raw = localStorage.getItem(getLocalCacheKey(colName));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          for (const [k, v] of Object.entries(parsed)) {
            map.set(k, reviveDates(v as Record<string, any>));
          }
        }
      }
    } catch {
      // ignore localStorage read errors
    }
    memoryStore.set(colName, map);
  }
  return memoryStore.get(colName)!;
}

function saveLocalCache(colName: string, map: Map<string, Record<string, any>>) {
  try {
    const obj: Record<string, any> = {};
    for (const [k, v] of map.entries()) {
      obj[k] = serializeDates(v);
    }
    localStorage.setItem(getLocalCacheKey(colName), JSON.stringify(obj));
  } catch {
    // ignore quota errors
  }
}

function serializeDates(val: any): any {
  if (val === null || val === undefined) return val;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? new Date().toISOString() : val.toISOString();
  }
  if (Array.isArray(val)) {
    return val.map(serializeDates);
  }
  if (typeof val === 'object') {
    if (val.__type === 'serverTimestamp') {
      return new Date().toISOString();
    }
    if (typeof val.toDate === 'function') {
      return val.toDate().toISOString();
    }
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = serializeDates(v);
    }
    return out;
  }
  return val;
}

function reviveDates(val: any): any {
  if (!val || typeof val !== 'object') return val;
  if (Array.isArray(val)) return val.map(reviveDates);
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(val)) {
    if (
      typeof v === 'string' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v) &&
      (k.toLowerCase().includes('date') || k.toLowerCase().includes('at'))
    ) {
      out[k] = v;
    } else if (v && typeof v === 'object') {
      out[k] = reviveDates(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

async function ensureCollectionLoaded(colName: string): Promise<Map<string, Record<string, any>>> {
  const map = getCollectionMapSync(colName);
  if (loadedCollections.has(colName)) {
    return map;
  }
  if (loadingPromises.has(colName)) {
    return loadingPromises.get(colName)!;
  }

  const promise = (async () => {
    try {
      // 1. Try loading from PostgreSQL table if not known to be absent
      if (pgTableStatus.get(colName) !== false) {
        const { data: rows, error: pgErr } = await supabaseAdmin
          .from(colName)
          .select('id, shop_id, user_id, user_email, data, created_at, updated_at');

        if (!pgErr && Array.isArray(rows)) {
          pgTableStatus.set(colName, true);
          if (rows.length > 0) {
            map.clear();
            for (const row of rows) {
              const docData = {
                ...(row.data || {}),
                ...(row.shop_id ? { shopId: row.shop_id } : {}),
                ...(row.user_id ? { userId: row.user_id } : {}),
                ...(row.user_email ? { userEmail: row.user_email } : {}),
              };
              map.set(String(row.id), reviveDates(docData));
            }
            saveLocalCache(colName, map);
            loadedCollections.add(colName);
            return map;
          }
        } else if (pgErr) {
          pgTableStatus.set(colName, false);
        }
      }

      // 2. Load from Supabase Storage bucket (`shop-assets/_db/{colName}.json`)
      const { data: blob, error: stErr } = await supabaseAdmin.storage
        .from(SUPABASE_BUCKET)
        .download(`_db/${colName}.json`);

      if (!stErr && blob) {
        const text = await blob.text();
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object') {
          map.clear();
          for (const [docId, docData] of Object.entries(parsed)) {
            map.set(docId, reviveDates(docData as Record<string, any>));
          }
          saveLocalCache(colName, map);
        }
      }
    } catch (err) {
      console.warn(`Supabase load notice for ${colName}:`, err);
    } finally {
      loadedCollections.add(colName);
      loadingPromises.delete(colName);
    }
    return map;
  })();

  loadingPromises.set(colName, promise);
  return promise;
}

const pendingPersistTimers = new Map<string, any>();

function schedulePersistCollection(colName: string) {
  const map = getCollectionMapSync(colName);
  saveLocalCache(colName, map);

  if (pendingPersistTimers.has(colName)) {
    clearTimeout(pendingPersistTimers.get(colName));
  }

  const timer = setTimeout(async () => {
    pendingPersistTimers.delete(colName);
    await persistCollectionToSupabase(colName, map);
  }, 120);

  pendingPersistTimers.set(colName, timer);
}

async function persistCollectionToSupabase(
  colName: string,
  map: Map<string, Record<string, any>>
) {
  try {
    const plainObj: Record<string, any> = {};
    const byEmail: Record<string, Record<string, any>> = {};

    for (const [docId, docData] of map.entries()) {
      const clean = serializeDates(docData);
      plainObj[docId] = clean;

      const email = String(
        clean.userEmail || clean.ownerEmail || clean.email || ''
      )
        .toLowerCase()
        .trim();
      if (email && email.includes('@')) {
        if (!byEmail[email]) byEmail[email] = {};
        byEmail[email][docId] = clean;
      }
    }

    // 1. Save master collection JSON to Supabase Storage (`_db/{colName}.json`)
    const jsonBytes = new Blob([JSON.stringify(plainObj, null, 2)], {
      type: 'application/json',
    });
    await supabaseAdmin.storage
      .from(SUPABASE_BUCKET)
      .upload(`_db/${colName}.json`, jsonBytes, {
        upsert: true,
        contentType: 'application/json',
      });

    // 2. Also save per-email readable files in `shops/{email}/{colName}.json`
    // so the admin can browse every email's exact data inside Supabase Storage!
    for (const [email, docsForEmail] of Object.entries(byEmail)) {
      const emailBlob = new Blob([JSON.stringify(docsForEmail, null, 2)], {
        type: 'application/json',
      });
      await supabaseAdmin.storage
        .from(SUPABASE_BUCKET)
        .upload(`shops/${email}/${colName}.json`, emailBlob, {
          upsert: true,
          contentType: 'application/json',
        })
        .catch(() => {});
    }

    // 3. If PostgreSQL table exists, also upsert rows into PostgreSQL Table Editor
    if (pgTableStatus.get(colName) !== false) {
      const rows = Array.from(map.entries()).map(([docId, docData]) => {
        const clean = serializeDates(docData);
        return {
          id: docId,
          shop_id: clean.shopId || null,
          user_id: clean.userId || clean.ownerUid || clean.uid || null,
          user_email: clean.userEmail || clean.ownerEmail || clean.email || null,
          data: clean,
          updated_at: new Date().toISOString(),
        };
      });

      if (rows.length > 0) {
        const { error: pgErr } = await supabaseAdmin
          .from(colName)
          .upsert(rows, { onConflict: 'id' });
        if (pgErr) {
          pgTableStatus.set(colName, false);
        } else {
          pgTableStatus.set(colName, true);
        }
      }
    }
  } catch (err) {
    console.warn(`Supabase persist notice for ${colName}:`, err);
  }
}

function notifyCollectionListeners(colName: string) {
  const subs = listeners.get(colName);
  if (!subs) return;
  for (const cb of Array.from(subs)) {
    try {
      cb();
    } catch (e) {
      console.error('Snapshot listener error:', e);
    }
  }
}

// ---------------------------------------------------------------------------
// Document Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 20; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function applyFieldMutations(
  existing: Record<string, any> | undefined,
  incoming: Record<string, any>,
  merge: boolean
): Record<string, any> {
  const base = merge && existing ? { ...existing } : {};
  for (const [k, v] of Object.entries(incoming)) {
    if (v && typeof v === 'object' && v.__type === 'serverTimestamp') {
      base[k] = new Date().toISOString();
    } else if (v && typeof v === 'object' && v.__type === 'increment') {
      const currentVal = Number(base[k]) || 0;
      base[k] = currentVal + (Number(v.delta) || 0);
    } else if (v instanceof Date) {
      base[k] = isNaN(v.getTime()) ? new Date().toISOString() : v.toISOString();
    } else if (v !== undefined) {
      base[k] = v;
    }
  }
  return base;
}

function createDocSnapshot(id: string, data: Record<string, any> | undefined) {
  return {
    id,
    exists: () => Boolean(data),
    data: () => (data ? { ...data } : undefined),
  };
}

function evaluateQuery(
  map: Map<string, Record<string, any>>,
  constraints: QueryConstraint[]
) {
  let entries = Array.from(map.entries()).map(([id, data]) => ({
    id,
    data: { ...data },
  }));

  // 1. Apply where filters
  for (const c of constraints) {
    if (c.__type === 'where' && c.field) {
      const f = c.field;
      const op = c.op;
      const val = c.value;
      entries = entries.filter((item) => {
        const itemVal = item.data[f];
        if (op === '==') return itemVal === val;
        if (op === '!=') return itemVal !== val;
        if (op === '>') return itemVal > val;
        if (op === '>=') return itemVal >= val;
        if (op === '<') return itemVal < val;
        if (op === '<=') return itemVal <= val;
        if (op === 'in' && Array.isArray(val)) return val.includes(itemVal);
        if (op === 'array-contains' && Array.isArray(itemVal)) return itemVal.includes(val);
        return true;
      });
    }
  }

  // 2. Apply orderBy
  const orderConstraints = constraints.filter((c) => c.__type === 'orderBy' && c.field);
  if (orderConstraints.length > 0) {
    entries.sort((a, b) => {
      for (const oc of orderConstraints) {
        const f = oc.field!;
        const dir = oc.direction === 'desc' ? -1 : 1;
        const va = a.data[f];
        const vb = b.data[f];
        if (va === vb) continue;
        const da = typeof va === 'string' && !isNaN(Date.parse(va)) ? Date.parse(va) : va;
        const db = typeof vb === 'string' && !isNaN(Date.parse(vb)) ? Date.parse(vb) : vb;
        if (da > db) return 1 * dir;
        if (da < db) return -1 * dir;
      }
      return 0;
    });
  }

  // 3. Apply limit
  const limitConstraint = constraints.find((c) => c.__type === 'limit');
  if (limitConstraint && typeof limitConstraint.limitCount === 'number') {
    entries = entries.slice(0, limitConstraint.limitCount);
  }

  const docs = entries.map((e) => ({
    id: e.id,
    exists: () => true,
    data: () => ({ ...e.data }),
  }));

  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (cb: (d: (typeof docs)[0]) => void) => {
      docs.forEach(cb);
    },
  };
}

// ---------------------------------------------------------------------------
// Public Firestore-Compatible API Backed by Supabase
// ---------------------------------------------------------------------------

export function collection(_dbOrRef: any, name: string): CollectionRef {
  return { __type: 'collection', name };
}

export function doc(first: any, second?: string, third?: string): DocRef {
  if (first && first.__type === 'collection') {
    return {
      __type: 'doc',
      collectionName: first.name,
      id: second || generateId(),
    };
  }
  return {
    __type: 'doc',
    collectionName: second || 'default',
    id: third || generateId(),
  };
}

export function where(field: string, op: string, value: any): QueryConstraint {
  return { __type: 'where', field, op, value };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): QueryConstraint {
  return { __type: 'orderBy', field, direction };
}

export function limit(limitCount: number): QueryConstraint {
  return { __type: 'limit', limitCount };
}

export function query(
  colOrQuery: CollectionRef | QueryRef,
  ...constraints: QueryConstraint[]
): QueryRef {
  if (colOrQuery.__type === 'query') {
    return {
      __type: 'query',
      collectionName: colOrQuery.collectionName,
      constraints: [...colOrQuery.constraints, ...constraints],
    };
  }
  return {
    __type: 'query',
    collectionName: colOrQuery.name,
    constraints,
  };
}

export async function getDoc(docRef: DocRef) {
  const map = await ensureCollectionLoaded(docRef.collectionName);
  const data = map.get(docRef.id);
  return createDocSnapshot(docRef.id, data);
}

export async function getDocs(colOrQuery: CollectionRef | QueryRef) {
  const colName =
    colOrQuery.__type === 'collection' ? colOrQuery.name : colOrQuery.collectionName;
  const constraints = colOrQuery.__type === 'query' ? colOrQuery.constraints : [];
  const map = await ensureCollectionLoaded(colName);
  return evaluateQuery(map, constraints);
}

export async function setDoc(
  docRef: DocRef,
  data: Record<string, any>,
  options?: { merge?: boolean }
) {
  const map = await ensureCollectionLoaded(docRef.collectionName);
  const existing = map.get(docRef.id);
  const updated = applyFieldMutations(existing, data, Boolean(options?.merge));
  map.set(docRef.id, updated);
  notifyCollectionListeners(docRef.collectionName);
  schedulePersistCollection(docRef.collectionName);
}

export async function addDoc(colRef: CollectionRef, data: Record<string, any>): Promise<DocRef> {
  const map = await ensureCollectionLoaded(colRef.name);
  const newId = generateId();
  const updated = applyFieldMutations(undefined, data, false);
  map.set(newId, updated);
  notifyCollectionListeners(colRef.name);
  schedulePersistCollection(colRef.name);
  return { __type: 'doc', collectionName: colRef.name, id: newId };
}

export async function updateDoc(docRef: DocRef, data: Record<string, any>) {
  const map = await ensureCollectionLoaded(docRef.collectionName);
  const existing = map.get(docRef.id) || {};
  const updated = applyFieldMutations(existing, data, true);
  map.set(docRef.id, updated);
  notifyCollectionListeners(docRef.collectionName);
  schedulePersistCollection(docRef.collectionName);
}

export async function deleteDoc(docRef: DocRef) {
  const map = await ensureCollectionLoaded(docRef.collectionName);
  map.delete(docRef.id);
  notifyCollectionListeners(docRef.collectionName);
  schedulePersistCollection(docRef.collectionName);

  if (pgTableStatus.get(docRef.collectionName) === true) {
    supabaseAdmin
      .from(docRef.collectionName)
      .delete()
      .eq('id', docRef.id)
      .then(() => {});
  }
}

export function onSnapshot(
  target: CollectionRef | QueryRef | DocRef,
  onNext: (snap: any) => void,
  onError?: (err: any) => void
) {
  if (target.__type === 'doc') {
    const colName = target.collectionName;
    const emit = () => {
      const map = getCollectionMapSync(colName);
      onNext(createDocSnapshot(target.id, map.get(target.id)));
    };
    if (!listeners.has(colName)) listeners.set(colName, new Set());
    listeners.get(colName)!.add(emit);

    ensureCollectionLoaded(colName)
      .then(emit)
      .catch((err) => onError?.(err));

    return () => {
      listeners.get(colName)?.delete(emit);
    };
  }

  const colName = target.__type === 'collection' ? target.name : target.collectionName;
  const constraints = target.__type === 'query' ? target.constraints : [];

  const emit = () => {
    const map = getCollectionMapSync(colName);
    const snap = evaluateQuery(map, constraints);
    onNext(snap);
  };

  if (!listeners.has(colName)) listeners.set(colName, new Set());
  listeners.get(colName)!.add(emit);

  ensureCollectionLoaded(colName)
    .then(emit)
    .catch((err) => onError?.(err));

  return () => {
    listeners.get(colName)?.delete(emit);
  };
}

export function writeBatch(_db?: any) {
  const ops: Array<() => Promise<void>> = [];
  const touchedCollections = new Set<string>();

  return {
    set(docRef: DocRef, data: Record<string, any>, options?: { merge?: boolean }) {
      ops.push(async () => {
        const map = await ensureCollectionLoaded(docRef.collectionName);
        const existing = map.get(docRef.id);
        const updated = applyFieldMutations(existing, data, Boolean(options?.merge));
        map.set(docRef.id, updated);
        touchedCollections.add(docRef.collectionName);
      });
    },
    update(docRef: DocRef, data: Record<string, any>) {
      ops.push(async () => {
        const map = await ensureCollectionLoaded(docRef.collectionName);
        const existing = map.get(docRef.id) || {};
        const updated = applyFieldMutations(existing, data, true);
        map.set(docRef.id, updated);
        touchedCollections.add(docRef.collectionName);
      });
    },
    delete(docRef: DocRef) {
      ops.push(async () => {
        const map = await ensureCollectionLoaded(docRef.collectionName);
        map.delete(docRef.id);
        touchedCollections.add(docRef.collectionName);
        if (pgTableStatus.get(docRef.collectionName) === true) {
          supabaseAdmin
            .from(docRef.collectionName)
            .delete()
            .eq('id', docRef.id)
            .then(() => {});
        }
      });
    },
    async commit() {
      for (const op of ops) {
        await op();
      }
      for (const colName of touchedCollections) {
        notifyCollectionListeners(colName);
        schedulePersistCollection(colName);
      }
    },
  };
}

/**
 * Completely deletes all shop data (mobiles, sales, bills, khata, khataTransactions,
 * expenses, backups, users, shops) and per-email storage files associated with a deleted account.
 */
export async function purgeAllShopDataForAccount(
  email?: string,
  uid?: string,
  shopId?: string
): Promise<void> {
  const cleanEmail = (email || '').toLowerCase().trim();
  const derivedShopId = shopId || (uid ? `shop_${uid.slice(0, 8)}` : '');
  const dataCollections = [
    'mobiles',
    'sales',
    'bills',
    'khata',
    'khataTransactions',
    'expenses',
    'backups',
  ];

  for (const colName of dataCollections) {
    try {
      const map = await ensureCollectionLoaded(colName);
      let changed = false;

      for (const [docId, docData] of Array.from(map.entries())) {
        const docEmail = String(
          docData?.userEmail || docData?.ownerEmail || docData?.email || ''
        )
          .toLowerCase()
          .trim();
        const matchesEmail = cleanEmail && docEmail === cleanEmail;
        const matchesUid = uid && (docData?.userId === uid || docData?.ownerUid === uid || docId === uid);
        const matchesShopId = derivedShopId && docData?.shopId === derivedShopId;

        if (matchesEmail || matchesUid || matchesShopId) {
          map.delete(docId);
          changed = true;
          if (pgTableStatus.get(colName) === true) {
            supabaseAdmin.from(colName).delete().eq('id', docId).then(() => {});
          }
        }
      }

      if (changed) {
        notifyCollectionListeners(colName);
        schedulePersistCollection(colName);
      }
    } catch (e) {
      // ignore individual collection errors
    }
  }

  // Also remove the per-email folder files inside `shop-assets/shops/{email}/`
  if (cleanEmail) {
    const safeEmail = cleanEmail.replace(/[^a-z0-9@._-]/g, '_');
    const pathsToRemove = [
      ...dataCollections.map((c) => `shops/${safeEmail}/${c}.json`),
      `shops/${safeEmail}/users.json`,
      `shops/${safeEmail}/shops.json`,
    ];
    try {
      await supabaseAdmin.storage.from(SUPABASE_BUCKET).remove(pathsToRemove);
    } catch {
      // ignore storage cleanup warning
    }
  }
}


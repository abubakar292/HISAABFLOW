import {
  supabase,
  supabaseAdmin,
  SUPABASE_BUCKET,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} from './supabase';
import { pinLockService } from '../utils/pinLockService';

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
// Real-Time Cross-Device Sync + In-Memory + Supabase Storage Engine
// ---------------------------------------------------------------------------

const CLIENT_INSTANCE_ID = `inst_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const memoryStore = new Map<string, Map<string, Record<string, any>>>();
const loadedCollections = new Set<string>();
const loadingPromises = new Map<string, Promise<Map<string, Record<string, any>>>>();
const listeners = new Map<string, Set<() => void>>();
const pgTableStatus = new Map<string, boolean>();

// Track local unsaved mutations per collection so remote merges never overwrite in-flight local edits
const dirtyDocs = new Map<string, Map<string, Record<string, any>>>();
const deletedDocIds = new Map<string, Set<string>>();
const lastRemoteJsonHash = new Map<string, string>();

// Account termination callbacks (for instant real-time kick-out on delete/suspend)
type AccountTerminationPayload = {
  email?: string;
  uid?: string;
  shopId?: string;
  reason?: 'deleted' | 'suspended';
};
const accountTerminationSubscribers = new Set<(payload: AccountTerminationPayload) => void>();

export function onAccountTerminated(
  cb: (payload: AccountTerminationPayload) => void
): () => void {
  accountTerminationSubscribers.add(cb);
  return () => {
    accountTerminationSubscribers.delete(cb);
  };
}

function getDirtyMap(colName: string): Map<string, Record<string, any>> {
  if (!dirtyDocs.has(colName)) {
    dirtyDocs.set(colName, new Map());
  }
  return dirtyDocs.get(colName)!;
}

function getDeletedSet(colName: string): Set<string> {
  if (!deletedDocIds.has(colName)) {
    deletedDocIds.set(colName, new Set());
  }
  return deletedDocIds.get(colName)!;
}

function markDocDirty(colName: string, docId: string, data: Record<string, any>) {
  getDirtyMap(colName).set(docId, { ...data });
  getDeletedSet(colName).delete(docId);
}

function markDocDeleted(colName: string, docId: string) {
  getDirtyMap(colName).delete(docId);
  getDeletedSet(colName).add(docId);
}

function getLocalCacheKey(colName: string): string {
  return `sb_col_cache_v1_${colName}`;
}

export function clearAllLocalDbCaches() {
  try {
    const cols = [
      'users',
      'shops',
      'mobiles',
      'sales',
      'bills',
      'expenses',
      'khata',
      'khataTransactions',
      'purchases',
      'backups',
    ];
    for (const c of cols) {
      localStorage.removeItem(getLocalCacheKey(c));
    }
  } catch {
    // ignore
  }
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

// ---------------------------------------------------------------------------
// Cache-Busted Remote Storage Fetch (Prevents Stale Browser/CDN Responses)
// ---------------------------------------------------------------------------

async function downloadRemoteCollectionJson(
  colName: string
): Promise<Record<string, Record<string, any>> | null> {
  try {
    const url = `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/_db/${colName}.json?t=${Date.now()}&r=${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
      cache: 'no-store',
    });

    if (res.ok) {
      const text = await res.text();
      if (text && text.trim().length > 0) {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    }
  } catch {
    // Fallback to SDK download if direct fetch had a network hiccup
  }

  try {
    const { data: blob, error: stErr } = await supabaseAdmin.storage
      .from(SUPABASE_BUCKET)
      .download(`_db/${colName}.json`);
    if (!stErr && blob) {
      const text = await blob.text();
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch {
    // ignore
  }

  return null;
}

// ---------------------------------------------------------------------------
// Supabase Realtime Broadcast Channel (Instant <100ms Cross-Device Sync)
// ---------------------------------------------------------------------------

let syncChannel: ReturnType<typeof supabase.channel> | null = null;

function initRealtimeSyncChannel() {
  if (typeof window === 'undefined' || syncChannel) return;

  try {
    syncChannel = supabase.channel('hf_global_sync_v1', {
      config: {
        broadcast: { self: false },
      },
    });

    syncChannel
      .on('broadcast', { event: 'doc_mutation' }, ({ payload }) => {
        if (!payload || payload.senderId === CLIENT_INSTANCE_ID) return;
        const { colName, upserts, deletes } = payload;
        if (!colName) return;

        const map = getCollectionMapSync(colName);
        let changed = false;

        if (upserts && typeof upserts === 'object') {
          for (const [docId, docData] of Object.entries(upserts)) {
            map.set(docId, reviveDates(docData as Record<string, any>));
            changed = true;
          }
        }

        if (Array.isArray(deletes)) {
          for (const docId of deletes) {
            if (map.has(docId)) {
              map.delete(docId);
              changed = true;
            }
          }
        }

        if (changed) {
          saveLocalCache(colName, map);
          notifyCollectionListeners(colName);
        }
      })
      .on('broadcast', { event: 'collection_persisted' }, ({ payload }) => {
        if (!payload || payload.senderId === CLIENT_INSTANCE_ID) return;
        const { colName } = payload;
        if (colName) {
          refreshCollectionFromRemote(colName).catch(() => {});
        }
      })
      .on('broadcast', { event: 'account_terminated' }, ({ payload }) => {
        if (!payload) return;
        for (const cb of Array.from(accountTerminationSubscribers)) {
          try {
            cb(payload);
          } catch (e) {
            console.error('Account termination listener error:', e);
          }
        }
      })
      .subscribe();
  } catch (err) {
    console.warn('Realtime channel init notice:', err);
  }
}

function broadcastDocMutation(
  colName: string,
  upserts?: Record<string, Record<string, any>>,
  deletes?: string[]
) {
  initRealtimeSyncChannel();
  if (!syncChannel) return;
  try {
    syncChannel
      .send({
        type: 'broadcast',
        event: 'doc_mutation',
        payload: {
          senderId: CLIENT_INSTANCE_ID,
          colName,
          upserts: upserts ? serializeDates(upserts) : undefined,
          deletes,
          ts: Date.now(),
        },
      })
      .catch(() => {});
  } catch {
    // ignore
  }
}

function broadcastCollectionPersisted(colName: string) {
  initRealtimeSyncChannel();
  if (!syncChannel) return;
  try {
    syncChannel
      .send({
        type: 'broadcast',
        event: 'collection_persisted',
        payload: {
          senderId: CLIENT_INSTANCE_ID,
          colName,
          ts: Date.now(),
        },
      })
      .catch(() => {});
  } catch {
    // ignore
  }
}

export function broadcastAccountTermination(payload: AccountTerminationPayload) {
  initRealtimeSyncChannel();
  for (const cb of Array.from(accountTerminationSubscribers)) {
    try {
      cb(payload);
    } catch {}
  }
  if (!syncChannel) return;
  try {
    syncChannel
      .send({
        type: 'broadcast',
        event: 'account_terminated',
        payload: {
          ...payload,
          senderId: CLIENT_INSTANCE_ID,
          ts: Date.now(),
        },
      })
      .catch(() => {});
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Remote Collection Loading & Live Refresh
// ---------------------------------------------------------------------------

export async function refreshCollectionFromRemote(colName: string): Promise<boolean> {
  try {
    const parsed = await downloadRemoteCollectionJson(colName);
    if (!parsed) return false;

    const map = getCollectionMapSync(colName);
    const dirty = getDirtyMap(colName);
    const deleted = getDeletedSet(colName);

    // Build merged map: remote truth + any in-flight local dirty/deleted docs
    const nextMap = new Map<string, Record<string, any>>();
    for (const [docId, docData] of Object.entries(parsed)) {
      if (!deleted.has(docId)) {
        nextMap.set(docId, reviveDates(docData as Record<string, any>));
      }
    }
    for (const [docId, docData] of dirty.entries()) {
      nextMap.set(docId, reviveDates(docData));
    }

    // Check if content meaningfully changed compared to current memory map
    const currentSnapshotObj: Record<string, any> = {};
    for (const [k, v] of map.entries()) currentSnapshotObj[k] = serializeDates(v);
    const nextSnapshotObj: Record<string, any> = {};
    for (const [k, v] of nextMap.entries()) nextSnapshotObj[k] = serializeDates(v);

    const currentJson = JSON.stringify(currentSnapshotObj);
    const nextJson = JSON.stringify(nextSnapshotObj);

    if (currentJson !== nextJson) {
      map.clear();
      for (const [k, v] of nextMap.entries()) {
        map.set(k, v);
      }
      lastRemoteJsonHash.set(colName, nextJson);
      saveLocalCache(colName, map);
      notifyCollectionListeners(colName);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function refreshAllCollectionsNow(): Promise<void> {
  const activeCols = new Set<string>([
    ...Array.from(listeners.keys()),
    'users',
    'shops',
  ]);
  await Promise.all(
    Array.from(activeCols).map((colName) => refreshCollectionFromRemote(colName))
  );
}

// Start background sync loop & window focus listeners in browser
if (typeof window !== 'undefined') {
  initRealtimeSyncChannel();

  // Poll active collections every 3 seconds so Mobile & Laptop stay 100% synced even across network switches
  setInterval(() => {
    if (document.visibilityState === 'visible') {
      refreshAllCollectionsNow().catch(() => {});
    }
  }, 3000);

  window.addEventListener('focus', () => {
    refreshAllCollectionsNow().catch(() => {});
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      refreshAllCollectionsNow().catch(() => {});
    }
  });

  window.addEventListener('online', () => {
    refreshAllCollectionsNow().catch(() => {});
  });
}

async function ensureCollectionLoaded(colName: string): Promise<Map<string, Record<string, any>>> {
  initRealtimeSyncChannel();
  const map = getCollectionMapSync(colName);
  if (loadedCollections.has(colName)) {
    return map;
  }
  if (loadingPromises.has(colName)) {
    return loadingPromises.get(colName)!;
  }

  const promise = (async () => {
    try {
      // 1. Primary canonical load from Supabase Storage (`_db/${colName}.json`) with cache-busting
      const parsed = await downloadRemoteCollectionJson(colName);
      if (parsed && typeof parsed === 'object') {
        const dirty = getDirtyMap(colName);
        const deleted = getDeletedSet(colName);

        map.clear();
        for (const [docId, docData] of Object.entries(parsed)) {
          if (!deleted.has(docId)) {
            map.set(docId, reviveDates(docData as Record<string, any>));
          }
        }
        for (const [docId, docData] of dirty.entries()) {
          map.set(docId, reviveDates(docData));
        }

        saveLocalCache(colName, map);
        loadedCollections.add(colName);
        return map;
      }

      // 2. Fallback: Try loading from PostgreSQL table if Storage file doesn't exist yet
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
    if (
      typeof window !== 'undefined' &&
      ['mobiles', 'sales', 'bills', 'expenses', 'khata', 'khataTransactions'].includes(colName)
    ) {
      window.dispatchEvent(
        new CustomEvent('hisaabflow_shop_data_changed', { detail: { collection: colName } })
      );
    }
  }, 80);

  pendingPersistTimers.set(colName, timer);
}

async function persistCollectionToSupabase(
  colName: string,
  map: Map<string, Record<string, any>>
) {
  // Snapshot current dirty & deleted sets that we are committing right now
  const dirty = getDirtyMap(colName);
  const deleted = getDeletedSet(colName);
  const committedDirty = new Map(dirty);
  const committedDeleted = new Set(deleted);

  try {
    // 1. Fetch latest remote collection first so we NEVER overwrite changes made on another device!
    const remoteParsed = await downloadRemoteCollectionJson(colName);
    if (remoteParsed && typeof remoteParsed === 'object') {
      // Merge remote docs into our map unless they were modified or deleted locally
      for (const [docId, remoteDoc] of Object.entries(remoteParsed)) {
        if (!committedDeleted.has(docId) && !committedDirty.has(docId) && !dirty.has(docId)) {
          map.set(docId, reviveDates(remoteDoc as Record<string, any>));
        }
      }
      // Ensure all committed dirty docs are applied and deleted docs are removed
      for (const [docId, dirtyDoc] of committedDirty.entries()) {
        if (!deleted.has(docId)) {
          map.set(docId, reviveDates(dirtyDoc));
        }
      }
      for (const docId of committedDeleted.values()) {
        if (!dirty.has(docId)) {
          map.delete(docId);
        }
      }
      saveLocalCache(colName, map);
    }

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

    // Clear the dirty/deleted entries that were included in this persist
    for (const [docId] of committedDirty.entries()) {
      dirty.delete(docId);
    }
    for (const docId of committedDeleted.values()) {
      deleted.delete(docId);
    }

    // 2. Upload merged master collection JSON to Supabase Storage (`_db/{colName}.json`)
    const serializedMaster = JSON.stringify(plainObj, null, 2);
    lastRemoteJsonHash.set(colName, JSON.stringify(plainObj));
    const jsonBytes = new Blob([serializedMaster], {
      type: 'application/json',
    });
    await supabaseAdmin.storage
      .from(SUPABASE_BUCKET)
      .upload(`_db/${colName}.json`, jsonBytes, {
        upsert: true,
        contentType: 'application/json',
        cacheControl: '0',
      });

    // Notify all other connected devices that remote storage is updated
    broadcastCollectionPersisted(colName);

    // 3. Also save per-email readable files in `shops/{email}/{colName}.json`
    for (const [email, docsForEmail] of Object.entries(byEmail)) {
      const emailBlob = new Blob([JSON.stringify(docsForEmail, null, 2)], {
        type: 'application/json',
      });
      await supabaseAdmin.storage
        .from(SUPABASE_BUCKET)
        .upload(`shops/${email}/${colName}.json`, emailBlob, {
          upsert: true,
          contentType: 'application/json',
          cacheControl: '0',
        })
        .catch(() => {});
    }

    // 4. Mirror to PostgreSQL Table Editor if table exists
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
  markDocDirty(docRef.collectionName, docRef.id, updated);
  notifyCollectionListeners(docRef.collectionName);
  broadcastDocMutation(docRef.collectionName, { [docRef.id]: updated });
  schedulePersistCollection(docRef.collectionName);
}

export async function addDoc(colRef: CollectionRef, data: Record<string, any>): Promise<DocRef> {
  const map = await ensureCollectionLoaded(colRef.name);
  const newId = generateId();
  const updated = applyFieldMutations(undefined, data, false);
  map.set(newId, updated);
  markDocDirty(colRef.name, newId, updated);
  notifyCollectionListeners(colRef.name);
  broadcastDocMutation(colRef.name, { [newId]: updated });
  schedulePersistCollection(colRef.name);
  return { __type: 'doc', collectionName: colRef.name, id: newId };
}

export async function updateDoc(docRef: DocRef, data: Record<string, any>) {
  const map = await ensureCollectionLoaded(docRef.collectionName);
  const existing = map.get(docRef.id) || {};
  const updated = applyFieldMutations(existing, data, true);
  map.set(docRef.id, updated);
  markDocDirty(docRef.collectionName, docRef.id, updated);
  notifyCollectionListeners(docRef.collectionName);
  broadcastDocMutation(docRef.collectionName, { [docRef.id]: updated });
  schedulePersistCollection(docRef.collectionName);
}

export async function deleteDoc(docRef: DocRef) {
  const map = await ensureCollectionLoaded(docRef.collectionName);
  map.delete(docRef.id);
  markDocDeleted(docRef.collectionName, docRef.id);
  notifyCollectionListeners(docRef.collectionName);
  broadcastDocMutation(docRef.collectionName, undefined, [docRef.id]);
  schedulePersistCollection(docRef.collectionName);

  if (pgTableStatus.get(docRef.collectionName) !== false) {
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
  initRealtimeSyncChannel();

  if (target.__type === 'doc') {
    const colName = target.collectionName;
    const emit = () => {
      const map = getCollectionMapSync(colName);
      onNext(createDocSnapshot(target.id, map.get(target.id)));
    };
    if (!listeners.has(colName)) listeners.set(colName, new Set());
    listeners.get(colName)!.add(emit);

    ensureCollectionLoaded(colName)
      .then(() => {
        emit();
        // Also trigger a fresh remote check so newly mounted listeners always get latest cloud state
        refreshCollectionFromRemote(colName).catch(() => {});
      })
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
    .then(() => {
      emit();
      // Also trigger a fresh remote check so newly mounted listeners always get latest cloud state
      refreshCollectionFromRemote(colName).catch(() => {});
    })
    .catch((err) => onError?.(err));

  return () => {
    listeners.get(colName)?.delete(emit);
  };
}

export function writeBatch(_db?: any) {
  const ops: Array<() => Promise<void>> = [];
  const touchedCollections = new Set<string>();
  const batchUpserts = new Map<string, Record<string, Record<string, any>>>();
  const batchDeletes = new Map<string, string[]>();

  return {
    set(docRef: DocRef, data: Record<string, any>, options?: { merge?: boolean }) {
      ops.push(async () => {
        const map = await ensureCollectionLoaded(docRef.collectionName);
        const existing = map.get(docRef.id);
        const updated = applyFieldMutations(existing, data, Boolean(options?.merge));
        map.set(docRef.id, updated);
        markDocDirty(docRef.collectionName, docRef.id, updated);
        touchedCollections.add(docRef.collectionName);
        if (!batchUpserts.has(docRef.collectionName)) {
          batchUpserts.set(docRef.collectionName, {});
        }
        batchUpserts.get(docRef.collectionName)![docRef.id] = updated;
      });
    },
    update(docRef: DocRef, data: Record<string, any>) {
      ops.push(async () => {
        const map = await ensureCollectionLoaded(docRef.collectionName);
        const existing = map.get(docRef.id) || {};
        const updated = applyFieldMutations(existing, data, true);
        map.set(docRef.id, updated);
        markDocDirty(docRef.collectionName, docRef.id, updated);
        touchedCollections.add(docRef.collectionName);
        if (!batchUpserts.has(docRef.collectionName)) {
          batchUpserts.set(docRef.collectionName, {});
        }
        batchUpserts.get(docRef.collectionName)![docRef.id] = updated;
      });
    },
    delete(docRef: DocRef) {
      ops.push(async () => {
        const map = await ensureCollectionLoaded(docRef.collectionName);
        map.delete(docRef.id);
        markDocDeleted(docRef.collectionName, docRef.id);
        touchedCollections.add(docRef.collectionName);
        if (!batchDeletes.has(docRef.collectionName)) {
          batchDeletes.set(docRef.collectionName, []);
        }
        batchDeletes.get(docRef.collectionName)!.push(docRef.id);
        if (pgTableStatus.get(docRef.collectionName) !== false) {
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
        broadcastDocMutation(
          colName,
          batchUpserts.get(colName),
          batchDeletes.get(colName)
        );
        schedulePersistCollection(colName);
      }
    },
  };
}

/**
 * Completely deletes all shop data (mobiles, sales, bills, khata, khataTransactions,
 * expenses, backups, users, shops) and per-email storage files associated with a deleted account,
 * and broadcasts a real-time termination signal so any open mobile/laptop session is signed out immediately.
 */
export async function purgeAllShopDataForAccount(
  email?: string,
  uid?: string,
  shopId?: string
): Promise<void> {
  const cleanEmail = (email || '').toLowerCase().trim();
  const derivedShopId = shopId || (uid ? `shop_${uid.slice(0, 8)}` : '');

  // 0. Clear local PIN keys for this deleted email immediately
  if (cleanEmail) {
    pinLockService.clearPinForEmail(cleanEmail);
  }

  // 1. Broadcast immediate real-time account termination to all connected devices
  broadcastAccountTermination({
    email: cleanEmail || undefined,
    uid: uid || undefined,
    shopId: derivedShopId || undefined,
    reason: 'deleted',
  });

  const dataCollections = [
    'mobiles',
    'sales',
    'bills',
    'khata',
    'khataTransactions',
    'expenses',
    'backups',
    'users',
    'shops',
  ];

  for (const colName of dataCollections) {
    try {
      const map = await ensureCollectionLoaded(colName);
      const removedIds: string[] = [];

      for (const [docId, docData] of Array.from(map.entries())) {
        const docEmail = String(
          docData?.userEmail || docData?.ownerEmail || docData?.email || ''
        )
          .toLowerCase()
          .trim();
        const matchesEmail = cleanEmail && docEmail === cleanEmail;
        const matchesUid =
          uid && (docData?.userId === uid || docData?.ownerUid === uid || docData?.uid === uid || docId === uid);
        const matchesShopId = derivedShopId && docData?.shopId === derivedShopId;

        if (matchesEmail || matchesUid || matchesShopId) {
          map.delete(docId);
          markDocDeleted(colName, docId);
          removedIds.push(docId);
          if (pgTableStatus.get(colName) !== false) {
            supabaseAdmin.from(colName).delete().eq('id', docId).then(() => {});
          }
        }
      }

      if (removedIds.length > 0) {
        notifyCollectionListeners(colName);
        broadcastDocMutation(colName, undefined, removedIds);
        schedulePersistCollection(colName);
      }
    } catch {
      // ignore individual collection errors
    }
  }

  // Also remove the per-email folder files inside `shop-assets/shops/{email}/`
  if (cleanEmail) {
    const safeEmail = cleanEmail.replace(/[^a-z0-9@._-]/g, '_');
    const pathsToRemove = [
      ...dataCollections.map((c) => `shops/${safeEmail}/${c}.json`),
      `shops/${safeEmail}/backup.json`,
    ];
    try {
      await supabaseAdmin.storage.from(SUPABASE_BUCKET).remove(pathsToRemove);
    } catch {
      // ignore storage cleanup warning
    }
  }
}

import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { supabaseAdmin } from '../lib/supabase';
import { purgeAllShopDataForAccount } from '../lib/supabaseDb';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { 
  ShieldCheck, Users, Search, RefreshCw, UserPlus, Mail, Store, CheckCircle, AlertTriangle, Trash2,
  Cloud, Database, Copy, Check, ExternalLink, Key, CheckCircle2, XCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { parseDateSafe } from '../utils/dateUtils';
import { useToast } from '../contexts/ToastContext';
import { SUPABASE_SQL_SCHEMA } from '../lib/supabase';
import { 
  getMasterDriveToken, 
  saveMasterDriveToken, 
  removeMasterDriveToken, 
  verifyDriveToken, 
  getGoogleDriveAccessToken 
} from '../utils/googleAuthHelper';

interface ShopTenant {
  id: string;
  ownerUid: string;
  shopName: string;
  ownerName: string;
  ownerEmail: string;
  registeredDate: Date;
  lastActivityMs: number;
  status: 'active' | 'suspended';
}

export default function SuperAdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { success, toast } = useToast();

  const isMasterAdmin = 
    (user?.email || '').toLowerCase() === 'threadsandtailsshop@gmail.com' ||
    (user?.email || '').toLowerCase() === 'admin@hisaabflow.com' ||
    Boolean(localStorage.getItem('master_admin_session'));

  const [tenants, setTenants] = useState<ShopTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal for registering a new client shop
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newShopName, setNewShopName] = useState('');
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newJoinDate, setNewJoinDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Modal for deleting a client shop account
  const [tenantToDelete, setTenantToDelete] = useState<ShopTenant | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Master Google Drive state
  const [hasMasterDrive, setHasMasterDrive] = useState(false);
  const [connectingDrive, setConnectingDrive] = useState(false);
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [manualTokenInput, setManualTokenInput] = useState('');
  const [savingManualToken, setSavingManualToken] = useState(false);
  const [testingDrive, setTestingDrive] = useState(false);
  const [driveEmail, setDriveEmail] = useState<string | null>(null);

  // Supabase PostgreSQL Schema state
  const [copiedSql, setCopiedSql] = useState(false);
  const [syncingSql, setSyncingSql] = useState(false);

  useEffect(() => {
    getMasterDriveToken().then(tok => {
      setHasMasterDrive(Boolean(tok));
      if (tok) {
        verifyDriveToken(tok).then(res => {
          if (res.valid && res.email) setDriveEmail(res.email);
        });
      }
    });
  }, []);

  const handleConnectMasterDrive = async () => {
    setConnectingDrive(true);
    try {
      toast('Opening Google Drive connection...', 'info');
      const token = await getGoogleDriveAccessToken('threadsandtailsshop@gmail.com', true);
      if (token) {
        await saveMasterDriveToken(token);
        setHasMasterDrive(true);
        const check = await verifyDriveToken(token);
        if (check.valid && check.email) setDriveEmail(check.email);
        success('Master Google Drive connected! All client shops can now sync backups into this central Drive.');
      }
    } catch (err: any) {
      console.warn('Drive connection error:', err);
      toast(err.message || 'Google Drive connection failed.', 'error');
      // Open modal so admin can easily paste access token if popup is blocked
      setShowDriveModal(true);
    } finally {
      setConnectingDrive(false);
    }
  };

  const handleSaveManualToken = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = manualTokenInput.trim();
    if (!token) return;

    setSavingManualToken(true);
    try {
      toast('Verifying token with Google Drive...', 'info');
      const check = await verifyDriveToken(token);
      if (!check.valid) {
        throw new Error(check.error || 'The token provided is not valid for Google Drive API.');
      }
      await saveMasterDriveToken(token);
      setHasMasterDrive(true);
      setDriveEmail(check.email || 'threadsandtailsshop@gmail.com');
      setManualTokenInput('');
      success(`Google Drive connected successfully as ${check.email || 'threadsandtailsshop@gmail.com'}!`);
      setShowDriveModal(false);
    } catch (err: any) {
      toast(err.message || 'Failed to verify token with Google.', 'error');
    } finally {
      setSavingManualToken(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingDrive(true);
    try {
      const tok = await getMasterDriveToken();
      if (!tok) {
        setHasMasterDrive(false);
        throw new Error('No active Drive token found. Please connect your Google Drive.');
      }
      const check = await verifyDriveToken(tok);
      if (check.valid) {
        setHasMasterDrive(true);
        setDriveEmail(check.email || 'threadsandtailsshop@gmail.com');
        success(`Google Drive connection is ACTIVE! Verified account: ${check.email}`);
      } else {
        throw new Error(check.error || 'Token expired. Please reconnect.');
      }
    } catch (err: any) {
      toast(err.message || 'Connection test failed.', 'error');
    } finally {
      setTestingDrive(false);
    }
  };

  const handleDisconnectDrive = async () => {
    if (confirm('Disconnect Master Google Drive? Client shops will not be able to sync cloud backups until reconnected.')) {
      await removeMasterDriveToken();
      setHasMasterDrive(false);
      setDriveEmail(null);
      success('Master Google Drive disconnected.');
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSql(true);
    success('Supabase SQL Schema copied! Paste it in Supabase Dashboard -> SQL Editor and click Run.');
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleSyncStorageToSql = async () => {
    setSyncingSql(true);
    try {
      toast('Syncing existing shop data to Supabase PostgreSQL tables...', 'info');
      const collections = ['users', 'shops', 'mobiles', 'sales', 'bills', 'expenses', 'khata', 'khataTransactions'];
      let syncedCols = 0;
      for (const col of collections) {
        const snap = await getDocs(collection(db, col));
        if (!snap.empty) {
          const rows = snap.docs.map(d => {
            const data = d.data();
            return {
              id: d.id,
              shop_id: data.shopId || null,
              user_id: data.userId || null,
              user_email: data.userEmail || data.ownerEmail || null,
              data,
              updated_at: new Date().toISOString(),
            };
          });
          const { error: pgErr } = await supabaseAdmin.from(col).upsert(rows, { onConflict: 'id' });
          if (!pgErr) syncedCols++;
        }
      }
      if (syncedCols > 0) {
        success(`Synced data into ${syncedCols} PostgreSQL tables in Supabase Table Editor!`);
      } else {
        toast('PostgreSQL tables not found in schema yet. Please run the SQL schema in SQL Editor first.', 'info');
      }
    } catch (err: any) {
      toast('Sync completed with notices.', 'info');
    } finally {
      setSyncingSql(false);
    }
  };

  useEffect(() => {
    if (!isMasterAdmin) {
      navigate('/dashboard');
      return;
    }
    fetchTenants();

    // Real-time listener on users & shops collections so any changes immediately reflect
    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      () => {
        fetchTenants(true);
      },
      () => {}
    );

    const unsubShops = onSnapshot(
      collection(db, 'shops'),
      () => {
        fetchTenants(true);
      },
      () => {}
    );

    return () => {
      unsubUsers();
      unsubShops();
    };
  }, [user, isMasterAdmin]);

  const fetchTenants = async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    try {
      const [usersSnap, shopsSnap, authListResult] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'shops')),
        supabaseAdmin.auth.admin.listUsers().catch(() => ({ data: { users: [] }, error: null })),
      ]);

      const authUsers = authListResult?.data?.users || [];
      const authUsersById = new Map<string, any>();
      const authUsersByEmail = new Map<string, any>();

      for (const au of authUsers) {
        if (au.id) authUsersById.set(au.id, au);
        if (au.email) authUsersByEmail.set(au.email.toLowerCase().trim(), au);
      }

      const usersById = new Map<string, any>();
      usersSnap.forEach((d) => {
        usersById.set(d.id, d.data());
      });

      const shopsById = new Map<string, any>();
      shopsSnap.forEach((d) => {
        shopsById.set(d.id, d.data());
      });

      // 1. Ensure every Supabase Auth user has a corresponding `users` and `shops` entry
      for (const au of authUsers) {
        const email = (au.email || '').toLowerCase().trim();
        if (!email) continue;
        const isMaster = email === 'threadsandtailsshop@gmail.com';
        const displayName =
          au.user_metadata?.full_name ||
          au.user_metadata?.display_name ||
          au.user_metadata?.name ||
          (isMaster ? 'Super Admin' : email.split('@')[0]);

        if (!usersById.has(au.id)) {
          const newUserDoc = {
            uid: au.id,
            email,
            name: displayName,
            role: isMaster ? 'superadmin' : 'admin',
            status: 'active',
            createdAt: au.created_at || new Date().toISOString(),
            lastLoginAt: au.last_sign_in_at || au.created_at || new Date().toISOString(),
          };
          usersById.set(au.id, newUserDoc);
          await setDoc(doc(db, 'users', au.id), newUserDoc, { merge: true }).catch(() => {});
        }
        if (!shopsById.has(au.id)) {
          const newShopDoc = {
            shopId: `shop_${au.id.slice(0, 8)}`,
            ownerUid: au.id,
            ownerEmail: email,
            ownerName: isMaster ? 'Super Admin (Owner)' : displayName,
            shopName: isMaster ? 'Super Admin' : displayName,
            status: 'active',
            createdAt: au.created_at || new Date().toISOString(),
            updatedAt: au.last_sign_in_at || au.created_at || new Date().toISOString(),
          };
          shopsById.set(au.id, newShopDoc);
          await setDoc(doc(db, 'shops', au.id), newShopDoc, { merge: true }).catch(() => {});
        }
      }

      // 2. If a user was deleted in Supabase Authentication Console, remove stale non-admin-registered records AND all their shop data
      if (authUsers.length > 0) {
        for (const [docId, userData] of Array.from(usersById.entries())) {
          const email = (userData.email || '').toLowerCase().trim();
          const shopData = shopsById.get(docId) || {};
          const isPreRegistered = Boolean(userData.registeredByAdmin || shopData.registeredByAdmin);
          const existsInSupabaseAuth = authUsersById.has(docId) || (email && authUsersByEmail.has(email));

          if (!existsInSupabaseAuth && !isPreRegistered) {
            await purgeAllShopDataForAccount(email, docId, shopData.shopId).catch(() => {});
            await deleteDoc(doc(db, 'users', docId)).catch(() => {});
            await deleteDoc(doc(db, 'shops', docId)).catch(() => {});
            usersById.delete(docId);
            shopsById.delete(docId);
          }
        }
      }

      // 3. Build deduplicated list by email, always keeping the active Supabase Auth UID
      const emailMap = new Map<string, ShopTenant>();

      for (const [docId, userData] of usersById.entries()) {
        const shopData = shopsById.get(docId) || {};
        const rawEmail = userData.email || shopData.ownerEmail || shopData.email || '';
        const email = rawEmail.toLowerCase().trim();

        if (!email || !email.includes('@') || email.includes('@client.hisaabflow.com')) {
          continue;
        }

        const authUser = authUsersByEmail.get(email);
        const createdDate =
          parseDateSafe(authUser?.created_at) ||
          parseDateSafe(userData.createdAt) ||
          parseDateSafe(shopData.createdAt) ||
          new Date();
        const lastLoginDate =
          parseDateSafe(authUser?.last_sign_in_at) ||
          parseDateSafe(userData.lastLoginAt) ||
          parseDateSafe(shopData.updatedAt) ||
          createdDate;
        const activityScore = Math.max(createdDate.getTime(), lastLoginDate.getTime());

        const isMaster = email === 'threadsandtailsshop@gmail.com';
        const resolvedShopName = isMaster
          ? 'Super Admin'
          : (shopData.shopName || userData.shopName || userData.name || 'Mobile Shop');
        const resolvedOwnerName = isMaster
          ? 'Super Admin (Owner)'
          : (userData.name || shopData.ownerName || 'Shop Owner');

        const candidate: ShopTenant = {
          id: docId,
          ownerUid: authUser?.id || userData.uid || shopData.ownerUid || docId,
          shopName: resolvedShopName,
          ownerName: resolvedOwnerName,
          ownerEmail: email,
          registeredDate: createdDate,
          lastActivityMs: activityScore,
          status: (userData.status === 'suspended' || shopData.status === 'suspended') ? 'suspended' : 'active',
        };

        if (emailMap.has(email)) {
          const existing = emailMap.get(email)!;
          const candidateIsAuthUid = authUser && candidate.id === authUser.id;
          if (candidateIsAuthUid || candidate.lastActivityMs >= existing.lastActivityMs) {
            await deleteDoc(doc(db, 'users', existing.id)).catch(() => {});
            await deleteDoc(doc(db, 'shops', existing.id)).catch(() => {});
            emailMap.set(email, candidate);
          } else {
            await deleteDoc(doc(db, 'users', candidate.id)).catch(() => {});
            await deleteDoc(doc(db, 'shops', candidate.id)).catch(() => {});
          }
        } else {
          emailMap.set(email, candidate);
        }
      }

      const masterEmail = 'threadsandtailsshop@gmail.com';
      const list = Array.from(emailMap.values());
      list.sort((a, b) => {
        if (a.ownerEmail === masterEmail) return -1;
        if (b.ownerEmail === masterEmail) return 1;
        return b.registeredDate.getTime() - a.registeredDate.getTime();
      });

      setTenants(list);
    } catch (e) {
      console.error('Error fetching tenants:', e);
      if (!silent) toast('Failed to load accounts list', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filteredTenants = tenants.filter((t) => {
    const q = searchTerm.toLowerCase();
    return (
      t.shopName.toLowerCase().includes(q) ||
      t.ownerEmail.toLowerCase().includes(q) ||
      t.ownerName.toLowerCase().includes(q)
    );
  });

  const totalClients = tenants.length;

  const handleToggleStatus = async (tenant: ShopTenant) => {
    const newStatus = tenant.status === 'active' ? 'suspended' : 'active';
    try {
      await setDoc(doc(db, 'shops', tenant.id), { status: newStatus }, { merge: true });
      await setDoc(doc(db, 'users', tenant.id), { status: newStatus }, { merge: true });
      setTenants((prev) =>
        prev.map((t) => (t.id === tenant.id ? { ...t, status: newStatus } : t))
      );
      success(`Updated status of ${tenant.shopName} to ${newStatus}.`);
    } catch (e) {
      toast('Failed to update shop status', 'error');
    }
  };

  const handleDeleteTenant = async () => {
    if (!tenantToDelete) return;
    setIsDeleting(true);
    try {
      const targetEmail = tenantToDelete.ownerEmail.toLowerCase().trim();
      const targetId = tenantToDelete.id;
      const targetUid = tenantToDelete.ownerUid;

      // 1. Delete from Supabase Authentication if present
      try {
        if (targetUid && !targetUid.startsWith('shop_')) {
          await supabaseAdmin.auth.admin.deleteUser(targetUid);
        }
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        const matchingAuthUser = listData?.users?.find(
          (u: any) => (u.email || '').toLowerCase().trim() === targetEmail
        );
        if (matchingAuthUser) {
          await supabaseAdmin.auth.admin.deleteUser(matchingAuthUser.id);
        }
      } catch (e) {
        // ignore if already deleted from Auth
      }

      // 2. Purge all shop data (mobiles, sales, bills, khata, khataTransactions, expenses, backups, storage files)
      await purgeAllShopDataForAccount(targetEmail, targetUid).catch(() => {});

      // 3. Delete primary documents by ID in Supabase DB
      await deleteDoc(doc(db, 'users', targetId)).catch(() => {});
      await deleteDoc(doc(db, 'shops', targetId)).catch(() => {});

      // 4. Also delete any other documents matching this email in users and shops
      const uQ = query(collection(db, 'users'), where('email', '==', targetEmail));
      const uSnap = await getDocs(uQ);
      for (const d of uSnap.docs) {
        await deleteDoc(doc(db, 'users', d.id)).catch(() => {});
        await deleteDoc(doc(db, 'shops', d.id)).catch(() => {});
      }

      const sQ = query(collection(db, 'shops'), where('ownerEmail', '==', targetEmail));
      const sSnap = await getDocs(sQ);
      for (const d of sSnap.docs) {
        await deleteDoc(doc(db, 'shops', d.id)).catch(() => {});
        await deleteDoc(doc(db, 'users', d.id)).catch(() => {});
      }

      setTenants((prev) => prev.filter((t) => t.ownerEmail !== targetEmail));
      success(`Removed ${tenantToDelete.shopName} (${targetEmail}) and all associated shop data.`);
      setTenantToDelete(null);
    } catch (err) {
      toast('Failed to delete account', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddClientShop = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail) {
      toast('Please enter a valid Gmail address', 'error');
      return;
    }

    setSubmittingAdd(true);
    try {
      const tenantDocId = `shop_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const joinDateObj = new Date(newJoinDate || new Date());

      const payload = {
        ownerEmail: cleanEmail,
        shopName: newShopName.trim() || 'Client Mobile Center',
        ownerName: newOwnerName.trim() || 'Shop Owner',
        createdAt: joinDateObj,
        status: 'active',
        registeredByAdmin: true,
      };

      await setDoc(doc(db, 'shops', tenantDocId), payload, { merge: true });
      await setDoc(doc(db, 'users', tenantDocId), {
        uid: tenantDocId,
        email: cleanEmail,
        name: payload.ownerName,
        shopName: payload.shopName,
        role: 'client',
        createdAt: joinDateObj,
        status: 'active',
        registeredByAdmin: true,
      }, { merge: true });

      success(`Successfully registered ${payload.shopName} (${cleanEmail})!`);
      setShowAddModal(false);
      setNewEmail('');
      setNewShopName('');
      setNewOwnerName('');
      await fetchTenants();
    } catch (err: any) {
      toast('Failed to register client shop: ' + (err.message || 'Error'), 'error');
    } finally {
      setSubmittingAdd(false);
    }
  };

  if (!isMasterAdmin) return null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-[#FAF5FC] text-[#522D60] border border-[#522D60]/20">
              <ShieldCheck className="w-5 h-5 text-[#522D60]" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
              HISAABFLOW Super Admin
            </h1>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Admin Client Accounts Portal (Restricted to {user?.email})
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => fetchTenants(false)}
            variant="secondary"
            disabled={refreshing}
            className="text-xs font-bold"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            onClick={() => setShowAddModal(true)}
            className="bg-[#522D60] hover:bg-[#42244E] text-white text-xs font-bold"
          >
            <UserPlus className="w-3.5 h-3.5 mr-1.5" />
            Register Client Shop
          </Button>
        </div>
      </div>

      {/* KPI Stats + Master Integrations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Client Shops */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#FAF5FC] text-[#522D60] border border-[#522D60]/20 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400">Total Client Shops</p>
            <p className="text-3xl font-black text-gray-900">{totalClients}</p>
          </div>
        </div>

        {/* Card 2: Central Master Google Drive */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-card flex flex-col justify-between overflow-hidden">
          <div className="space-y-2 mb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-2 rounded-xl bg-purple-50 text-[#522D60] shrink-0">
                  <Cloud className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-900 truncate">Master Google Drive</p>
                  <p className="text-[10px] text-gray-400 font-mono truncate" title="threadsandtailsshop@gmail.com">
                    threadsandtailsshop@gmail.com
                  </p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                hasMasterDrive ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${hasMasterDrive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {hasMasterDrive ? 'Connected' : 'Not Connected'}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 leading-snug">
              Client shops automatically upload their <span className="font-semibold text-gray-700">[ShopName] Backup.json</span> into this central Drive.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowDriveModal(true)}
              className="text-xs font-bold border-purple-200 text-[#522D60] hover:bg-purple-50 cursor-pointer justify-center"
            >
              <Key className="w-3.5 h-3.5 mr-1 shrink-0" />
              <span>Manage</span>
            </Button>
            <Button
              size="sm"
              onClick={handleConnectMasterDrive}
              disabled={connectingDrive}
              isLoading={connectingDrive}
              className="text-xs font-bold bg-[#522D60] hover:bg-[#42244E] text-white cursor-pointer justify-center"
            >
              <Cloud className="w-3.5 h-3.5 mr-1 shrink-0" />
              <span>{hasMasterDrive ? 'Sync' : 'Connect'}</span>
            </Button>
          </div>
        </div>

        {/* Card 3: Supabase PostgreSQL Schema & Table Editor */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-card flex flex-col justify-between overflow-hidden">
          <div className="space-y-2 mb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 shrink-0">
                  <Database className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-900 truncate">Supabase Table Editor</p>
                  <p className="text-[10px] text-gray-400 truncate">PostgreSQL Public Schema</p>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-gray-500 leading-snug">
              Tables created in Supabase SQL Editor. Every row has <span className="font-mono font-semibold text-gray-700">user_email</span> to see data per shop.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleCopySql}
              className="text-xs font-bold cursor-pointer justify-center"
            >
              {copiedSql ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-600 shrink-0" /> : <Copy className="w-3.5 h-3.5 mr-1 shrink-0" />}
              <span className="truncate">{copiedSql ? 'Copied!' : 'Copy SQL'}</span>
            </Button>
            <Button
              size="sm"
              onClick={handleSyncStorageToSql}
              disabled={syncingSql}
              isLoading={syncingSql}
              className="text-xs font-bold bg-[#522D60] hover:bg-[#42244E] text-white cursor-pointer justify-center"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 shrink-0 ${syncingSql ? 'animate-spin' : ''}`} />
              <span className="truncate">Push Data</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Search & Tenants Table */}
      <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Registered Client Accounts</h2>
            <p className="text-[11px] text-gray-400">Live-synced accounts from Firestore & Authentication</p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by shop name or Gmail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:border-[#522D60]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-xs">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="px-5 py-3">Shop / Client</th>
                <th className="px-5 py-3">Logged-in Gmail</th>
                <th className="px-5 py-3">Join Date</th>
                <th className="px-5 py-3">User UID</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-[#522D60]" />
                      <span>Syncing client accounts...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-400">
                    No client accounts found.
                  </td>
                </tr>
              ) : (
                filteredTenants.map((t) => {
                  const isOwner =
                    t.ownerEmail.toLowerCase() === 'threadsandtailsshop@gmail.com' ||
                    t.ownerEmail.toLowerCase() === 'threadsandtailsusa@gmail.com';

                  return (
                    <tr key={t.id} className="hover:bg-purple-50/20 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-gray-900 whitespace-nowrap">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span>{t.shopName}</span>
                            {isOwner && (
                              <span className="text-[9px] font-extrabold bg-[#522D60] text-white px-1.5 py-0.5 rounded-sm">
                                SUPER ADMIN
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-normal text-gray-400">{t.ownerName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-gray-700 whitespace-nowrap font-medium">
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span>{t.ownerEmail}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap font-medium">
                        {format(t.registeredDate, 'dd MMM yyyy')}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[11px] text-gray-500 whitespace-nowrap" title={t.ownerUid || t.id}>
                        {(t.ownerUid || t.id || '').length > 20 ? `${(t.ownerUid || t.id).slice(0, 20)}...` : (t.ownerUid || t.id)}
                      </td>
                      <td className="px-5 py-3.5 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          t.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {t.status === 'active' ? (
                            <CheckCircle className="w-2.5 h-2.5 text-emerald-600" />
                          ) : (
                            <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                          )}
                          {t.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        {isOwner ? (
                          <span className="text-[11px] text-gray-400 italic">Super Admin</span>
                        ) : (
                          <div className="inline-flex items-center justify-end gap-3">
                            <button
                              onClick={() => handleToggleStatus(t)}
                              className="text-[11px] font-bold text-[#522D60] hover:underline cursor-pointer"
                            >
                              {t.status === 'active' ? 'Suspend' : 'Activate'}
                            </button>
                            <button
                              onClick={() => setTenantToDelete(t)}
                              title="Delete Account"
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Confirm Delete Client Account */}
      <Modal
        isOpen={!!tenantToDelete}
        onClose={() => !isDeleting && setTenantToDelete(null)}
        title="Remove Client Account"
        size="sm"
      >
        {tenantToDelete && (
          <div className="space-y-4 text-xs">
            <p className="text-gray-600 leading-relaxed">
              Remove <span className="font-bold text-gray-900">{tenantToDelete.shopName}</span> ({tenantToDelete.ownerEmail}) from the Admin Panel and Firestore?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setTenantToDelete(null)}
                disabled={isDeleting}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleDeleteTenant}
                disabled={isDeleting}
                isLoading={isDeleting}
                className="text-xs font-bold"
              >
                Delete Account
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Register Client Shop */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Register New Client Shop"
        size="md"
      >
        <form onSubmit={handleAddClientShop} className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-gray-700 block mb-1">
              Client's Google Account / Gmail <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="e.g. client.shop@gmail.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:border-[#522D60]"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-gray-700 block mb-1">Shop Name</label>
            <div className="relative">
              <Store className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="e.g. Al-Madina Mobile Center"
                value={newShopName}
                onChange={(e) => setNewShopName(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:border-[#522D60]"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-gray-700 block mb-1">Owner Name</label>
            <input
              type="text"
              placeholder="e.g. Bilal Khan"
              value={newOwnerName}
              onChange={(e) => setNewOwnerName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:border-[#522D60]"
            />
          </div>

          <div>
            <label className="font-bold text-gray-700 block mb-1">Joining / Registration Date</label>
            <input
              type="date"
              value={newJoinDate}
              onChange={(e) => setNewJoinDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:border-[#522D60]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowAddModal(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submittingAdd}
              isLoading={submittingAdd}
              className="bg-[#522D60] hover:bg-[#42244E] text-white text-xs font-bold px-4"
            >
              Save & Register
            </Button>
          </div>
        </form>
      </Modal>

      {/* GOOGLE DRIVE CONNECTION MANAGER MODAL */}
      <Modal
        isOpen={showDriveModal}
        onClose={() => setShowDriveModal(false)}
        title="Master Google Drive Connection"
        size="lg"
      >
        <div className="space-y-4 text-xs">
          {/* Connection Status Box */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
            hasMasterDrive 
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' 
              : 'bg-amber-50/80 border-amber-200 text-amber-900'
          }`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className={`p-2.5 rounded-xl ${hasMasterDrive ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {hasMasterDrive ? <CheckCircle2 className="w-5 h-5 stroke-[2.5]" /> : <Cloud className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm">
                  {hasMasterDrive ? 'Master Google Drive is CONNECTED' : 'Master Google Drive is NOT Connected'}
                </p>
                <p className="text-[11px] opacity-80 truncate">
                  Account: <strong>{driveEmail || 'threadsandtailsshop@gmail.com'}</strong>
                </p>
              </div>
            </div>

            {hasMasterDrive && (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleTestConnection}
                disabled={testingDrive}
                isLoading={testingDrive}
                className="shrink-0 text-xs font-bold bg-white border-emerald-300 text-emerald-800 hover:bg-emerald-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1 ${testingDrive ? 'animate-spin' : ''}`} />
                Test Connection
              </Button>
            )}
          </div>

          <p className="text-gray-600 leading-relaxed">
            Connecting this master drive allows all shop clients to automatically sync and store encrypted database backups 
            into your central Google Drive folder.
          </p>

          {/* Option 1: One-Click Google Sign-In */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide text-[11px]">
                <Cloud className="w-3.5 h-3.5 text-[#522D60]" />
                Option 1: Connect via Google Sign-In Popup
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Opens the Google OAuth window to grant Drive permissions directly for <strong>threadsandtailsshop@gmail.com</strong>.
            </p>
            <Button
              type="button"
              onClick={handleConnectMasterDrive}
              disabled={connectingDrive}
              isLoading={connectingDrive}
              className="w-full bg-[#522D60] hover:bg-[#42244E] text-white font-bold py-2 text-xs cursor-pointer justify-center"
            >
              <Cloud className="w-4 h-4 mr-1.5" />
              {hasMasterDrive ? 'Re-authorize with Google Account' : 'Authorize with Google Account'}
            </Button>
          </div>

          {/* Option 2: Direct OAuth Access Token Input (Bypasses origin_mismatch) */}
          <form onSubmit={handleSaveManualToken} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide text-[11px]">
                <Key className="w-3.5 h-3.5 text-amber-600" />
                Option 2: Direct OAuth Access Token (Instant Connection)
              </span>
              <a
                href="https://developers.google.com/oauthplayground/#step1&apisSelect=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive.file"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-bold text-purple-700 hover:text-purple-900 flex items-center gap-1 underline"
              >
                <span>OAuth Playground</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <p className="text-[11px] text-slate-500 leading-snug">
              If your browser blocks the popup or returns an origin error, you can paste a Google Drive Access Token directly:
            </p>

            <div className="space-y-1.5">
              <input
                type="text"
                placeholder="ya29.a0AfH6SM..."
                value={manualTokenInput}
                onChange={(e) => setManualTokenInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-[11px] bg-white text-slate-900 focus:outline-none focus:border-[#522D60]"
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <Button
                type="submit"
                disabled={savingManualToken || !manualTokenInput.trim()}
                isLoading={savingManualToken}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-1.5 text-xs"
              >
                <Check className="w-3.5 h-3.5 mr-1" />
                Verify & Save Token
              </Button>

              {hasMasterDrive && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleDisconnectDrive}
                  className="text-rose-600 hover:bg-rose-50 text-xs font-semibold"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Disconnect Drive
                </Button>
              )}
            </div>
          </form>

          <div className="pt-2 flex justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowDriveModal(false)}
              className="text-xs font-medium"
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

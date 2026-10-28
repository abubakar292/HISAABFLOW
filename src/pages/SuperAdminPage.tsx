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
  ShieldCheck, Users, Search, RefreshCw, UserPlus, Mail, Store, CheckCircle, AlertTriangle, Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { parseDateSafe } from '../utils/dateUtils';
import { useToast } from '../contexts/ToastContext';

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

      {/* KPI Stats - ONLY 1 Card: Total Client Shops */}
      <div className="max-w-xs">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#FAF5FC] text-[#522D60] border border-[#522D60]/20 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400">Total Client Shops</p>
            <p className="text-3xl font-black text-gray-900">{totalClients}</p>
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
    </div>
  );
}

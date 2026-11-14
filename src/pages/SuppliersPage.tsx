import React, { useState, useEffect, useRef } from 'react';
import {
  collection,
  query,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  where,
  writeBatch,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  Users,
  Search,
  Plus,
  ChevronRight,
  X,
  Edit2,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { isDocForShop } from '../utils/multiTenantService';
import { parseDateSafe } from '../utils/dateUtils';
import { format } from 'date-fns';

export default function SuppliersPage() {
  const { user, currentShopId } = useAuth();
  const navigate = useNavigate();
  const { success, error } = useToast();

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [filterTab, setFilterTab] = useState<'all' | 'payable' | 'settled'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [loading, setLoading] = useState(true);
  const healedSuppliersRef = useRef<Set<string>>(new Set());

  // Add Supplier Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const isAddingRef = useRef(false);

  // Edit Supplier State
  const [supplierToEdit, setSupplierToEdit] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const isSavingEditRef = useRef(false);

  // Delete Supplier State
  const [supplierToDelete, setSupplierToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const isDeletingRef = useRef(false);

  useEffect(() => {
    if (!user || !currentShopId) {
      setSuppliers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = onSnapshot(
      collection(db, 'suppliers'),
      (snap) => {
        const list: any[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          if (isDocForShop(data, currentShopId)) {
            list.push({ id: docSnap.id, ...data });
          }
        });
        list.sort((a, b) => {
          const da = a.createdAt?.toMillis
            ? a.createdAt.toMillis()
            : new Date(a.createdAt || 0).getTime();
          const dbTime = b.createdAt?.toMillis
            ? b.createdAt.toMillis()
            : new Date(b.createdAt || 0).getTime();
          return dbTime - da;
        });
        setSuppliers(list);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return unsub;
  }, [user, currentShopId]);

  // Auto-heal any supplier whose purchased mobiles were saved before credit-auto-select or had negative balance offset
  useEffect(() => {
    if (!user || !currentShopId || suppliers.length === 0) return;

    const getTxDayStr = (tx: any): string => {
      if (tx.dateStr && /^\d{4}-\d{2}-\d{2}$/.test(String(tx.dateStr).trim())) {
        return String(tx.dateStr).trim();
      }
      const d = parseDateSafe(tx.date || tx.createdAt) || new Date();
      return format(d, 'yyyy-MM-dd');
    };

    const getTxCreatedMs = (tx: any): number => {
      const c = parseDateSafe(tx.createdAt);
      if (c) return c.getTime();
      const d = parseDateSafe(tx.date);
      return d ? d.getTime() : 0;
    };

    const healSupplierBalances = async () => {
      try {
        const [mobilesSnap, txSnap] = await Promise.all([
          getDocs(collection(db, 'mobiles')),
          getDocs(collection(db, 'supplierTransactions')),
        ]);

        const shopMobiles = mobilesSnap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter((m) => isDocForShop(m, currentShopId));

        const shopTxs = txSnap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter((t) => isDocForShop(t, currentShopId));

        for (const sup of suppliers) {
          if (healedSuppliersRef.current.has(sup.id)) continue;
          healedSuppliersRef.current.add(sup.id);

          const supTxs = shopTxs.filter((t) => t.supplierId === sup.id);
          const linkedMobiles = shopMobiles.filter(
            (m) =>
              !m.supplierTxDeleted &&
              m.purchasePaymentType !== 'CashExplicit' &&
              (m.supplierId === sup.id ||
                (m.supplier &&
                  sup.name &&
                  String(m.supplier).toLowerCase().trim() ===
                    String(sup.name).toLowerCase().trim()))
          );

          let addedMissing = false;
          for (const m of linkedMobiles) {
            const qty = Number(m.initialQuantity || m.quantity) || 1;
            const mAmount = (Number(m.basePrice) || 0) * Math.max(1, qty);
            const alreadyLinked =
              Boolean(m.supplierTxCreated) ||
              supTxs.some(
                (t) =>
                  t.linkedMobileId === m.id ||
                  (t.transactionType === 'purchase' &&
                    Number(t.amount) === mAmount &&
                    String(t.description || '').includes(m.imei1 || m.modelName || ''))
              );

            if (!alreadyLinked && mAmount > 0) {
              const pDate = parseDateSafe(m.purchaseDateStr || m.purchaseDate || m.createdAt) || new Date();
              const pDateStr = m.purchaseDateStr || format(pDate, 'yyyy-MM-dd');
              const newTx = {
                shopId: currentShopId,
                userId: user.uid,
                userEmail: (user.email || '').toLowerCase(),
                supplierId: sup.id,
                supplierName: sup.name,
                transactionType: 'purchase',
                amount: mAmount,
                description: `${Math.max(1, qty)}x ${m.company || ''} ${m.modelName || ''}${
                  m.imei1 ? ` (IMEI: ${m.imei1})` : ''
                }`.trim(),
                runningBalance: 0,
                linkedMobileId: m.id,
                date: pDate,
                dateStr: pDateStr,
                createdAt: m.createdAt || serverTimestamp(),
              };
              const ref = await addDoc(collection(db, 'supplierTransactions'), newTx);
              await updateDoc(doc(db, 'mobiles', m.id), { supplierTxCreated: true }).catch(() => {});
              supTxs.push({ id: ref.id, ...newTx });
              addedMissing = true;
            }
          }

          if (supTxs.length > 0 || addedMissing) {
            // Sort chronologically by calendar day, then by exact createdAt timestamp
            const sorted = [...supTxs].sort((a, b) => {
              const dayA = getTxDayStr(a);
              const dayB = getTxDayStr(b);
              if (dayA !== dayB) return dayA.localeCompare(dayB);
              return getTxCreatedMs(a) - getTxCreatedMs(b);
            });

            let running = 0;
            const batch = writeBatch(db);
            let needsUpdate = false;

            sorted.forEach((tx) => {
              const amt = Number(tx.amount) || 0;
              if (tx.transactionType === 'purchase') {
                running = Math.max(0, running) + amt;
              } else {
                running = Math.max(0, running - amt);
              }
              if (Number(tx.runningBalance) !== running) {
                batch.update(doc(db, 'supplierTransactions', tx.id), {
                  runningBalance: running,
                });
                needsUpdate = true;
              }
            });

            if (Number(sup.totalBalance) !== running || needsUpdate) {
              batch.update(doc(db, 'suppliers', sup.id), {
                totalBalance: running,
                updatedAt: serverTimestamp(),
              });
              await batch.commit();
            }
          }
        }
      } catch (err) {
        console.warn('Supplier balance sync notice:', err);
      }
    };

    healSupplierBalances();
  }, [user, currentShopId, suppliers]);

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return error('Please sign in to add suppliers');
    if (!name.trim() || isAddingRef.current || isAdding) return;

    isAddingRef.current = true;
    setIsAdding(true);
    try {
      await addDoc(collection(db, 'suppliers'), {
        shopId: currentShopId,
        userId: user.uid,
        userEmail: (user.email || '').toLowerCase(),
        name: name.trim(),
        phone: phone.trim(),
        notes: notes.trim(),
        totalBalance: 0,
        createdAt: serverTimestamp(),
      });
      setShowAddSupplier(false);
      setName('');
      setPhone('');
      setNotes('');
      success('Supplier added to Khata');
    } catch (err: any) {
      error(err.message || 'Error adding supplier');
    } finally {
      setIsAdding(false);
      isAddingRef.current = false;
    }
  };

  const handleOpenEdit = (sup: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSupplierToEdit(sup);
    setEditName(sup.name || '');
    setEditPhone(sup.phone || '');
    setEditNotes(sup.notes || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierToEdit || !editName.trim() || isSavingEditRef.current || isSavingEdit) return;

    isSavingEditRef.current = true;
    setIsSavingEdit(true);
    try {
      await updateDoc(doc(db, 'suppliers', supplierToEdit.id), {
        name: editName.trim(),
        phone: editPhone.trim(),
        notes: editNotes.trim(),
        updatedAt: serverTimestamp(),
      });

      try {
        const txQuery = query(
          collection(db, 'supplierTransactions'),
          where('supplierId', '==', supplierToEdit.id)
        );
        const txSnap = await getDocs(txQuery);
        if (!txSnap.empty) {
          const batch = writeBatch(db);
          txSnap.forEach((tDoc) => {
            batch.update(doc(db, 'supplierTransactions', tDoc.id), {
              supplierName: editName.trim(),
            });
          });
          await batch.commit();
        }
      } catch {}

      success('Supplier updated successfully');
      setSupplierToEdit(null);
    } catch (err: any) {
      error(err.message || 'Error updating supplier');
    } finally {
      setIsSavingEdit(false);
      isSavingEditRef.current = false;
    }
  };

  const handleOpenDelete = (sup: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSupplierToDelete(sup);
  };

  const handleConfirmDelete = async () => {
    if (!supplierToDelete || isDeletingRef.current || isDeleting) return;
    isDeletingRef.current = true;
    setIsDeleting(true);
    try {
      const txQuery = query(
        collection(db, 'supplierTransactions'),
        where('supplierId', '==', supplierToDelete.id)
      );
      const txSnap = await getDocs(txQuery);
      if (!txSnap.empty) {
        const batch = writeBatch(db);
        txSnap.forEach((tDoc) => {
          batch.delete(doc(db, 'supplierTransactions', tDoc.id));
        });
        await batch.commit();
      }

      await deleteDoc(doc(db, 'suppliers', supplierToDelete.id));
      success(`Supplier "${supplierToDelete.name}" deleted`);
      setSupplierToDelete(null);
    } catch (err: any) {
      error(err.message || 'Error deleting supplier');
    } finally {
      setIsDeleting(false);
      isDeletingRef.current = false;
    }
  };

  const filteredSuppliers = suppliers.filter((s) => {
    const bal = Number(s.totalBalance) || 0;
    if (filterTab === 'payable' && bal <= 0) return false;
    if (filterTab === 'settled' && bal > 0) return false;

    const matchesSearch =
      s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.phone?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const totalPayable = suppliers.reduce(
    (sum, s) => sum + Math.max(0, Number(s.totalBalance) || 0),
    0
  );
  const payableCount = suppliers.filter((s) => (Number(s.totalBalance) || 0) > 0).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* TOP SUMMARY TABS (Matches Customer Khata Design) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4">
        <button
          onClick={() => setFilterTab(filterTab === 'payable' ? 'all' : 'payable')}
          className={`p-4 sm:p-5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
            filterTab === 'payable' || filterTab === 'all'
              ? 'border-[#522D60] bg-[#522D60] text-white shadow-md'
              : 'border-gray-100 bg-white hover:border-[#522D60]/30 shadow-card'
          }`}
        >
          <div className="flex items-center gap-2.5 mb-2">
            <div
              className={`p-1.5 rounded-lg ${
                filterTab === 'payable' || filterTab === 'all' ? 'bg-white/20' : 'bg-purple-50'
              }`}
            >
              <TrendingUp
                className={`w-4 h-4 ${
                  filterTab === 'payable' || filterTab === 'all' ? 'text-white' : 'text-[#522D60]'
                }`}
              />
            </div>
            <span className="font-bold text-xs sm:text-sm">Total Payable</span>
          </div>
          <p
            className={`text-xl sm:text-2xl font-black tabular-nums ${
              filterTab === 'payable' || filterTab === 'all' ? 'text-white' : 'text-gray-900'
            }`}
          >
            Rs. {totalPayable.toLocaleString()}
          </p>
          <p
            className={`text-[11px] mt-1 font-medium ${
              filterTab === 'payable' || filterTab === 'all' ? 'text-white/80' : 'text-gray-400'
            }`}
          >
            You owe {payableCount} supplier{payableCount === 1 ? '' : 's'}
          </p>
        </button>

        <button
          onClick={() => setFilterTab(filterTab === 'settled' ? 'all' : 'settled')}
          className={`p-4 sm:p-5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
            filterTab === 'settled'
              ? 'border-[#522D60] bg-[#522D60] text-white shadow-md'
              : 'border-gray-100 bg-white hover:border-[#522D60]/30 shadow-card'
          }`}
        >
          <div className="flex items-center gap-2.5 mb-2">
            <div className={`p-1.5 rounded-lg ${filterTab === 'settled' ? 'bg-white/20' : 'bg-gray-100'}`}>
              <Users className={`w-4 h-4 ${filterTab === 'settled' ? 'text-white' : 'text-gray-700'}`} />
            </div>
            <span className="font-bold text-xs sm:text-sm">Total Suppliers</span>
          </div>
          <p
            className={`text-xl sm:text-2xl font-black tabular-nums ${
              filterTab === 'settled' ? 'text-white' : 'text-gray-900'
            }`}
          >
            {suppliers.length}
          </p>
          <p
            className={`text-[11px] mt-1 font-medium ${
              filterTab === 'settled' ? 'text-white/80' : 'text-gray-400'
            }`}
          >
            {suppliers.length - payableCount} settled account{suppliers.length - payableCount === 1 ? '' : 's'}
          </p>
        </button>
      </div>

      {/* SEARCH + ADD BUTTON */}
      <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by supplier name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm text-gray-900 focus:outline-none focus:border-[#522D60] focus:ring-1 focus:ring-[#522D60] shadow-sm transition-all"
          />
        </div>
        <Button
          variant="primary"
          onClick={() => setShowAddSupplier(true)}
          className="bg-[#522D60] hover:bg-[#42244D] text-white px-4 py-2.5 text-xs sm:text-sm shrink-0"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          <span>Add Supplier</span>
        </Button>
      </div>

      {/* SUPPLIERS LIST */}
      <div className="space-y-2 pb-8">
        {loading ? (
          <p className="text-center text-gray-500 py-8">Loading...</p>
        ) : filteredSuppliers.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No suppliers found.</p>
        ) : (
          filteredSuppliers.map((sup) => {
            const bal = Math.max(0, Number(sup.totalBalance) || 0);
            return (
              <motion.div
                key={sup.id}
                whileHover={{ x: 2 }}
                onClick={() => navigate(`/suppliers/${sup.id}`)}
                className="bg-white rounded-2xl p-3.5 sm:p-4 shadow-card cursor-pointer hover:shadow-card-hover transition-all border border-gray-100 hover:border-[#522D60]/20 flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-full bg-purple-100 text-[#522D60] flex items-center justify-center font-black text-sm shrink-0 shadow-2xs">
                    {sup.name?.[0]?.toUpperCase() || 'S'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm sm:text-base leading-snug truncate">
                      {sup.name}
                    </p>
                    <p className="text-xs text-gray-400 font-mono truncate mt-0.5">
                      {sup.phone || 'No phone'}
                    </p>
                  </div>

                  <div className="text-right shrink-0 pl-1">
                    <p
                      className={`font-black text-sm sm:text-base tracking-tight tabular-nums ${
                        bal > 0 ? 'text-rose-600' : 'text-gray-800'
                      }`}
                    >
                      Rs. {bal.toLocaleString()}
                    </p>
                    <p className="text-[11px] font-medium text-gray-400 leading-none mt-0.5">
                      {bal > 0 ? 'you owe' : 'settled'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    title="Edit Supplier"
                    onClick={(e) => handleOpenEdit(sup, e)}
                    className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    title="Delete Supplier"
                    onClick={(e) => handleOpenDelete(sup, e)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-gray-300 ml-0.5 hidden sm:block" />
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* ADD SUPPLIER MODAL */}
      <AnimatePresence>
        {showAddSupplier && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
              onClick={() => setShowAddSupplier(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-50 w-full sm:max-w-md bg-white sm:rounded-2xl shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <h3 className="text-lg font-bold">Add Supplier</h3>
                <button onClick={() => setShowAddSupplier(false)}>
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="p-6">
                <form onSubmit={handleAddSupplier} className="space-y-4">
                  <Input
                    label="Supplier Name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <Input
                    label="Phone Number (Optional)"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1 ml-1">
                      Notes (Optional)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-forest resize-none"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    isLoading={isAdding}
                    disabled={isAdding}
                  >
                    Save Supplier
                  </Button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* EDIT SUPPLIER MODAL */}
      <Modal
        isOpen={!!supplierToEdit}
        onClose={() => setSupplierToEdit(null)}
        title="Edit Supplier"
        size="md"
      >
        {supplierToEdit && (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <Input
              label="Supplier Name"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
            <Input
              label="Phone Number"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
            />
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 ml-1">
                Notes (Optional)
              </label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-forest resize-none"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                disabled={isSavingEdit}
                onClick={() => setSupplierToEdit(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="flex-1"
                isLoading={isSavingEdit}
                disabled={isSavingEdit}
              >
                Save Changes
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* DELETE SUPPLIER CONFIRMATION MODAL */}
      <Modal
        isOpen={!!supplierToDelete}
        onClose={() => setSupplierToDelete(null)}
        title="Delete Supplier"
        size="sm"
      >
        {supplierToDelete && (
          <div className="space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-gray-900 text-base">Delete this supplier?</h4>
              <p className="text-xs text-gray-500 mt-1">
                Are you sure you want to delete{' '}
                <strong className="text-gray-900">{supplierToDelete.name}</strong> and all of their
                ledger transactions?
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setSupplierToDelete(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                className="flex-1"
                onClick={handleConfirmDelete}
                isLoading={isDeleting}
                disabled={isDeleting}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

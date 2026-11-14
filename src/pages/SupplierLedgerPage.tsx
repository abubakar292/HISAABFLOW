import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  collection,
  query,
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
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownLeft,
  BookOpen,
  Edit2,
  Trash2,
  X,
  AlertTriangle,
  BarChart3,
  Calendar,
  Printer,
  Phone,
} from 'lucide-react';
import {
  format,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  subMonths,
} from 'date-fns';
import { parseDateSafe, formatDateSafe } from '../utils/dateUtils';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { BillPreviewModal } from '../components/ui/BillPreviewModal';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { isDocForShop } from '../utils/multiTenantService';

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

export default function SupplierLedgerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, currentShopId, shopProfile } = useAuth();
  const { success, error } = useToast();

  const [supplier, setSupplier] = useState<any | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [shopMobiles, setShopMobiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Transaction Modal State ('purchase' increases payable, 'payment' decreases payable)
  const [txModalType, setTxModalType] = useState<'purchase' | 'payment' | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isAddingTx, setIsAddingTx] = useState(false);
  const isAddingTxRef = useRef(false);

  // Edit Transaction Modal State
  const [txToEdit, setTxToEdit] = useState<any | null>(null);
  const [editTxType, setEditTxType] = useState<'purchase' | 'payment'>('purchase');
  const [editTxAmount, setEditTxAmount] = useState('');
  const [editTxDescription, setEditTxDescription] = useState('');
  const [editTxDate, setEditTxDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const isSavingEditRef = useRef(false);

  // Delete Transaction Modal State
  const [txToDelete, setTxToDelete] = useState<any | null>(null);
  const [isDeletingTx, setIsDeletingTx] = useState(false);
  const isDeletingTxRef = useRef(false);

  // Edit Supplier Phone Modal
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneToUpdate, setPhoneToUpdate] = useState('');
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const isSavingPhoneRef = useRef(false);

  // Supplier Ledger Date-Range Report Modal (matching Customer Khata 1:1)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportStartDate, setReportStartDate] = useState(() =>
    format(startOfMonth(new Date()), 'yyyy-MM-dd')
  );
  const [reportEndDate, setReportEndDate] = useState(() =>
    format(new Date(), 'yyyy-MM-dd')
  );
  const [reportPreset, setReportPreset] = useState<
    'today' | 'this_week' | 'this_month' | 'last_month' | 'all' | 'custom'
  >('this_month');
  const [reportHasCalculated, setReportHasCalculated] = useState(false);

  // Print Statement Preview Modal
  const [showStatementPreview, setShowStatementPreview] = useState(false);
  const healingRef = useRef(false);

  useEffect(() => {
    if (!id || !user || !currentShopId) return;

    const unsubSup = onSnapshot(
      doc(db, 'suppliers', id),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (isDocForShop(data, currentShopId)) {
            setSupplier({ id: snap.id, ...data });
          }
        }
        setLoading(false);
      },
      () => setLoading(false)
    );

    const txQ = query(
      collection(db, 'supplierTransactions'),
      where('supplierId', '==', id)
    );
    const unsubTxs = onSnapshot(
      txQ,
      (snap) => {
        const list: any[] = [];
        snap.forEach((d) => {
          const data = d.data();
          const rawDate = data.dateStr;
          const parsedDate = rawDate
            ? parseDateSafe(rawDate)
            : parseDateSafe(data.date || data.createdAt);
          const finalDate = parsedDate || parseDateSafe(data.createdAt) || new Date();
          const canonicalDateStr =
            rawDate && typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDate.trim())
              ? rawDate.trim()
              : format(finalDate, 'yyyy-MM-dd');

          list.push({
            id: d.id,
            ...data,
            date: finalDate,
            dateStr: canonicalDateStr,
            createdAt: parseDateSafe(data.createdAt) || finalDate,
          });
        });

        // Sort newest first by calendar day, then by createdAt timestamp
        list.sort((a, b) => {
          const dayA = getTxDayStr(a);
          const dayB = getTxDayStr(b);
          if (dayA !== dayB) return dayB.localeCompare(dayA);
          return getTxCreatedMs(b) - getTxCreatedMs(a);
        });

        setTransactions(list);
        setLoading(false);
      },
      () => setLoading(false)
    );

    const unsubMobiles = onSnapshot(
      collection(db, 'mobiles'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((m: any) => isDocForShop(m, currentShopId));
        setShopMobiles(list);
      },
      () => {}
    );

    return () => {
      unsubSup();
      unsubTxs();
      unsubMobiles();
    };
  }, [id, user, currentShopId]);

  // Self-heal missing mobile purchase entries & recalculate chronological balances accurately
  useEffect(() => {
    if (!id || !user || !currentShopId || !supplier || loading || healingRef.current) return;

    const healLedger = async () => {
      try {
        healingRef.current = true;
        const batch = writeBatch(db);
        let hasChanges = false;
        const workingTxs = [...transactions];

        const supplierMobiles = shopMobiles.filter(
          (m: any) =>
            !m.supplierTxDeleted &&
            m.purchasePaymentType !== 'CashExplicit' &&
            (m.supplierId === id ||
              (m.supplier &&
                supplier.name &&
                String(m.supplier).toLowerCase().trim() ===
                  String(supplier.name).toLowerCase().trim()))
        );

        for (const m of supplierMobiles) {
          const qty = Number(m.initialQuantity || m.quantity) || 1;
          const cost = (Number(m.basePrice) || 0) * Math.max(1, qty);
          if (cost <= 0) continue;

          const alreadyLinked =
            Boolean(m.supplierTxCreated) ||
            workingTxs.some(
              (tx) =>
                tx.linkedMobileId === m.id ||
                (tx.transactionType === 'purchase' &&
                  Number(tx.amount) === cost &&
                  String(tx.description || '').includes(m.imei1 || m.modelName || ''))
            );

          if (!alreadyLinked) {
            const pDate =
              parseDateSafe(m.purchaseDateStr || m.purchaseDate || m.createdAt) || new Date();
            const pDateStr = m.purchaseDateStr || format(pDate, 'yyyy-MM-dd');
            const newTxRef = doc(collection(db, 'supplierTransactions'));
            const newTxObj = {
              id: newTxRef.id,
              shopId: currentShopId,
              userId: user.uid,
              userEmail: (user.email || '').toLowerCase(),
              supplierId: id,
              supplierName: supplier.name || '',
              transactionType: 'purchase',
              amount: cost,
              paymentMethod: 'Credit Purchase',
              description: `${Math.max(1, qty)}x ${m.company || ''} ${m.modelName || ''}${
                m.ramRom ? ` (${m.ramRom})` : ''
              }${m.imei1 ? ` (IMEI: ${m.imei1})` : ''}`.trim(),
              runningBalance: 0,
              linkedMobileId: m.id,
              date: pDate,
              dateStr: pDateStr,
              createdAt: m.createdAt || pDate,
            };
            batch.set(newTxRef, newTxObj);
            batch.update(doc(db, 'mobiles', m.id), { supplierTxCreated: true });
            workingTxs.push(newTxObj);
            hasChanges = true;
          }
        }

        const chronological = [...workingTxs].sort((a, b) => {
          const dayA = getTxDayStr(a);
          const dayB = getTxDayStr(b);
          if (dayA !== dayB) return dayA.localeCompare(dayB);
          return getTxCreatedMs(a) - getTxCreatedMs(b);
        });

        let running = 0;
        for (const tx of chronological) {
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
            hasChanges = true;
          }
        }

        if (chronological.length > 0 && Number(supplier.totalBalance) !== running) {
          batch.update(doc(db, 'suppliers', id), {
            totalBalance: running,
            updatedAt: serverTimestamp(),
          });
          hasChanges = true;
        }

        if (hasChanges) {
          await batch.commit();
        }
      } catch (err) {
        console.warn('Supplier ledger self-heal notice:', err);
      } finally {
        healingRef.current = false;
      }
    };

    healLedger();
  }, [id, user, currentShopId, supplier, transactions, shopMobiles, loading]);

  const recalculateAndSyncLedger = async (updatedList: any[]) => {
    if (!id) return;
    const chronological = [...updatedList].sort((a, b) => {
      const dayA = getTxDayStr(a);
      const dayB = getTxDayStr(b);
      if (dayA !== dayB) return dayA.localeCompare(dayB);
      return getTxCreatedMs(a) - getTxCreatedMs(b);
    });

    let running = 0;
    const batch = writeBatch(db);

    chronological.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      if (tx.transactionType === 'purchase') {
        running = Math.max(0, running) + amt;
      } else {
        running = Math.max(0, running - amt);
      }
      batch.update(doc(db, 'supplierTransactions', tx.id), {
        runningBalance: running,
      });
    });

    batch.update(doc(db, 'suppliers', id), {
      totalBalance: running,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  };

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return error('Please sign in to record transactions');
    if (!id || !amount || !txModalType || !supplier || isAddingTxRef.current || isAddingTx) return;

    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) return error('Please enter a valid amount');

    isAddingTxRef.current = true;
    setIsAddingTx(true);
    try {
      const currentBalance = Math.max(0, Number(supplier.totalBalance) || 0);
      const newBalance =
        txModalType === 'purchase'
          ? currentBalance + amt
          : Math.max(0, currentBalance - amt);

      const safeTxDate = parseDateSafe(date) || new Date();
      const canonicalDateStr = format(safeTxDate, 'yyyy-MM-dd');

      await addDoc(collection(db, 'supplierTransactions'), {
        shopId: currentShopId,
        userId: user.uid,
        userEmail: (user.email || '').toLowerCase(),
        supplierId: id,
        supplierName: supplier.name,
        transactionType: txModalType,
        amount: amt,
        description: description.trim(),
        runningBalance: newBalance,
        date: safeTxDate,
        dateStr: canonicalDateStr,
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'suppliers', id), {
        totalBalance: newBalance,
        updatedAt: serverTimestamp(),
      });

      setTxModalType(null);
      setAmount('');
      setDescription('');
      setDate(format(new Date(), 'yyyy-MM-dd'));
      success('Transaction recorded');
    } catch (err: any) {
      error(err.message || 'Error saving transaction');
    } finally {
      setIsAddingTx(false);
      isAddingTxRef.current = false;
    }
  };

  const handleOpenEditTx = (tx: any) => {
    setTxToEdit(tx);
    setEditTxType(tx.transactionType || 'purchase');
    setEditTxAmount(String(tx.amount || ''));
    setEditTxDescription(tx.description || '');
    setEditTxDate(getTxDayStr(tx));
  };

  const handleSaveEditTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !supplier || !txToEdit || !editTxAmount || isSavingEditRef.current || isSavingEdit)
      return;

    const newAmount = Number(editTxAmount);
    if (isNaN(newAmount) || newAmount <= 0) return error('Enter a valid amount');

    isSavingEditRef.current = true;
    setIsSavingEdit(true);
    try {
      const safeEditDate = parseDateSafe(editTxDate) || new Date();
      const canonicalStr = format(safeEditDate, 'yyyy-MM-dd');

      await updateDoc(doc(db, 'supplierTransactions', txToEdit.id), {
        transactionType: editTxType,
        amount: newAmount,
        description: editTxDescription.trim(),
        date: safeEditDate,
        dateStr: canonicalStr,
        updatedAt: serverTimestamp(),
      });

      const updatedList = transactions.map((t) =>
        t.id === txToEdit.id
          ? {
              ...t,
              transactionType: editTxType,
              amount: newAmount,
              description: editTxDescription.trim(),
              date: safeEditDate,
              dateStr: canonicalStr,
            }
          : t
      );

      await recalculateAndSyncLedger(updatedList);
      success('Transaction updated successfully');
      setTxToEdit(null);
    } catch (err: any) {
      error(err.message || 'Error updating transaction');
    } finally {
      setIsSavingEdit(false);
      isSavingEditRef.current = false;
    }
  };

  const handleConfirmDeleteTx = async () => {
    if (!id || !supplier || !txToDelete || isDeletingTxRef.current || isDeletingTx) return;

    isDeletingTxRef.current = true;
    setIsDeletingTx(true);
    try {
      if (txToDelete.linkedMobileId) {
        await updateDoc(doc(db, 'mobiles', txToDelete.linkedMobileId), {
          supplierTxDeleted: true,
        }).catch(() => {});
      }

      await deleteDoc(doc(db, 'supplierTransactions', txToDelete.id));
      const remaining = transactions.filter((t) => t.id !== txToDelete.id);
      await recalculateAndSyncLedger(remaining);
      success('Transaction deleted');
      setTxToDelete(null);
    } catch (err: any) {
      error(err.message || 'Error deleting transaction');
    } finally {
      setIsDeletingTx(false);
      isDeletingTxRef.current = false;
    }
  };

  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !supplier || isSavingPhoneRef.current || isSavingPhone) return;
    isSavingPhoneRef.current = true;
    setIsSavingPhone(true);
    try {
      await updateDoc(doc(db, 'suppliers', id), {
        phone: phoneToUpdate.trim(),
        updatedAt: serverTimestamp(),
      });
      setSupplier({ ...supplier, phone: phoneToUpdate.trim() });
      success('Supplier phone updated successfully');
      setIsEditingPhone(false);
    } catch (err: any) {
      error(err.message || 'Error updating phone');
    } finally {
      setIsSavingPhone(false);
      isSavingPhoneRef.current = false;
    }
  };

  const applyReportPreset = (
    preset: 'today' | 'this_week' | 'this_month' | 'last_month' | 'all'
  ) => {
    const n = new Date();
    setReportPreset(preset);
    if (preset === 'today') {
      const d = format(n, 'yyyy-MM-dd');
      setReportStartDate(d);
      setReportEndDate(d);
    } else if (preset === 'this_week') {
      setReportStartDate(format(startOfWeek(n, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
      setReportEndDate(format(n, 'yyyy-MM-dd'));
    } else if (preset === 'this_month') {
      setReportStartDate(format(startOfMonth(n), 'yyyy-MM-dd'));
      setReportEndDate(format(endOfMonth(n), 'yyyy-MM-dd'));
    } else if (preset === 'last_month') {
      const lm = subMonths(n, 1);
      setReportStartDate(format(startOfMonth(lm), 'yyyy-MM-dd'));
      setReportEndDate(format(endOfMonth(lm), 'yyyy-MM-dd'));
    } else if (preset === 'all') {
      setReportStartDate('');
      setReportEndDate('');
    }
    setReportHasCalculated(false);
  };

  const reportFilteredTxs = transactions.filter((tx) => {
    const txDateStr = getTxDayStr(tx);
    if (reportStartDate && txDateStr < reportStartDate) return false;
    if (reportEndDate && txDateStr > reportEndDate) return false;
    return true;
  });

  const reportTotalPurchased = reportFilteredTxs
    .filter((tx) => tx.transactionType === 'purchase')
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

  const reportTotalPaid = reportFilteredTxs
    .filter((tx) => tx.transactionType === 'payment')
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

  const statementHtml = useMemo(() => {
    if (!supplier) return '';
    const sName = shopProfile.shopName || 'Mobile Center';
    const totalPurchased = transactions
      .filter((t) => t.transactionType === 'purchase')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const totalPaid = transactions
      .filter((t) => t.transactionType === 'payment')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const rowsHtml = transactions
      .map(
        (t) => `
      <tr>
        <td style="padding:6px 4px;border-bottom:1px solid #e2e8f0;font-size:11px;">${formatDateSafe(
          t.date,
          'dd MMM yyyy'
        )}</td>
        <td style="padding:6px 4px;border-bottom:1px solid #e2e8f0;font-size:11px;">
          <strong>${t.transactionType === 'purchase' ? 'Credit Purchase (+)' : 'Payment Given (-)'}</strong>
          ${t.description ? `<br/><span style="color:#475569;">${t.description}</span>` : ''}
        </td>
        <td style="padding:6px 4px;border-bottom:1px solid #e2e8f0;font-size:11px;text-align:right;font-weight:700;color:${
          t.transactionType === 'purchase' ? '#e11d48' : '#059669'
        };">
          ${t.transactionType === 'purchase' ? '+' : '-'}Rs. ${(Number(t.amount) || 0).toLocaleString()}
        </td>
      </tr>`
      )
      .join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Supplier Statement - ${supplier.name}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 16px; color: #0f172a; }
    .card { max-width: 340px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; padding: 16px; }
    .header { text-align: center; border-bottom: 2px dashed #cbd5e1; padding-bottom: 10px; margin-bottom: 12px; }
    .title { font-size: 16px; font-weight: 800; margin: 0; }
    .sub { font-size: 11px; color: #64748b; margin-top: 2px; }
    .meta { font-size: 12px; margin-bottom: 12px; line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; }
    .summary { margin-top: 12px; border-top: 2px dashed #cbd5e1; padding-top: 10px; font-size: 12px; }
    .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .total { font-size: 14px; font-weight: 800; margin-top: 6px; padding-top: 6px; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <p class="title">${sName}</p>
      <p class="sub">Supplier Ledger Statement</p>
    </div>
    <div class="meta">
      <div><strong>Supplier:</strong> ${supplier.name}</div>
      ${supplier.phone ? `<div><strong>Phone:</strong> ${supplier.phone}</div>` : ''}
      <div><strong>Date:</strong> ${format(new Date(), 'dd MMM yyyy, hh:mm a')}</div>
    </div>
    <table>
      <thead>
        <tr style="background:#f8fafc;text-align:left;font-size:11px;">
          <th style="padding:6px 4px;">Date</th>
          <th style="padding:6px 4px;">Details</th>
          <th style="padding:6px 4px;text-align:right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || '<tr><td colspan="3" style="padding:12px;text-align:center;font-size:11px;">No transactions recorded</td></tr>'}
      </tbody>
    </table>
    <div class="summary">
      <div class="row"><span>Total Purchased:</span><strong>Rs. ${totalPurchased.toLocaleString()}</strong></div>
      <div class="row"><span>Total Paid:</span><strong>Rs. ${totalPaid.toLocaleString()}</strong></div>
      <div class="row total">
        <span>Current Balance Payable:</span>
        <span>Rs. ${Math.max(0, Number(supplier.totalBalance) || 0).toLocaleString()}</span>
      </div>
    </div>
  </div>
</body>
</html>`;
  }, [supplier, transactions, shopProfile.shopName]);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading ledger...</div>;
  if (!supplier) return <div className="p-8 text-center text-red-500">Supplier not found</div>;

  const currentBalance = Math.max(0, Number(supplier.totalBalance) || 0);

  return (
    <div className="max-w-3xl mx-auto pb-12">
      {/* HEADER (Matches Customer Khata 1:1, without WhatsApp) */}
      <div className="flex items-center justify-between gap-3 mb-4 bg-white p-3.5 sm:p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          <button
            onClick={() => navigate('/suppliers')}
            className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors shrink-0 active:scale-95 cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-base sm:text-xl font-black text-gray-900 tracking-tight truncate">
                {supplier.name}
              </h1>
              <button
                onClick={() => {
                  setPhoneToUpdate(supplier.phone || '');
                  setIsEditingPhone(true);
                }}
                title="Edit Phone Number"
                className="p-1 text-gray-400 hover:text-amber-600 rounded-md transition-colors cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-gray-500 font-mono truncate mt-0.5">
              {supplier.phone || 'No phone added'}
            </p>
          </div>
        </div>

        {/* Header Action Group (Reports & Print Statement) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setIsReportModalOpen(true);
              setReportHasCalculated(false);
            }}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#522D60] hover:bg-[#432350] text-white font-bold text-xs sm:text-sm shadow-xs transition-transform active:scale-95 cursor-pointer"
            title="Supplier Ledger Report"
          >
            <BarChart3 className="w-4 h-4 text-purple-200" />
            <span>Reports</span>
          </button>

          <button
            type="button"
            onClick={() => setShowStatementPreview(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs sm:text-sm shadow-xs transition-transform active:scale-95 cursor-pointer"
            title="Print Statement"
          >
            <Printer className="w-4 h-4 text-[#522D60]" />
            <span className="hidden sm:inline">Print</span>
          </button>
        </div>
      </div>

      {/* BALANCE CARD (Matches Customer Khata 1:1) */}
      <div className="rounded-2xl p-4 sm:p-5 mb-4 text-white shadow-lg relative overflow-hidden bg-[#522D60] border border-[#522D60]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <p className="text-[11px] sm:text-xs text-purple-200 uppercase tracking-wider font-bold">
              Current Total Balance
            </p>
            <p className="text-2xl sm:text-3xl font-black mt-0.5 text-white tracking-tight tabular-nums">
              Rs. {currentBalance.toLocaleString()}
            </p>
            <p className="text-xs font-semibold text-amber-300 mt-0.5">
              {currentBalance > 0
                ? 'You Owe Supplier (Payable)'
                : 'Account Settled'}
            </p>
          </div>
        </div>
      </div>

      {/* ACTION BUTTONS (Matches Customer Khata 1:1) */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 mb-4">
        <button
          onClick={() => setTxModalType('purchase')}
          className="py-2.5 px-2 rounded-xl bg-red-50 border border-red-200 text-red-600 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 hover:bg-red-100 transition-colors shadow-2xs active:scale-95 cursor-pointer"
        >
          <ArrowUpRight className="w-4 h-4 shrink-0 stroke-[2.5]" />
          <span>Add Credit Purchase</span>
        </button>
        <button
          onClick={() => setTxModalType('payment')}
          className="py-2.5 px-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 hover:bg-emerald-100 transition-colors shadow-2xs active:scale-95 cursor-pointer"
        >
          <ArrowDownLeft className="w-4 h-4 shrink-0 stroke-[2.5]" />
          <span>Record Payment</span>
        </button>
      </div>

      {/* TRANSACTION HISTORY (Matches Customer Khata 1:1) */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-extrabold text-sm sm:text-base text-gray-900">
            Transaction History
          </h3>
          <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
            {transactions.length} Total Records
          </span>
        </div>

        {transactions.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">No transactions recorded yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Record a Credit Purchase or Payment using the buttons above
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {transactions.map((tx, index) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.3) }}
                className="p-4 hover:bg-amber-50/20 transition-colors space-y-2.5"
              >
                {/* CARD TOP ROW */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                        tx.transactionType === 'purchase'
                          ? 'bg-red-50 text-red-600 border border-red-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {tx.transactionType === 'purchase' ? (
                        <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
                      ) : (
                        <ArrowDownLeft className="w-5 h-5 stroke-[2.5]" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm sm:text-base font-extrabold ${
                            tx.transactionType === 'purchase'
                              ? 'text-red-700'
                              : 'text-emerald-800'
                          }`}
                        >
                          {tx.transactionType === 'purchase'
                            ? 'Credit Purchase'
                            : 'Payment Given'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatDateSafe(tx.date, 'dd MMM yyyy')} •{' '}
                        {formatDateSafe(tx.createdAt, 'hh:mm a')}
                      </p>
                    </div>
                  </div>

                  {/* Amount & Balance */}
                  <div className="text-right shrink-0">
                    <p
                      className={`text-base sm:text-lg font-black tracking-tight tabular-nums ${
                        tx.transactionType === 'purchase'
                          ? 'text-red-600'
                          : 'text-emerald-700'
                      }`}
                    >
                      {tx.transactionType === 'purchase' ? '+' : '-'} Rs.{' '}
                      {(Number(tx.amount) || 0).toLocaleString()}
                    </p>
                    <p className="text-[11px] font-semibold text-gray-400 mt-0.5 tabular-nums">
                      Bal:{' '}
                      <span className="text-gray-800 font-bold">
                        Rs. {(Number(tx.runningBalance) || 0).toLocaleString()}
                      </span>
                    </p>
                  </div>
                </div>

                {/* CARD MIDDLE: Description Note */}
                {tx.description && (
                  <div className="px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-100 text-xs text-gray-700 font-medium break-words">
                    <span className="text-gray-400 mr-1.5 font-normal">Note:</span>
                    {tx.description}
                  </div>
                )}

                {/* CARD BOTTOM: Edit & Delete Buttons */}
                <div className="pt-2 border-t border-gray-100 flex items-center justify-end gap-1">
                  <button
                    type="button"
                    title="Edit Transaction"
                    onClick={() => handleOpenEditTx(tx)}
                    className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-gray-500 hover:text-amber-700 hover:bg-amber-50 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    title="Delete Transaction"
                    onClick={() => setTxToDelete(tx)}
                    className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-gray-500 hover:text-red-700 hover:bg-red-50 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* NEW TRANSACTION MODAL */}
      <AnimatePresence>
        {txModalType && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
              onClick={() => setTxModalType(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-50 w-full sm:max-w-md bg-white sm:rounded-2xl shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-900">
                  {txModalType === 'purchase'
                    ? 'Add Credit Purchase'
                    : 'Record Payment Given'}
                </h3>
                <button onClick={() => setTxModalType(null)}>
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="p-6">
                <form onSubmit={handleTransaction} className="space-y-4">
                  <Input
                    label="Amount (Rs.)"
                    type="number"
                    required
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  <Input
                    label="Date"
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1 ml-1">
                      Description (Optional)
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      placeholder={
                        txModalType === 'purchase'
                          ? 'e.g. Purchased mobile stock'
                          : 'e.g. Paid cash / bank transfer'
                      }
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-forest resize-none"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    variant={txModalType === 'purchase' ? 'danger' : 'primary'}
                    isLoading={isAddingTx}
                    disabled={isAddingTx}
                  >
                    Save Transaction
                  </Button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* EDIT TRANSACTION MODAL */}
      <Modal
        isOpen={!!txToEdit}
        onClose={() => setTxToEdit(null)}
        title="Edit Transaction"
        size="md"
      >
        {txToEdit && (
          <form onSubmit={handleSaveEditTx} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 ml-1">
                Transaction Type
              </label>
              <select
                value={editTxType}
                onChange={(e) => setEditTxType(e.target.value as any)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-forest"
              >
                <option value="purchase">Credit Purchase (Increases Payable)</option>
                <option value="payment">Payment Given (Reduces Payable)</option>
              </select>
            </div>
            <Input
              label="Amount (Rs.)"
              type="number"
              required
              min="1"
              value={editTxAmount}
              onChange={(e) => setEditTxAmount(e.target.value)}
            />
            <Input
              label="Date"
              type="date"
              required
              value={editTxDate}
              onChange={(e) => setEditTxDate(e.target.value)}
            />
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 ml-1">
                Description (Optional)
              </label>
              <textarea
                value={editTxDescription}
                onChange={(e) => setEditTxDescription(e.target.value)}
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
                onClick={() => setTxToEdit(null)}
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

      {/* DELETE TRANSACTION CONFIRMATION MODAL */}
      <Modal
        isOpen={!!txToDelete}
        onClose={() => setTxToDelete(null)}
        title="Delete Transaction"
        size="sm"
      >
        {txToDelete && (
          <div className="space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-gray-900 text-base">
                Delete this transaction?
              </h4>
              <p className="text-xs text-gray-500 mt-1">
                Are you sure you want to delete the{' '}
                <span className="font-semibold text-gray-800">
                  {txToDelete.transactionType === 'purchase'
                    ? 'Credit Purchase'
                    : 'Payment Given'}
                </span>{' '}
                transaction of{' '}
                <span className="font-bold text-gray-900">
                  Rs. {Number(txToDelete.amount || 0).toLocaleString()}
                </span>
                ? The supplier balance will automatically update.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setTxToDelete(null)}
                disabled={isDeletingTx}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                className="flex-1"
                onClick={handleConfirmDeleteTx}
                isLoading={isDeletingTx}
                disabled={isDeletingTx}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* EDIT SUPPLIER PHONE MODAL */}
      <Modal
        isOpen={isEditingPhone}
        onClose={() => setIsEditingPhone(false)}
        title="Supplier Phone Number"
        size="sm"
      >
        <form onSubmit={handleSavePhone} className="space-y-4">
          <div className="text-center pb-1">
            <div className="w-11 h-11 rounded-full bg-purple-100 text-[#522D60] flex items-center justify-center mx-auto mb-2">
              <Phone className="w-5 h-5" />
            </div>
            <p className="text-xs text-slate-500">
              Update contact number for{' '}
              <strong className="text-slate-800">{supplier?.name}</strong>.
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Phone Number *
            </label>
            <Input
              type="text"
              placeholder="03001234567"
              value={phoneToUpdate}
              onChange={(e) => setPhoneToUpdate(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setIsEditingPhone(false)}
              disabled={isSavingPhone}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              isLoading={isSavingPhone}
              disabled={isSavingPhone}
            >
              Save Number
            </Button>
          </div>
        </form>
      </Modal>

      {/* SUPPLIER LEDGER DATE RANGE REPORT MODAL (Matches Customer Khata 1:1) */}
      <Modal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        title="Supplier Ledger Report"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-purple-50/80 border border-purple-100 rounded-xl">
            <div className="w-10 h-10 rounded-xl bg-[#522D60] text-white flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
              {supplier?.name?.slice(0, 1)?.toUpperCase() || 'S'}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-extrabold text-sm text-gray-900 truncate">
                {supplier?.name}
              </h4>
              <p className="text-xs text-purple-900/80 font-medium truncate">
                Current Total Balance:{' '}
                <span className="font-bold">
                  Rs. {currentBalance.toLocaleString()}
                </span>
              </p>
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              Select Time Period
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {[
                { id: 'today', label: 'Today' },
                { id: 'this_week', label: 'Week' },
                { id: 'this_month', label: 'Month' },
                { id: 'last_month', label: 'Last M.' },
                { id: 'all', label: 'All Time' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyReportPreset(p.id as any)}
                  className={`py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    reportPreset === p.id
                      ? 'bg-[#522D60] text-white border-[#522D60] shadow-xs'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Starting Date & Ending Date Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#522D60]" />
                Starting Date
              </label>
              <input
                type="date"
                value={reportStartDate}
                onChange={(e) => {
                  setReportStartDate(e.target.value);
                  setReportPreset('custom');
                  setReportHasCalculated(false);
                }}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-gray-900 focus:border-[#522D60] focus:ring-1 focus:ring-[#522D60] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#522D60]" />
                Ending Date
              </label>
              <input
                type="date"
                value={reportEndDate}
                onChange={(e) => {
                  setReportEndDate(e.target.value);
                  setReportPreset('custom');
                  setReportHasCalculated(false);
                }}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-gray-900 focus:border-[#522D60] focus:ring-1 focus:ring-[#522D60] outline-none"
              />
            </div>
          </div>

          {/* Show Report Button */}
          <Button
            type="button"
            onClick={() => setReportHasCalculated(true)}
            className="w-full bg-[#522D60] hover:bg-[#432350] text-white font-bold py-2.5 rounded-xl shadow-md"
          >
            Show Report
          </Button>

          {/* 2 Result Boxes: PURCHASED & PAID */}
          <div className="pt-2 border-t border-gray-100 space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="font-semibold">
                {reportStartDate || reportEndDate
                  ? `${reportStartDate ? formatDateSafe(reportStartDate, 'dd MMM yyyy') : 'Start'} → ${
                      reportEndDate ? formatDateSafe(reportEndDate, 'dd MMM yyyy') : 'Today'
                    }`
                  : 'All Time Summary'}
              </span>
              <span className="font-bold text-[#522D60] bg-purple-50 px-2 py-0.5 rounded-md">
                {reportFilteredTxs.length} Entries
              </span>
            </div>

            <div
              className={`grid grid-cols-2 gap-3 transition-all ${
                reportHasCalculated ? 'ring-2 ring-[#522D60]/20 rounded-2xl p-1' : ''
              }`}
            >
              {/* Box 1: PURCHASED */}
              <div className="rounded-2xl p-4 bg-red-50 border-2 border-red-200/80 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-red-700">
                    PURCHASED
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                    <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                  </div>
                </div>
                <p className="text-lg sm:text-2xl font-black text-red-700 tracking-tight break-words tabular-nums">
                  Rs. {reportTotalPurchased.toLocaleString()}
                </p>
                <p className="text-[11px] font-semibold text-red-600/80 mt-1">
                  Credit Purchase (+)
                </p>
              </div>

              {/* Box 2: PAID */}
              <div className="rounded-2xl p-4 bg-emerald-50 border-2 border-emerald-200/80 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-emerald-800">
                    PAID
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
                  </div>
                </div>
                <p className="text-lg sm:text-2xl font-black text-emerald-800 tracking-tight break-words tabular-nums">
                  Rs. {reportTotalPaid.toLocaleString()}
                </p>
                <p className="text-[11px] font-semibold text-emerald-700/80 mt-1">
                  Payment Given (-)
                </p>
              </div>
            </div>

            {/* Period Net Difference Bar */}
            <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between text-xs">
              <span className="font-bold text-gray-600">
                Period Difference (Purchased − Paid):
              </span>
              <span
                className={`font-black text-sm tabular-nums ${
                  reportTotalPurchased - reportTotalPaid >= 0
                    ? 'text-red-600'
                    : 'text-emerald-700'
                }`}
              >
                Rs.{' '}
                {Math.abs(
                  reportTotalPurchased - reportTotalPaid
                ).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </Modal>

      {/* PRINTABLE SUPPLIER STATEMENT MODAL */}
      <BillPreviewModal
        isOpen={showStatementPreview}
        onClose={() => setShowStatementPreview(false)}
        htmlContent={statementHtml}
        title={`Supplier Statement - ${supplier.name}`}
        billNumber={`SUP-${supplier.id.substring(0, 6).toUpperCase()}`}
      />
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { collection, query, getDocs, addDoc, doc, getDoc, updateDoc, deleteDoc, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, MessageCircle, ArrowUpRight, ArrowDownLeft, BookOpen, X, Edit2, Trash2, AlertTriangle, PhoneCall, Calendar, RotateCcw } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, startOfWeek, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { parseDateSafe, formatDateSafe } from '../utils/dateUtils';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { isDocForShop } from '../utils/multiTenantService';
import { getWhatsAppKhataUrl, getWhatsAppTransactionUrl } from '../config/shopConfig';

export type DatePreset = 'all' | 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'custom';

export default function CustomerLedgerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, currentShopId, shopProfile } = useAuth();
  const [customer, setCustomer] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { success, error } = useToast();

  // Date Filter State
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Quick Customer Phone Edit
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneToUpdate, setPhoneToUpdate] = useState('');
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const isSavingPhoneRef = useRef(false);
  
  // Modal State for New Transaction
  const [txModalType, setTxModalType] = useState<'udhar' | 'wasooli' | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isAddingTx, setIsAddingTx] = useState(false);
  const isAddingTxRef = useRef(false);

  // Edit Transaction State
  const [txToEdit, setTxToEdit] = useState<any>(null);
  const [editTxType, setEditTxType] = useState<'udhar' | 'wasooli'>('udhar');
  const [editTxAmount, setEditTxAmount] = useState('');
  const [editTxDescription, setEditTxDescription] = useState('');
  const [editTxDate, setEditTxDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const isSavingEditRef = useRef(false);

  // Delete Transaction State
  const [txToDelete, setTxToDelete] = useState<any>(null);
  const [isDeletingTx, setIsDeletingTx] = useState(false);
  const isDeletingTxRef = useRef(false);

  useEffect(() => {
    if (id && user) fetchLedgerData();
  }, [id, user]);

  const fetchLedgerData = async () => {
    if (!id || !user) return;
    try {
      const docRef = doc(db, 'khata', id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const custData = snap.data();
        if (!isDocForShop(custData, currentShopId)) {
          error("Customer not found in this shop");
          navigate('/khata');
          return;
        }
        setCustomer({ id: snap.id, ...custData });
      } else {
        error("Customer not found");
        navigate('/khata');
        return;
      }

      const txQuery = query(collection(db, 'khataTransactions'), where('khataId', '==', id));
      const txSnap = await getDocs(txQuery);
      const txs: any[] = [];
      txSnap.forEach(d => {
        const data = d.data();
        const rawDate = data.dateStr || data.saleDate;
        let parsedDate = rawDate ? parseDateSafe(rawDate) : parseDateSafe(data.date);
        // Fix legacy records saved via `new Date("YYYY-MM-DD")` which stored 00:00:00.000 UTC
        // and shifted to the previous day in negative UTC offsets
        if (
          !rawDate &&
          parsedDate &&
          parsedDate.getUTCHours() === 0 &&
          parsedDate.getUTCMinutes() === 0 &&
          parsedDate.getUTCSeconds() === 0 &&
          parsedDate.getUTCMilliseconds() === 0
        ) {
          parsedDate = new Date(
            parsedDate.getUTCFullYear(),
            parsedDate.getUTCMonth(),
            parsedDate.getUTCDate(),
            12,
            0,
            0
          );
        }
        const finalDate = parsedDate || parseDateSafe(data.createdAt) || new Date();
        const canonicalDateStr = rawDate && typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDate.trim())
          ? rawDate.trim()
          : format(finalDate, 'yyyy-MM-dd');

        txs.push({
          id: d.id,
          ...data,
          date: finalDate,
          dateStr: canonicalDateStr,
          saleDate: canonicalDateStr,
          createdAt: parseDateSafe(data.createdAt) || new Date(),
        });
      });
      // Sort by date descending client-side
      txs.sort((a, b) => b.date.getTime() - a.date.getTime());
      setTransactions(txs);
    } catch (e: any) {
      console.error(e);
      error(e.message || 'Error fetching ledger data');
    } finally {
      setLoading(false);
    }
  };

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return error('Please sign in to record transactions');
    if (!id || !amount || !txModalType || !customer || isAddingTxRef.current || isAddingTx) return;
    
    isAddingTxRef.current = true;
    setIsAddingTx(true);
    try {
      const amt = Number(amount);
      const currentBalance = customer.totalBalance || 0;
      const newBalance = txModalType === 'udhar' ? currentBalance + amt : currentBalance - amt;

      const safeTxDate = parseDateSafe(date) || new Date();
      const canonicalDateStr = format(safeTxDate, 'yyyy-MM-dd');

      const newTx = {
        shopId: currentShopId,
        userId: user.uid,
        userEmail: (user.email || '').toLowerCase(),
        khataId: id,
        customerName: customer.name,
        transactionType: txModalType,
        amount: amt,
        description,
        runningBalance: newBalance,
        date: safeTxDate,
        dateStr: canonicalDateStr,
        saleDate: canonicalDateStr,
        createdAt: serverTimestamp(),
      };

      // Save transaction
      const docRef = await addDoc(collection(db, 'khataTransactions'), newTx);
      
      // Update customer balance
      await updateDoc(doc(db, 'khata', id), { totalBalance: newBalance });

      // Optimistic UI Update
      setCustomer({ ...customer, totalBalance: newBalance });
      setTransactions([{
        id: docRef.id,
        ...newTx,
        date: safeTxDate,
        dateStr: canonicalDateStr,
        saleDate: canonicalDateStr,
        createdAt: new Date(),
      }, ...transactions].sort((a, b) => b.date.getTime() - a.date.getTime()));

      setTxModalType(null);
      setAmount('');
      setDescription('');
      setDate(format(new Date(), 'yyyy-MM-dd'));
      success('Transaction recorded');
    } catch (err: any) {
      console.error(err);
      error(err.message || 'Error saving transaction');
    } finally {
      setIsAddingTx(false);
      isAddingTxRef.current = false;
    }
  };

  // Open Edit Modal for a Transaction
  const handleOpenEditTx = (tx: any) => {
    setTxToEdit(tx);
    setEditTxType(tx.transactionType);
    setEditTxAmount(String(tx.amount || ''));
    setEditTxDescription(tx.description || '');
    setEditTxDate(format(tx.date, 'yyyy-MM-dd'));
  };

  // Save Edited Transaction & Recalculate Balance
  const handleSaveEditTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !customer || !txToEdit || !editTxAmount || isSavingEditRef.current || isSavingEdit) return;

    isSavingEditRef.current = true;
    setIsSavingEdit(true);
    try {
      const newAmount = Number(editTxAmount);
      const oldAmount = Number(txToEdit.amount) || 0;
      const oldType = txToEdit.transactionType;

      // Calculate balance delta
      // Previously: if old was 'udhar', it added +oldAmount; if 'wasooli', it subtracted -oldAmount
      // Now: if new is 'udhar', +newAmount; if 'wasooli', -newAmount
      const oldDelta = oldType === 'udhar' ? oldAmount : -oldAmount;
      const newDelta = editTxType === 'udhar' ? newAmount : -newAmount;
      const balanceChange = newDelta - oldDelta;

      const currentBalance = customer.totalBalance || 0;
      const updatedTotalBalance = currentBalance + balanceChange;

      // Update the transaction in Firestore
      const safeEditDate = parseDateSafe(editTxDate) || new Date();
      const txRef = doc(db, 'khataTransactions', txToEdit.id);
      await updateDoc(txRef, {
        transactionType: editTxType,
        amount: newAmount,
        description: editTxDescription,
        date: safeEditDate,
        dateStr: format(safeEditDate, 'yyyy-MM-dd'),
        runningBalance: updatedTotalBalance,
        updatedAt: serverTimestamp()
      });

      // Update customer totalBalance
      await updateDoc(doc(db, 'khata', id), { totalBalance: updatedTotalBalance });

      success('Transaction updated successfully');
      setTxToEdit(null);
      fetchLedgerData();
    } catch (err: any) {
      console.error(err);
      error(err.message || 'Error updating transaction');
    } finally {
      setIsSavingEdit(false);
      isSavingEditRef.current = false;
    }
  };

  // Open Delete Confirmation for a Transaction
  const handleOpenDeleteTx = (tx: any) => {
    setTxToDelete(tx);
  };

  // Delete Transaction & Revert its impact on customer balance
  const handleConfirmDeleteTx = async () => {
    if (!id || !customer || !txToDelete || isDeletingTxRef.current || isDeletingTx) return;

    isDeletingTxRef.current = true;
    setIsDeletingTx(true);
    try {
      const txAmt = Number(txToDelete.amount) || 0;
      const currentBalance = customer.totalBalance || 0;
      // Revert the transaction:
      // If deleted tx was 'udhar', it had added to balance, so subtract it now.
      // If deleted tx was 'wasooli', it had subtracted from balance, so add it back now.
      const updatedTotalBalance = txToDelete.transactionType === 'udhar'
        ? currentBalance - txAmt
        : currentBalance + txAmt;

      // Delete transaction doc
      await deleteDoc(doc(db, 'khataTransactions', txToDelete.id));

      // Update customer totalBalance
      await updateDoc(doc(db, 'khata', id), { totalBalance: updatedTotalBalance });

      success('Transaction deleted');
      setTxToDelete(null);
      fetchLedgerData();
    } catch (err: any) {
      console.error(err);
      error(err.message || 'Error deleting transaction');
    } finally {
      setIsDeletingTx(false);
      isDeletingTxRef.current = false;
    }
  };

  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !customer || isSavingPhoneRef.current || isSavingPhone) return;
    isSavingPhoneRef.current = true;
    setIsSavingPhone(true);
    try {
      await updateDoc(doc(db, 'khata', id), {
        phone: phoneToUpdate.trim(),
        updatedAt: serverTimestamp()
      });
      setCustomer({ ...customer, phone: phoneToUpdate.trim() });
      success('Customer phone updated successfully');
      setIsEditingPhone(false);
    } catch (err: any) {
      error(err.message || 'Error updating phone');
    } finally {
      setIsSavingPhone(false);
      isSavingPhoneRef.current = false;
    }
  };

  // Date Range Calculation for Period Filter using canonical YYYY-MM-DD strings
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  let startStr: string | null = null;
  let endStr: string | null = null;
  let periodLabel = 'All Time';

  if (datePreset === 'today') {
    startStr = todayStr;
    endStr = todayStr;
    periodLabel = `Today (${format(now, 'dd MMM')})`;
  } else if (datePreset === 'yesterday') {
    const yest = subDays(now, 1);
    const yestStr = format(yest, 'yyyy-MM-dd');
    startStr = yestStr;
    endStr = yestStr;
    periodLabel = `Yesterday (${format(yest, 'dd MMM')})`;
  } else if (datePreset === 'this_week') {
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    startStr = format(weekStart, 'yyyy-MM-dd');
    endStr = todayStr;
    periodLabel = `This Week (${format(weekStart, 'dd MMM')} - Today)`;
  } else if (datePreset === 'this_month') {
    startStr = format(startOfMonth(now), 'yyyy-MM-dd');
    endStr = format(endOfMonth(now), 'yyyy-MM-dd');
    periodLabel = `This Month (${format(now, 'MMM yyyy')})`;
  } else if (datePreset === 'last_month') {
    const lastM = subMonths(now, 1);
    startStr = format(startOfMonth(lastM), 'yyyy-MM-dd');
    endStr = format(endOfMonth(lastM), 'yyyy-MM-dd');
    periodLabel = `Last Month (${format(lastM, 'MMM yyyy')})`;
  } else if (datePreset === 'custom') {
    if (customStartDate) startStr = customStartDate.trim();
    if (customEndDate) endStr = customEndDate.trim();
    periodLabel = customStartDate && customEndDate
      ? `${formatDateSafe(customStartDate, 'dd MMM')} - ${formatDateSafe(customEndDate, 'dd MMM')}`
      : 'Custom Date';
  }

  const filteredTransactions = transactions.filter((tx) => {
    if (datePreset === 'all') return true;
    if (datePreset === 'custom' && !startStr && !endStr) return true;
    const txDateStr =
      tx.dateStr ||
      tx.saleDate ||
      (tx.date instanceof Date
        ? format(tx.date, 'yyyy-MM-dd')
        : format(parseDateSafe(tx.date) || new Date(), 'yyyy-MM-dd'));
    if (startStr && txDateStr < startStr) return false;
    if (endStr && txDateStr > endStr) return false;
    return true;
  });

  const periodGiven = filteredTransactions
    .filter((tx) => tx.transactionType === 'udhar')
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

  const periodGot = filteredTransactions
    .filter((tx) => tx.transactionType === 'wasooli')
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading ledger...</div>;
  if (!customer) return <div className="p-8 text-center text-red-500">Customer not found</div>;

  return (
    <div className="max-w-3xl mx-auto pb-12">
      
      {/* HEADER */}
      <div className="flex items-center justify-between gap-3 mb-4 bg-white p-3.5 sm:p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors shrink-0 active:scale-95 cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-base sm:text-xl font-black text-gray-900 tracking-tight truncate">
                {customer.name}
              </h1>
              <button
                onClick={() => {
                  setPhoneToUpdate(customer.phone || '');
                  setIsEditingPhone(true);
                }}
                title="Edit Phone Number"
                className="p-1 text-gray-400 hover:text-amber-600 rounded-md transition-colors cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-gray-500 font-mono truncate mt-0.5">
              {customer.phone || 'No phone added'}
            </p>
          </div>
        </div>

        {/* WhatsApp Top Button */}
        <div className="shrink-0">
          {customer.phone ? (
            <a
              href={getWhatsAppKhataUrl(customer.phone, customer.name, customer.totalBalance || 0, customer.type)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-xs transition-transform active:scale-95"
            >
              <MessageCircle className="w-4 h-4 fill-white/20" />
              <span>WhatsApp</span>
            </a>
          ) : (
            <button
              onClick={() => {
                setPhoneToUpdate('');
                setIsEditingPhone(true);
              }}
              className="inline-flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-300 shadow-2xs transition-all cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              <span>+ Phone</span>
            </button>
          )}
        </div>
      </div>

      {/* BALANCE CARD */}
      <div className="rounded-2xl p-4 sm:p-5 mb-4 text-white shadow-lg relative overflow-hidden bg-[#522D60] border border-[#522D60]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <p className="text-[11px] sm:text-xs text-purple-200 uppercase tracking-wider font-bold">
              Current Total Balance
            </p>
            <p className="text-2xl sm:text-3xl font-black mt-0.5 text-white tracking-tight">
              Rs. {(customer.totalBalance || 0).toLocaleString()}
            </p>
            <p className="text-xs font-semibold text-amber-300 mt-0.5">
              {customer.type === 'receivable' ? '⚡ Customer Owes You (Receivable)' : '🤝 You Owe Customer (Payable)'}
            </p>
          </div>
        </div>
      </div>

      {/* ACTION BUTTONS */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 mb-4">
        <button
          onClick={() => setTxModalType('udhar')}
          className="py-2.5 px-2 rounded-xl bg-red-50 border border-red-200 text-red-600 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 hover:bg-red-100 transition-colors shadow-2xs active:scale-95 cursor-pointer"
        >
          <ArrowUpRight className="w-4 h-4 shrink-0 stroke-[2.5]" />
          <span>Give Credit</span>
        </button>
        <button
          onClick={() => setTxModalType('wasooli')}
          className="py-2.5 px-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 hover:bg-emerald-100 transition-colors shadow-2xs active:scale-95 cursor-pointer"
        >
          <ArrowDownLeft className="w-4 h-4 shrink-0 stroke-[2.5]" />
          <span>Receive Payment</span>
        </button>
      </div>

      {/* COMPACT DATE FILTER + NON-SQUEEZING GIVEN & GOT BOXES */}
      <div className="bg-white rounded-2xl p-3 sm:p-3.5 mb-4 border border-gray-100 shadow-xs space-y-2.5">
        {/* Row 1: Date Filter Pills with horizontal scroll on mobile */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:flex-wrap">
          {[
            { id: 'all', label: 'All Time' },
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'this_week', label: 'This Week' },
            { id: 'this_month', label: 'This Month' },
            { id: 'last_month', label: 'Last Month' },
            { id: 'custom', label: 'Custom' },
          ].map((p) => {
            const active = datePreset === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setDatePreset(p.id as DatePreset)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                  active
                    ? 'bg-[#522D60] text-white shadow-2xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Custom Date Range Inputs (when Custom is active) */}
        {datePreset === 'custom' && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">From Date</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:border-[#522D60]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">To Date</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:border-[#522D60]"
              />
            </div>
          </div>
        )}

        {/* Row 2: Two Small Compact Non-Squeezing Boxes for Given & Got */}
        <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-gray-100">
          <div className="p-2.5 sm:p-3 rounded-xl bg-rose-50/80 border border-rose-200 flex flex-col justify-center">
            <span className="text-[10px] sm:text-xs font-extrabold text-rose-600 uppercase tracking-wider truncate">
              Given ({datePreset === 'all' ? 'All Time' : periodLabel})
            </span>
            <span className="text-sm sm:text-base font-black text-rose-700 mt-0.5 truncate">
              Rs. {periodGiven.toLocaleString()}
            </span>
          </div>
          <div className="p-2.5 sm:p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 flex flex-col justify-center">
            <span className="text-[10px] sm:text-xs font-extrabold text-emerald-600 uppercase tracking-wider truncate">
              Got ({datePreset === 'all' ? 'All Time' : periodLabel})
            </span>
            <span className="text-sm sm:text-base font-black text-emerald-700 mt-0.5 truncate">
              Rs. {periodGot.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* TRANSACTION HISTORY */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-extrabold text-sm sm:text-base text-gray-900">
            Transaction History
          </h3>
          <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {filteredTransactions.length} Records
          </span>
        </div>
        
        {filteredTransactions.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">No transactions found for {periodLabel}</p>
            {datePreset !== 'all' ? (
              <button
                onClick={() => {
                  setDatePreset('all');
                  setCustomStartDate('');
                  setCustomEndDate('');
                }}
                className="mt-2 text-xs font-bold text-[#522D60] underline cursor-pointer"
              >
                Clear date filter to see all records
              </button>
            ) : (
              <p className="text-xs text-gray-400 mt-1">Record Udhar or Wasooli using buttons above</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredTransactions.map((tx, index) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.3) }}
                className="p-4 hover:bg-amber-50/20 transition-colors space-y-2.5"
              >
                {/* ── CARD TOP ROW: Icon + Title & Date (Left) | Amount & Running Balance (Right) ── */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                      tx.transactionType === 'udhar' 
                        ? 'bg-red-50 text-red-600 border border-red-200' 
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      {tx.transactionType === 'udhar' ? (
                        <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
                      ) : (
                        <ArrowDownLeft className="w-5 h-5 stroke-[2.5]" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm sm:text-base font-extrabold ${
                          tx.transactionType === 'udhar' ? 'text-red-700' : 'text-emerald-800'
                        }`}>
                          {tx.transactionType === 'udhar' ? 'Credit Given' : 'Payment Received'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatDateSafe(tx.date, 'dd MMM yyyy')} • {formatDateSafe(tx.createdAt, 'hh:mm a')}
                      </p>
                    </div>
                  </div>

                  {/* Amount & Balance */}
                  <div className="text-right shrink-0">
                    <p className={`text-base sm:text-lg font-black tracking-tight ${
                      tx.transactionType === 'udhar' ? 'text-red-600' : 'text-emerald-700'
                    }`}>
                      {tx.transactionType === 'udhar' ? '+' : '-'} Rs. {(tx.amount || 0).toLocaleString()}
                    </p>
                    <p className="text-[11px] font-semibold text-gray-400 mt-0.5">
                      Bal: <span className="text-gray-800 font-bold">Rs. {(tx.runningBalance || 0).toLocaleString()}</span>
                    </p>
                  </div>
                </div>

                {/* ── CARD MIDDLE: Description Note (Full Width Bubble) ── */}
                {tx.description && (
                  <div className="px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-100 text-xs text-gray-700 font-medium break-words">
                    <span className="text-gray-400 mr-1.5 font-normal">Note:</span>
                    {tx.description}
                  </div>
                )}

                {/* ── CARD BOTTOM: Action Bar (WhatsApp, Edit, Delete) ── */}
                <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2 flex-wrap">
                  {/* WhatsApp Action Button */}
                  {customer.phone ? (
                    <a
                      href={getWhatsAppTransactionUrl(
                        customer.phone,
                        customer.name,
                        tx.transactionType,
                        tx.amount,
                        tx.description,
                        tx.runningBalance,
                        formatDateSafe(tx.date, 'dd MMM yyyy')
                      )}
                      target="_blank"
                      rel="noreferrer"
                      title="Send WhatsApp update for this transaction"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-transform active:scale-95"
                    >
                      <MessageCircle className="w-3.5 h-3.5 fill-white/20" />
                      <span>WhatsApp Receipt</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      title="No phone number — Click to add phone for 1-Click WhatsApp"
                      onClick={() => {
                        setPhoneToUpdate('');
                        setIsEditingPhone(true);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-50 hover:bg-emerald-50 text-gray-600 hover:text-emerald-700 text-xs font-semibold border border-dashed border-gray-300 transition-colors"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-gray-400" />
                      <span>+ Add Phone (WhatsApp)</span>
                    </button>
                  )}

                  {/* Edit and Delete Buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title="Edit Transaction"
                      onClick={() => handleOpenEditTx(tx)}
                      className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-gray-500 hover:text-amber-700 hover:bg-amber-50 text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span className="hidden xs:inline">Edit</span>
                    </button>
                    <button
                      type="button"
                      title="Delete Transaction"
                      onClick={() => handleOpenDeleteTx(tx)}
                      className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-gray-500 hover:text-red-700 hover:bg-red-50 text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden xs:inline">Delete</span>
                    </button>
                  </div>
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
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
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
                  {txModalType === 'udhar' ? 'Record Credit Given' : 'Record Payment Received'}
                </h3>
                <button onClick={() => setTxModalType(null)}><X className="w-5 h-5 text-gray-500" /></button>
              </div>
              <div className="p-6">
                <form onSubmit={handleTransaction} className="space-y-4">
                  <Input label="Amount (Rs.)" type="number" required min="1" value={amount} onChange={e => setAmount(e.target.value)} />
                  <Input label="Date" type="date" required value={date} onChange={e => setDate(e.target.value)} />
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1 ml-1">Description (Optional)</label>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      rows={2}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-forest resize-none"
                    />
                  </div>
                  <Button type="submit" className="w-full" variant={txModalType === 'udhar' ? 'danger' : 'primary'} isLoading={isAddingTx} disabled={isAddingTx}>
                    Save Transaction
                  </Button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* EDIT TRANSACTION MODAL */}
      <Modal isOpen={!!txToEdit} onClose={() => setTxToEdit(null)} title="Edit Transaction" size="md">
        {txToEdit && (
          <form onSubmit={handleSaveEditTx} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 ml-1">Transaction Type</label>
              <select
                value={editTxType}
                onChange={e => setEditTxType(e.target.value as any)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-forest"
              >
                <option value="udhar">Credit Given (Debit / Customer owes you)</option>
                <option value="wasooli">Payment Received (Credit / From customer)</option>
              </select>
            </div>
            <Input label="Amount (Rs.)" type="number" required min="1" value={editTxAmount} onChange={e => setEditTxAmount(e.target.value)} />
            <Input label="Date" type="date" required value={editTxDate} onChange={e => setEditTxDate(e.target.value)} />
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 ml-1">Description (Optional)</label>
              <textarea
                value={editTxDescription}
                onChange={e => setEditTxDescription(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-forest resize-none"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" className="flex-1" disabled={isSavingEdit} onClick={() => setTxToEdit(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" className="flex-1" isLoading={isSavingEdit} disabled={isSavingEdit}>
                Save Changes
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* DELETE TRANSACTION CONFIRMATION MODAL */}
      <Modal isOpen={!!txToDelete} onClose={() => setTxToDelete(null)} title="Delete Transaction" size="sm">
        {txToDelete && (
          <div className="space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-gray-900 text-base">Delete this transaction?</h4>
              <p className="text-xs text-gray-500 mt-1">
                Are you sure you want to delete the <span className="font-semibold text-gray-800">{txToDelete.transactionType === 'udhar' ? 'Credit Given' : 'Payment Received'}</span> transaction of <span className="font-bold text-gray-900">Rs. {Number(txToDelete.amount || 0).toLocaleString()}</span>? The customer balance will automatically update.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setTxToDelete(null)} disabled={isDeletingTx}>
                Cancel
              </Button>
              <Button type="button" variant="danger" className="flex-1" onClick={handleConfirmDeleteTx} isLoading={isDeletingTx} disabled={isDeletingTx}>
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* EDIT CUSTOMER PHONE MODAL */}
      <Modal isOpen={isEditingPhone} onClose={() => setIsEditingPhone(false)} title="Customer WhatsApp Number" size="sm">
        <form onSubmit={handleSavePhone} className="space-y-4">
          <div className="text-center pb-1">
            <div className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2">
              <MessageCircle className="w-6 h-6 fill-emerald-500/20" />
            </div>
            <p className="text-xs text-slate-500">
              Enter phone number for <strong className="text-slate-800">{customer?.name}</strong> to enable 1-Click WhatsApp reminders and receipts.
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mobile / WhatsApp Number *
            </label>
            <Input
              type="text"
              placeholder="03001234567 or 923001234567"
              value={phoneToUpdate}
              onChange={e => setPhoneToUpdate(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsEditingPhone(false)} disabled={isSavingPhone}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="flex-1" isLoading={isSavingPhone} disabled={isSavingPhone}>
              Save Number
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}


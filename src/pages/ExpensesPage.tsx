import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { isDocForShop } from '../utils/multiTenantService';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { 
  Plus, Search, Edit2, Trash2, AlertCircle, 
  ReceiptText, Building2, Zap, Users, Coffee, Wrench, Package, MoreHorizontal
} from 'lucide-react';
import { format, startOfDay, subDays, startOfWeek, startOfMonth } from 'date-fns';
import { parseDateSafe } from '../utils/dateUtils';

type Expense = {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: Date;
  notes: string;
  createdAt: Date;
};

const CATEGORIES = [
  { id: 'Shop Rent', icon: Building2 },
  { id: 'Electricity & Bills', icon: Zap },
  { id: 'Staff Salary', icon: Users },
  { id: 'Tea & Refreshment', icon: Coffee },
  { id: 'Maintenance', icon: Wrench },
  { id: 'Shop Supplies', icon: Package },
  { id: 'Other Expense', icon: MoreHorizontal },
];

export default function ExpensesPage() {
  const { user, currentShopId } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [salesProfit, setSalesProfit] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month'>('month');

  // Modal State
  const [showFormModal, setShowFormModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const formLoadingRef = useRef(false);

  // Form Fields
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Shop Rent');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');

  // Delete State
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const deleteLoadingRef = useRef(false);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, currentShopId]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const expSnap = await getDocs(collection(db, 'expenses'));
      const list: Expense[] = [];
      expSnap.forEach((d) => {
        const data = d.data();
        if (isDocForShop(data, currentShopId)) {
          list.push({
            id: d.id,
            title: data.title || '',
            amount: Number(data.amount) || 0,
            category: data.category || 'Other Expense',
            date: parseDateSafe(data.date) || new Date(),
            notes: data.notes || '',
            createdAt: parseDateSafe(data.createdAt) || new Date(),
          });
        }
      });
      list.sort((a, b) => b.date.getTime() - a.date.getTime());
      setExpenses(list);

      // Total Sales Profit
      const salesSnap = await getDocs(collection(db, 'sales'));
      let profitSum = 0;
      salesSnap.forEach((d) => {
        const s = d.data();
        if (isDocForShop(s, currentShopId) && s.status !== 'returned') {
          profitSum += (Number(s.profit) || 0);
        }
      });
      setSalesProfit(profitSum);
    } catch (e) {
      console.error('Error fetching expenses:', e);
    } finally {
      setLoading(false);
    }
  };

  // Filtered by Category, Date, and Search
  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const yesterdayStart = startOfDay(subDays(now, 1));
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const monthStart = startOfMonth(now);

    return expenses.filter((e) => {
      // Date filter
      if (dateFilter === 'today' && e.date < todayStart) return false;
      if (dateFilter === 'yesterday' && (e.date < yesterdayStart || e.date >= todayStart)) return false;
      if (dateFilter === 'week' && e.date < weekStart) return false;
      if (dateFilter === 'month' && e.date < monthStart) return false;

      // Category filter
      if (activeCategory !== 'All' && e.category !== activeCategory) return false;

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchTitle = e.title.toLowerCase().includes(term);
        const matchNotes = e.notes.toLowerCase().includes(term);
        const matchCategory = e.category.toLowerCase().includes(term);
        if (!matchTitle && !matchNotes && !matchCategory) return false;
      }

      return true;
    });
  }, [expenses, dateFilter, activeCategory, searchTerm]);

  const totalFilteredExpense = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [filteredExpenses]);

  const allTimeExpenses = useMemo(() => {
    return expenses.reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const netProfit = salesProfit - allTimeExpenses;

  const handleOpenAddModal = () => {
    setExpenseToEdit(null);
    setTitle('');
    setAmount('');
    setCategory('Shop Rent');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setNotes('');
    setShowFormModal(true);
  };

  const handleOpenEditModal = (exp: Expense) => {
    setExpenseToEdit(exp);
    setTitle(exp.title);
    setAmount(exp.amount.toString());
    setCategory(exp.category);
    setDate(format(exp.date, 'yyyy-MM-dd'));
    setNotes(exp.notes);
    setShowFormModal(true);
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || formLoadingRef.current || formLoading) return;
    if (!title.trim() || !amount) return;

    formLoadingRef.current = true;
    setFormLoading(true);
    try {
      const parsedDate = parseDateSafe(date) || new Date();
      if (expenseToEdit) {
        await updateDoc(doc(db, 'expenses', expenseToEdit.id), {
          title: title.trim(),
          amount: Number(amount),
          category,
          date: parsedDate,
          notes: notes.trim(),
        });
      } else {
        await addDoc(collection(db, 'expenses'), {
          shopId: currentShopId,
          userId: user.uid,
          userEmail: (user.email || '').toLowerCase(),
          title: title.trim(),
          amount: Number(amount),
          category,
          date: parsedDate,
          notes: notes.trim(),
          createdAt: serverTimestamp(),
        });
      }
      setShowFormModal(false);
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setFormLoading(false);
      formLoadingRef.current = false;
    }
  };

  const handleDeleteExpense = async () => {
    if (!expenseToDelete || deleteLoadingRef.current || deleteLoading) return;
    deleteLoadingRef.current = true;
    setDeleteLoading(true);
    try {
      await deleteDoc(doc(db, 'expenses', expenseToDelete));
      setExpenseToDelete(null);
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteLoading(false);
      deleteLoadingRef.current = false;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <ReceiptText className="w-6 h-6 text-[#522D60]" />
            <span>Shop Expenses</span>
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Track daily shop overheads, rent, salaries, and net store profit.
          </p>
        </div>
        <Button 
          onClick={handleOpenAddModal} 
          className="bg-[#522D60] text-white self-start sm:self-auto text-xs sm:text-sm px-4 py-2"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Expense
        </Button>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-card">
          <p className="text-xs font-semibold text-gray-500 mb-1">Sales Gross Profit</p>
          <p className="text-lg sm:text-xl font-black text-emerald-600">
            Rs. {salesProfit.toLocaleString()}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-card">
          <p className="text-xs font-semibold text-gray-500 mb-1">Total Expenses</p>
          <p className="text-lg sm:text-xl font-black text-rose-600">
            - Rs. {allTimeExpenses.toLocaleString()}
          </p>
        </div>

        <div className="bg-[#522D60] text-white rounded-2xl p-4 shadow-card">
          <p className="text-xs font-semibold text-purple-200 mb-1">Real Net Profit</p>
          <p className="text-lg sm:text-xl font-black text-white">
            Rs. {netProfit.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Search & Date Filters Container */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-card space-y-3">
        {/* Full-width Search Input */}
        <div className="relative w-full">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search expenses by title, notes, or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 text-xs sm:text-sm text-gray-900 bg-gray-50/50 focus:bg-white focus:outline-none focus:border-[#522D60] focus:ring-1 focus:ring-[#522D60] transition-all"
          />
        </div>

        {/* Date Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'week', label: 'This Week' },
            { id: 'month', label: 'This Month' },
            { id: 'all', label: 'All Time' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setDateFilter(f.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                dateFilter === f.id
                  ? 'bg-[#522D60] text-white shadow-xs'
                  : 'text-gray-600 bg-gray-100/70 hover:bg-gray-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setActiveCategory('All')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeCategory === 'All'
              ? 'bg-[#FAF5FC] text-[#522D60] border border-[#522D60]/30'
              : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          All Categories
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeCategory === cat.id
                ? 'bg-[#FAF5FC] text-[#522D60] border border-[#522D60]/30'
                : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {cat.id}
          </button>
        ))}
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Expense Title</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3 text-right">Amount (PKR)</th>
                <th className="px-5 py-3">Notes</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-400">Loading expenses...</td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-400">No expenses recorded for this period.</td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-purple-50/20 transition-colors">
                    <td className="px-5 py-3 text-gray-600 whitespace-nowrap font-medium">
                      {format(exp.date, 'dd MMM yyyy')}
                    </td>
                    <td className="px-5 py-3 font-bold text-gray-900">
                      {exp.title}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FAF5FC] text-[#522D60] border border-[#522D60]/20">
                        {exp.category}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-black text-rose-600 whitespace-nowrap">
                      Rs. {exp.amount.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-gray-400 max-w-xs truncate">
                      {exp.notes || '-'}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <button 
                        onClick={() => handleOpenEditModal(exp)}
                        className="p-1.5 text-gray-400 hover:text-[#522D60] hover:bg-purple-50 rounded-lg transition-colors mr-1 cursor-pointer"
                        title="Edit Expense"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => setExpenseToDelete(exp.id)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Expense"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredExpenses.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200 text-xs font-bold text-gray-900">
                  <td colSpan={3} className="px-5 py-3">Filtered Total:</td>
                  <td className="px-5 py-3 text-right text-rose-600 font-black">
                    Rs. {totalFilteredExpense.toLocaleString()}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Add / Edit Expense Modal */}
      <Modal
        isOpen={showFormModal}
        onClose={() => !formLoading && setShowFormModal(false)}
        title={expenseToEdit ? 'Edit Expense' : 'Add Shop Expense'}
        size="md"
      >
        <form onSubmit={handleSaveExpense} className="space-y-4">
          <Input
            label="Title / Description"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Monthly Shop Rent"
          />

          <Input
            label="Amount (PKR)"
            type="number"
            required
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 15000"
          />

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 ml-0.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs sm:text-sm text-gray-900 outline-none transition-all focus:border-[#522D60]"
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.id}</option>
              ))}
            </select>
          </div>

          <Input
            label="Date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 ml-0.5">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Paid via Cash to Malik Sahab"
              className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs sm:text-sm text-gray-900 outline-none transition-all focus:border-[#522D60] resize-none"
            />
          </div>

          {/* Non-squeezing responsive button row */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowFormModal(false)}
              disabled={formLoading}
              className="w-full sm:flex-1 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={formLoading}
              isLoading={formLoading}
              className="w-full sm:flex-1 bg-[#522D60] text-white text-xs"
            >
              {expenseToEdit ? 'Update Expense' : 'Save Expense'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(expenseToDelete)}
        onClose={() => !deleteLoading && setExpenseToDelete(null)}
        title="Delete Expense"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2.5 p-3 bg-rose-50 rounded-xl border border-rose-100 text-rose-900 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <p className="font-semibold">Are you sure you want to delete this expense record?</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              variant="secondary"
              onClick={() => setExpenseToDelete(null)}
              disabled={deleteLoading}
              className="w-full sm:flex-1 text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteExpense}
              disabled={deleteLoading}
              isLoading={deleteLoading}
              className="w-full sm:flex-1 text-xs"
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

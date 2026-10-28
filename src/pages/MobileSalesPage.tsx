import { useEffect, useState, useMemo, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, doc, writeBatch, getDoc, getDocs, where, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Button } from '../components/ui/Button';
import { SearchBar } from '../components/ui/SearchBar';
import { Badge } from '../components/ui/Badge';
import { Select } from '../components/ui/Select';
import { useToast } from '../contexts/ToastContext';
import { 
  FileText, Undo2, AlertCircle, Filter, RotateCcw, MessageCircle, 
  Smartphone, ChevronDown, ChevronUp, Layers, CheckCircle2, DollarSign, Bluetooth, X 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  format, isToday, isYesterday, isThisWeek, isThisMonth, 
  startOfDay, endOfDay, isWithinInterval, subMonths 
} from 'date-fns';
import { parseDateSafe, formatDateSafe } from '../utils/dateUtils';
import { getBillHtml } from '../utils/printBill';
import { BillPreviewModal } from '../components/ui/BillPreviewModal';
import { BluetoothPrinterModal } from '../components/ui/BluetoothPrinterModal';
import { getWhatsAppSaleBillUrl } from '../config/shopConfig';
import { useAuth } from '../contexts/AuthContext';
import { isDocForShop } from '../utils/multiTenantService';

const COMPANY_OPTIONS = [
  { value: '', label: 'All Brands / Companies' },
  { value: 'Samsung', label: 'Samsung' },
  { value: 'Apple', label: 'Apple' },
  { value: 'Xiaomi', label: 'Xiaomi / Redmi' },
  { value: 'Infinix', label: 'Infinix' },
  { value: 'Tecno', label: 'Tecno' },
  { value: 'Vivo', label: 'Vivo' },
  { value: 'Oppo', label: 'Oppo' },
  { value: 'Realme', label: 'Realme' },
  { value: 'Itel', label: 'Itel' },
  { value: 'Nokia', label: 'Nokia' },
  { value: 'Other', label: 'Other Brands' },
];

const PAYMENT_OPTIONS = [
  { value: '', label: 'All Payment Methods' },
  { value: 'Cash', label: 'Cash Only' },
  { value: 'Udhar', label: 'Udhar (Khata)' },
  { value: 'Online/Bank', label: 'Online / Bank' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Sales' },
  { value: 'active', label: 'Active Sales (Completed)' },
  { value: 'returned', label: 'Returned Only' },
];

const DATE_PRESETS = [
  { value: 'All', label: 'All Time' },
  { value: 'Today', label: 'Today' },
  { value: 'Yesterday', label: 'Yesterday' },
  { value: 'This Week', label: 'This Week' },
  { value: 'This Month', label: 'This Month' },
  { value: 'Custom Range', label: 'Custom Date Range' },
];

export default function MobileSalesPage() {
  const { user, shopProfile, currentShopId } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filters
  const [search, setSearch] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedPayment, setSelectedPayment] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [dateFilter, setDateFilter] = useState('All');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [customStart, setCustomStart] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Expandable Advanced Filters Panel
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Return modal state & submission guard
  const [saleToReturn, setSaleToReturn] = useState<any | null>(null);
  const [isReturning, setIsReturning] = useState(false);
  const isReturningRef = useRef(false);

  // In-app bill preview state
  const [previewSaleBill, setPreviewSaleBill] = useState<any | null>(null);

  // Bluetooth printer modal state
  const [bluetoothSaleBill, setBluetoothSaleBill] = useState<any | null>(null);

  const { success, error } = useToast();

  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'sales');
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(s => isDocForShop(s, currentShopId));
        list.sort((a: any, b: any) => {
          const da = a.createdAt?.toMillis ? a.createdAt.toMillis() : (parseDateSafe(a.createdAt || a.date)?.getTime() || 0);
          const db = b.createdAt?.toMillis ? b.createdAt.toMillis() : (parseDateSafe(b.createdAt || b.date)?.getTime() || 0);
          return db - da;
        });
        setSales(list);
        setLoading(false);
      },
      (err) => {
        console.warn('MobileSales listener error:', err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, [user, currentShopId]);

  // Calculate active filter count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedCompany) count++;
    if (selectedPayment) count++;
    if (selectedStatus !== 'all') count++;
    if (dateFilter !== 'All') count++;
    if (minPrice) count++;
    if (maxPrice) count++;
    return count;
  }, [selectedCompany, selectedPayment, selectedStatus, dateFilter, minPrice, maxPrice]);

  const resetAllFilters = () => {
    setSearch('');
    setSelectedCompany('');
    setSelectedPayment('');
    setSelectedStatus('all');
    setDateFilter('All');
    setMinPrice('');
    setMaxPrice('');
    setCustomStart(format(new Date(), 'yyyy-MM-dd'));
    setCustomEnd(format(new Date(), 'yyyy-MM-dd'));
  };

  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      // 1. Text Search across Model, Brand/Company, IMEI 1 & 2, Bill #, Customer Name, Phone
      const term = search.toLowerCase().trim();
      if (term) {
        const matchesTerm = (
          (s.customerName && s.customerName.toLowerCase().includes(term)) ||
          (s.customerPhone && s.customerPhone.includes(term)) ||
          (s.phone && s.phone.includes(term)) ||
          (s.itemName && s.itemName.toLowerCase().includes(term)) ||
          (s.name && s.name.toLowerCase().includes(term)) ||
          (s.company && s.company.toLowerCase().includes(term)) ||
          (s.brand && s.brand.toLowerCase().includes(term)) ||
          (s.billNumber && s.billNumber.toLowerCase().includes(term)) ||
          (s.id && s.id.toLowerCase().includes(term)) ||
          (s.imei1 && s.imei1.includes(term)) ||
          (s.imei2 && s.imei2.includes(term))
        );
        if (!matchesTerm) return false;
      }

      // 2. Company / Brand Filter
      if (selectedCompany) {
        const comp = (s.company || s.brand || '').toLowerCase();
        if (selectedCompany === 'Other') {
          const isStandard = ['samsung', 'apple', 'xiaomi', 'infinix', 'tecno', 'vivo', 'oppo', 'realme', 'itel', 'nokia']
            .some(br => comp.includes(br));
          if (isStandard) return false;
        } else if (!comp.includes(selectedCompany.toLowerCase())) {
          return false;
        }
      }

      // 3. Payment Method Filter
      if (selectedPayment) {
        if (selectedPayment === 'Online/Bank') {
          if (s.paymentMethod !== 'Online' && s.paymentMethod !== 'Bank' && s.paymentMethod !== 'Online/Bank') return false;
        } else if (s.paymentMethod !== selectedPayment) {
          return false;
        }
      }

      // 4. Status Filter
      if (selectedStatus === 'active' && s.status === 'returned') return false;
      if (selectedStatus === 'returned' && s.status !== 'returned') return false;

      // 5. Price Range
      const sellPrice = Number(s.sellPrice || 0);
      if (minPrice && sellPrice < Number(minPrice)) return false;
      if (maxPrice && sellPrice > Number(maxPrice)) return false;

      // 6. Date Filter
      const saleDate = parseDateSafe(s.date || s.createdAt) || new Date();
      if (dateFilter === 'Today') {
        if (!isToday(saleDate)) return false;
      } else if (dateFilter === 'Yesterday') {
        if (!isYesterday(saleDate)) return false;
      } else if (dateFilter === 'This Week') {
        if (!isThisWeek(saleDate)) return false;
      } else if (dateFilter === 'This Month') {
        if (!isThisMonth(saleDate)) return false;
      } else if (dateFilter === 'Custom Range') {
        const inInterval = isWithinInterval(saleDate, {
          start: startOfDay(new Date(customStart)),
          end: endOfDay(new Date(customEnd))
        });
        if (!inInterval) return false;
      }

      return true;
    });
  }, [sales, search, selectedCompany, selectedPayment, selectedStatus, dateFilter, minPrice, maxPrice, customStart, customEnd]);

  // Summary Metrics for filtered view
  const totalSales = filteredSales.reduce((acc, s) => acc + (s.status !== 'returned' ? (Number(s.sellPrice) || 0) : 0), 0);
  const totalProfit = filteredSales.reduce((acc, s) => acc + (s.status !== 'returned' ? (Number(s.profit) || 0) : 0), 0);
  const activeSalesCount = filteredSales.filter(s => s.status !== 'returned').length;
  const udharSalesCount = filteredSales.filter(s => s.status !== 'returned' && s.paymentMethod === 'Udhar').length;
  const returnedCount = filteredSales.filter(s => s.status === 'returned').length;

  const handleReturn = async () => {
    if (!saleToReturn || isReturningRef.current || isReturning) return;
    isReturningRef.current = true;
    setIsReturning(true);

    try {
      const batch = writeBatch(db);
      
      // 1. Update sale status in 'sales' collection
      const saleRef = doc(db, 'sales', saleToReturn.id);
      batch.update(saleRef, { 
        status: 'returned',
        returnedAt: serverTimestamp()
      });
      
      // 2. Restore inventory mobile stock
      let targetMobileId = saleToReturn.itemId;
      
      // If itemId is missing or not found, try to locate by imei or modelName
      if (saleToReturn.itemType === 'mobile' && targetMobileId) {
        const mobileRef = doc(db, 'mobiles', targetMobileId);
        const mobileSnap = await getDoc(mobileRef);
        if (mobileSnap.exists()) {
          batch.update(mobileRef, { quantity: increment(1) });
        }
      } else if (saleToReturn.imei1) {
        // Fallback: match by IMEI if available in stock
        try {
          const matchQ = query(collection(db, 'mobiles'), where('imei1', '==', saleToReturn.imei1));
          const matchSnap = await getDocs(matchQ);
          if (!matchSnap.empty) {
            batch.update(doc(db, 'mobiles', matchSnap.docs[0].id), { quantity: increment(1) });
          }
        } catch (findErr) {
          console.warn('Could not match by imei1:', findErr);
        }
      }

      // 3. Mark the linked bill as returned if applicable
      if (saleToReturn.billId) {
        try {
          const billRef = doc(db, 'bills', saleToReturn.billId);
          const billSnap = await getDoc(billRef);
          if (billSnap.exists()) {
            batch.update(billRef, { status: 'returned', returnedAt: serverTimestamp() });
          }
        } catch (bErr) {
          console.warn('Bill update skipped:', bErr);
        }
      }

      // 4. Reverse Khata balance if this sale was on Udhar
      const khataId = saleToReturn.khataCustomerId;
      const salePrice = Number(saleToReturn.sellPrice) || 0;
      if (saleToReturn.paymentMethod === 'Udhar' && khataId && salePrice > 0) {
        try {
          const khataRef = doc(db, 'khata', khataId);
          const khataSnap = await getDoc(khataRef);
          if (khataSnap.exists()) {
            const currentBalance = khataSnap.data().totalBalance || 0;
            const newBalance = Math.max(0, currentBalance - salePrice);
            batch.update(khataRef, { totalBalance: newBalance });

            const txnRef = doc(collection(db, 'khataTransactions'));
            batch.set(txnRef, {
              userId: user?.uid,
              userEmail: (user?.email || '').toLowerCase(),
              khataId,
              customerName: khataSnap.data().name || saleToReturn.customerName,
              transactionType: 'wasooli',
              amount: salePrice,
              description: `Return/Reversal: ${saleToReturn.itemName || 'Mobile'}`,
              runningBalance: newBalance,
              date: new Date(),
              createdAt: serverTimestamp(),
              linkedSaleId: saleToReturn.id
            });
          }
        } catch (khataErr) {
          console.warn('Khata reversal error:', khataErr);
        }
      }
      
      await batch.commit();
      success('Sale marked as returned: stock restored and dashboard updated!');
    } catch (err: any) {
      error(err.message || 'Error returning sale');
    } finally {
      setIsReturning(false);
      isReturningRef.current = false;
      setSaleToReturn(null);
    }
  };

  const handleOpenBluetooth = (sale: any) => {
    setBluetoothSaleBill({
      id: sale.billId || sale.id,
      billNumber: sale.billNumber || sale.id.substring(0, 8).toUpperCase(),
      customerName: sale.customerName,
      customerPhone: sale.customerPhone || sale.phone,
      itemName: sale.itemName,
      company: sale.company || sale.brand,
      imei1: sale.imei1,
      imei2: sale.imei2,
      sellPrice: sale.sellPrice,
      paymentMethod: sale.paymentMethod,
      date: sale.date || sale.createdAt,
      items: [{
        modelName: sale.itemName,
        company: sale.company || sale.brand,
        imei1: sale.imei1,
        imei2: sale.imei2,
        sellPrice: sale.sellPrice,
      }]
    });
  };

  const handleViewBill = (sale: any) => {
    setPreviewSaleBill({
      id: sale.billId || sale.id,
      billNumber: sale.billNumber || sale.id.substring(0, 8).toUpperCase(),
      customerName: sale.customerName,
      customerPhone: sale.customerPhone || sale.phone,
      itemName: sale.itemName,
      company: sale.company || sale.brand,
      imei1: sale.imei1,
      imei2: sale.imei2,
      sellPrice: sale.sellPrice,
      paymentMethod: sale.paymentMethod,
      date: sale.date || sale.createdAt,
      items: [{
        modelName: sale.itemName,
        company: sale.company || sale.brand,
        imei1: sale.imei1,
        imei2: sale.imei2,
        sellPrice: sale.sellPrice,
      }]
    });
  };

  const saleBillHtml = previewSaleBill ? getBillHtml(previewSaleBill, shopProfile) : '';

  const handleWhatsAppForSalePreview = () => {
    if (!previewSaleBill) return;
    const phone = previewSaleBill.customerPhone || '';
    const name = previewSaleBill.customerName || 'Customer';
    const item = previewSaleBill.itemName || 'Mobile Purchase';
    const total = previewSaleBill.sellPrice || 0;
    const method = previewSaleBill.paymentMethod || 'Cash';
    const imei = previewSaleBill.imei1;
    const billNum = previewSaleBill.billNumber || previewSaleBill.id.substring(0, 8).toUpperCase();
    const url = getWhatsAppSaleBillUrl(phone, name, item, total, method, imei, billNum);
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Mobile Sales Record</h1>
          <p className="text-sm text-slate-500 mt-1">Complete history with advance search, IMEI lookup & instant WhatsApp sharing</p>
        </div>
        <div className="flex items-center gap-2">
          {activeFiltersCount > 0 && (
            <button
              onClick={resetAllFilters}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors border border-rose-200"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters ({activeFiltersCount})</span>
            </button>
          )}
          <Button
            variant="secondary"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="flex items-center gap-2 border border-slate-200 bg-white"
          >
            <Filter className="w-4 h-4 text-amber-500" />
            <span>Filters</span>
            {activeFiltersCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-obsidian text-xs font-bold flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
            {showAdvancedFilters ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </Button>
        </div>
      </div>

      {/* TOP STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Revenue */}
        <div className="bg-[#522D60] rounded-2xl p-5 text-white shadow-card border border-[#522D60] relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-purple-200 text-xs font-bold uppercase tracking-wider">Filtered Revenue</p>
              <p className="text-2xl font-black text-white mt-1">Rs. {totalSales.toLocaleString()}</p>
              <p className="text-xs text-purple-200/80 mt-1">From {activeSalesCount} completed sales</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 text-white flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Card 2: Net Profit */}
        <div className="bg-emerald-600 rounded-2xl p-5 text-white shadow-card border border-emerald-600 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-emerald-100 text-xs font-bold uppercase tracking-wider">Total Profit</p>
              <p className="text-2xl font-black text-white mt-1">Rs. {totalProfit.toLocaleString()}</p>
              <p className="text-xs text-emerald-100/80 mt-1">Net earnings on selected sales</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 text-white flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Card 3: Mobile Units Sold */}
        <div className="bg-white rounded-2xl p-5 shadow-card border border-slate-100 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Devices Sold</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{activeSalesCount}</p>
              <p className="text-xs text-slate-500 mt-1">{returnedCount} returned</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#FAF5FC] text-[#522D60] border border-[#522D60]/20 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Card 4: Udhar (Credit) Sales */}
        <div className="bg-white rounded-2xl p-5 shadow-card border border-slate-100 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Udhar Sales</p>
              <p className="text-2xl font-black text-rose-600 mt-1">{udharSalesCount}</p>
              <p className="text-xs text-slate-500 mt-1">Recorded in customer Khata</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* SEARCH AND FILTERS CONTAINER */}
      <div className="bg-white rounded-2xl shadow-card p-5 border border-slate-100 space-y-4">
        
        {/* ROW 1: FULL-WIDTH PRIMARY SEARCH BAR */}
        <div className="w-full">
          <SearchBar 
            value={search} 
            onChange={setSearch} 
            placeholder="Search by Model name, Company, IMEI 1 / 2, Customer name, Phone, Bill #..." 
            className="w-full"
          />
        </div>

        {/* ROW 2: FILTERS & DATE BAR (Organized, clean, mobile-optimized) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-full sm:w-44">
              <Select 
                value={dateFilter} 
                onChange={(e) => setDateFilter(e.target.value)}
                options={DATE_PRESETS}
                className="text-xs font-semibold py-2"
              />
            </div>
            {dateFilter === 'Custom Range' && (
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <input 
                  type="date" 
                  value={customStart} 
                  onChange={e => setCustomStart(e.target.value)} 
                  className="rounded-xl border border-gray-200 px-2.5 py-1.5 text-xs outline-none focus:border-[#522D60]" 
                />
                <span className="text-gray-400 text-xs">to</span>
                <input 
                  type="date" 
                  value={customEnd} 
                  onChange={e => setCustomEnd(e.target.value)} 
                  className="rounded-xl border border-gray-200 px-2.5 py-1.5 text-xs outline-none focus:border-[#522D60]" 
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                showAdvancedFilters || activeFiltersCount > 0
                  ? 'bg-[#FAF5FC] text-[#522D60] border-[#522D60]/30'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>More Filters</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#522D60] text-white text-[10px] flex items-center justify-center font-bold">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {activeFiltersCount > 0 && (
              <button
                onClick={resetAllFilters}
                className="flex items-center gap-1 px-2.5 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* EXPANDABLE ADVANCE FILTER PANEL */}
        <AnimatePresence>
          {showAdvancedFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden border-t border-slate-100 pt-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Brand Filter */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Company / Brand</label>
                  <Select
                    value={selectedCompany}
                    onChange={e => setSelectedCompany(e.target.value)}
                    options={COMPANY_OPTIONS}
                  />
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Method</label>
                  <Select
                    value={selectedPayment}
                    onChange={e => setSelectedPayment(e.target.value)}
                    options={PAYMENT_OPTIONS}
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Sale Status</label>
                  <Select
                    value={selectedStatus}
                    onChange={e => setSelectedStatus(e.target.value)}
                    options={STATUS_OPTIONS}
                  />
                </div>

                {/* Price Range */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Price Range (Rs.)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      value={minPrice}
                      onChange={e => setMinPrice(e.target.value)}
                      className="w-1/2 rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-amber-500"
                    />
                    <span className="text-slate-400 text-xs">-</span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={maxPrice}
                      onChange={e => setMaxPrice(e.target.value)}
                      className="w-1/2 rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Quick Brand Pills */}
              <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-slate-50">
                <span className="text-xs text-slate-400 font-medium mr-1">Quick Brand:</span>
                {['Samsung', 'Apple', 'Xiaomi', 'Infinix', 'Tecno', 'Vivo', 'Oppo'].map((brand) => (
                  <button
                    key={brand}
                    onClick={() => setSelectedCompany(selectedCompany === brand ? '' : brand)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      selectedCompany === brand
                        ? 'bg-amber-500 text-obsidian font-bold shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    {brand}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* RESULTS COUNT & STATUS */}
        <div className="flex justify-between items-center text-xs text-slate-500 pt-1">
          <span>
            Showing <strong className="text-slate-800">{filteredSales.length}</strong> sales records
            {activeFiltersCount > 0 && <span className="text-amber-600 font-medium"> (filtered)</span>}
          </span>
          {activeFiltersCount > 0 && (
            <button
              onClick={resetAllFilters}
              className="text-amber-600 hover:text-amber-700 font-semibold underline underline-offset-2"
            >
              Clear all filters
            </button>
          )}
        </div>

        {/* SALES TABLE */}
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3 font-semibold rounded-tl-xl">Date / Time</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Brand & Model</th>
                <th className="px-4 py-3 font-semibold">IMEI Number</th>
                <th className="px-4 py-3 font-semibold">Cost / Sell</th>
                <th className="px-4 py-3 font-semibold">Profit</th>
                <th className="px-4 py-3 font-semibold">Payment</th>
                <th className="px-4 py-3 font-semibold rounded-tr-xl text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-28"></div></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-36"></div></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-28"></div></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                    <td className="px-4 py-3 text-right"></td>
                  </tr>
                ))
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    <Smartphone className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-700">No mobile sales records match your criteria.</p>
                    <p className="text-xs text-slate-400 mt-1">Try clearing filters or searching another keyword.</p>
                    {activeFiltersCount > 0 && (
                      <Button variant="secondary" size="sm" onClick={resetAllFilters} className="mt-3">
                        Reset Filters
                      </Button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredSales.map((s) => {
                  const compName = s.company || s.brand || 'Samsung';
                  const customerPhone = s.customerPhone || s.phone || '';
                  const billNum = s.billNumber || s.id.substring(0, 8).toUpperCase();

                  return (
                    <tr 
                      key={s.id} 
                      className={`hover:bg-slate-50/70 transition-colors ${s.status === 'returned' ? 'opacity-60 bg-slate-50/50' : ''}`}
                    >
                      {/* Date & Time */}
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        <div className="font-medium text-slate-800">
                          {formatDateSafe(s.date || s.createdAt, 'dd MMM yyyy')}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {formatDateSafe(s.date || s.createdAt, 'hh:mm a')}
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{s.customerName || 'Walk-in Customer'}</div>
                        {customerPhone ? (
                          <div className="text-xs text-slate-500 font-mono">{customerPhone}</div>
                        ) : (
                          <div className="text-[11px] text-slate-400 italic">No phone</div>
                        )}
                      </td>

                      {/* Brand & Model */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/10 text-amber-700 border border-amber-500/20">
                            {compName}
                          </span>
                          {s.itemType === 'quick_sale' && (
                            <Badge variant="warning" className="scale-75 origin-left">Quick</Badge>
                          )}
                        </div>
                        <div className="font-medium text-slate-900 text-sm">
                          {s.itemName || s.name || s.modelName}
                        </div>
                      </td>

                      {/* IMEI 1 & 2 */}
                      <td className="px-4 py-3 font-mono text-xs">
                        {s.imei1 ? (
                          <div>
                            <span className="text-slate-800 font-semibold">{s.imei1}</span>
                            {s.imei2 && <span className="block text-[11px] text-slate-400">IMEI 2: {s.imei2}</span>}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Base / Sell Price */}
                      <td className="px-4 py-3">
                        <div className="text-xs text-slate-400 line-through">Rs. {(s.basePrice || 0).toLocaleString()}</div>
                        <div className="font-bold text-slate-900">Rs. {(s.sellPrice || 0).toLocaleString()}</div>
                      </td>

                      {/* Profit */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                          s.profit >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {s.profit >= 0 ? '+' : ''}Rs. {(s.profit || 0).toLocaleString()}
                        </span>
                      </td>

                      {/* Payment Method & Status */}
                      <td className="px-4 py-3">
                        <Badge variant={s.paymentMethod === 'Cash' ? 'success' : s.paymentMethod === 'Udhar' ? 'warning' : 'cyan'}>
                          {s.paymentMethod || 'Cash'}
                        </Badge>
                        {s.status === 'returned' && (
                          <Badge variant="danger" className="ml-1.5">Returned</Badge>
                        )}
                      </td>

                      {/* Actions: WhatsApp Share, Print Bill, Return */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* 1-Click WhatsApp Share */}
                          {customerPhone && s.status !== 'returned' && (
                            <a
                              href={getWhatsAppSaleBillUrl(
                                customerPhone,
                                s.customerName,
                                s.itemName || `${compName} ${s.modelName || ''}`,
                                s.sellPrice,
                                s.paymentMethod,
                                s.imei1,
                                billNum
                              )}
                              target="_blank"
                              rel="noreferrer"
                              title="Send WhatsApp Bill to customer in 1 click"
                              className="p-1.5 text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200"
                            >
                              <MessageCircle className="w-4 h-4 fill-emerald-500/20" />
                            </a>
                          )}

                          {/* Bluetooth Mini Printer */}
                          <button
                            onClick={() => handleOpenBluetooth(s)}
                            title="Print to Bluetooth Mini Thermal Printer"
                            className="p-1.5 text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
                          >
                            <Bluetooth className="w-4 h-4" />
                          </button>

                          {/* Print / Preview Bill */}
                          <button
                            onClick={() => handleViewBill(s)}
                            title="Print / View Bill Receipt"
                            className="p-1.5 text-slate-600 hover:text-amber-600 bg-slate-50 hover:bg-amber-50 rounded-lg transition-colors border border-slate-200"
                          >
                            <FileText className="w-4 h-4" />
                          </button>

                          {/* Return Sale */}
                          {s.status !== 'returned' && (
                            <button
                              onClick={() => setSaleToReturn(s)}
                              title="Return Sale (Restores inventory stock)"
                              className="p-1.5 text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors border border-rose-200"
                            >
                              <Undo2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RETURN CONFIRMATION MODAL */}
      <AnimatePresence>
        {saleToReturn && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSaleToReturn(null)}
              className="fixed inset-0 bg-black/50 z-40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-50 w-full sm:max-w-md bg-white sm:rounded-2xl shadow-2xl flex flex-col p-6 text-center"
            >
              <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Return Mobile Sale?</h3>
              <p className="text-sm text-gray-500 mb-4">
                Are you sure you want to mark this sale for <strong className="text-gray-800">{saleToReturn.itemName}</strong> (Rs. {(saleToReturn.sellPrice || 0).toLocaleString()}) as returned?
              </p>
              <div className="bg-slate-50 rounded-xl p-3 mb-6 text-xs text-left text-slate-600 space-y-1">
                <div>• Mobile inventory stock will be restored by +1 in real-time.</div>
                <div>• Sale status will be marked as <strong className="text-rose-600">Returned</strong>.</div>
                <div>• Profit and sales amount will be automatically undone from Dashboard and Sales overview.</div>
                {saleToReturn.paymentMethod === 'Udhar' && (
                  <div>• Khata Udhar balance will be reversed for this customer.</div>
                )}
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" disabled={isReturning} onClick={() => setSaleToReturn(null)}>
                  Cancel
                </Button>
                <Button variant="danger" className="flex-1" isLoading={isReturning} disabled={isReturning} onClick={handleReturn}>
                  Confirm Return
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* IN-APP PREVIEW MODAL */}
      <BillPreviewModal
        isOpen={!!previewSaleBill}
        onClose={() => setPreviewSaleBill(null)}
        htmlContent={saleBillHtml}
        title="Sale Receipt Preview"
        billNumber={previewSaleBill?.billNumber || previewSaleBill?.id}
        billData={previewSaleBill}
        onShareWhatsApp={(previewSaleBill?.customerPhone || previewSaleBill?.phone) ? handleWhatsAppForSalePreview : undefined}
      />

      {/* DIRECT BLUETOOTH THERMAL PRINTER MODAL */}
      <BluetoothPrinterModal
        isOpen={!!bluetoothSaleBill}
        onClose={() => setBluetoothSaleBill(null)}
        billData={bluetoothSaleBill}
      />

    </div>
  );
}

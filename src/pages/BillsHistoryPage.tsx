import { useEffect, useState } from 'react';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SearchBar } from '../components/ui/SearchBar';
import { Badge } from '../components/ui/Badge';
import { Select } from '../components/ui/Select';
import { BillPreviewModal } from '../components/ui/BillPreviewModal';
import { BluetoothPrinterModal } from '../components/ui/BluetoothPrinterModal';
import { FileText, MessageCircle, Eye, Bluetooth } from 'lucide-react';
import { format, subDays, isToday, isYesterday, isThisWeek, isThisMonth, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { parseDateSafe, formatDateSafe, getDocDateString } from '../utils/dateUtils';
import { getBillHtml } from '../utils/printBill';
import { getWhatsAppSaleBillUrl } from '../config/shopConfig';
import { useAuth } from '../contexts/AuthContext';
import { isDocForShop } from '../utils/multiTenantService';

export default function BillsHistoryPage() {
  const { user, shopProfile, currentShopId } = useAuth();
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('All');
  const [paymentFilter, setPaymentFilter] = useState('All');
  
  const [customStart, setCustomStart] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));

  // In-app bill preview state
  const [previewBill, setPreviewBill] = useState<any | null>(null);

  // Bluetooth mini printer state
  const [bluetoothBill, setBluetoothBill] = useState<any | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'bills');
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(b => isDocForShop(b, currentShopId));
        list.sort((a: any, b: any) => {
          const da = a.createdAt?.toMillis ? a.createdAt.toMillis() : (parseDateSafe(a.createdAt || a.date)?.getTime() || 0);
          const db = b.createdAt?.toMillis ? b.createdAt.toMillis() : (parseDateSafe(b.createdAt || b.date)?.getTime() || 0);
          return db - da;
        });
        setBills(list);
        setLoading(false);
      },
      (err) => {
        console.warn('BillsHistory listener error:', err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, [user, currentShopId]);

  const filteredBills = bills.filter(b => {
    const term = search.toLowerCase().trim();
    
    // Check inside items array for model name, company/brand, and IMEI
    const matchesItem = b.items?.some((item: any) => 
      (item.name && item.name.toLowerCase().includes(term)) ||
      (item.itemName && item.itemName.toLowerCase().includes(term)) ||
      (item.company && item.company.toLowerCase().includes(term)) ||
      (item.brand && item.brand.toLowerCase().includes(term)) ||
      (item.imei1 && item.imei1.includes(term)) ||
      (item.imei2 && item.imei2.includes(term))
    );

    const matchesSearch = !term || (
      (b.customerName && b.customerName.toLowerCase().includes(term)) ||
      (b.customerPhone && b.customerPhone.includes(term)) ||
      (b.billNumber && b.billNumber.toLowerCase().includes(term)) ||
      (b.id && b.id.toLowerCase().includes(term)) ||
      matchesItem
    );

    // Payment Filter
    const matchesPayment = paymentFilter === 'All' || b.paymentMethod === paymentFilter;

    // Date filter (immune to UTC midnight timezone shift)
    let matchesDate = true;
    const docDateStr = getDocDateString(b);
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    let billDate = parseDateSafe(b.saleDate || b.date || b.createdAt) || new Date();
    
    if (dateFilter === 'Today') {
      matchesDate = b.saleDate ? b.saleDate === todayStr : docDateStr === todayStr;
    } else if (dateFilter === 'Yesterday') {
      matchesDate = b.saleDate ? b.saleDate === yesterdayStr : docDateStr === yesterdayStr;
    } else if (dateFilter === 'This Week') {
      matchesDate = isThisWeek(billDate);
    } else if (dateFilter === 'This Month') {
      matchesDate = isThisMonth(billDate);
    } else if (dateFilter === 'Custom Range') {
      matchesDate = docDateStr >= customStart && docDateStr <= customEnd;
    }

    return matchesSearch && matchesPayment && matchesDate;
  });

  const handlePrint = (bill: any) => {
    setPreviewBill(bill);
  };

  const billHtml = previewBill ? getBillHtml(previewBill, shopProfile) : '';

  const handleWhatsAppForPreview = () => {
    if (!previewBill) return;
    const phone = previewBill.customerPhone || '';
    const name = previewBill.customerName || 'Customer';
    const item = previewBill.items?.[0]?.modelName || previewBill.items?.[0]?.itemName || 'Mobile Purchase';
    const total = previewBill.totalSellPrice || previewBill.totalSellAmount || previewBill.sellPrice || 0;
    const method = previewBill.paymentMethod || 'Cash';
    const imei = previewBill.items?.[0]?.imei1;
    const billNum = previewBill.billNumber || previewBill.id.substring(0, 8).toUpperCase();
    const url = getWhatsAppSaleBillUrl(phone, name, item, total, method, imei, billNum);
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Bills History</h1>
          <p className="text-sm text-slate-500 mt-1">View and reprint generated sales receipts</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card p-4 space-y-3 mb-6">
        {/* ROW 1: FULL WIDTH SEARCH */}
        <div className="w-full">
          <SearchBar 
            value={search} 
            onChange={setSearch} 
            placeholder="Search by Model, Brand, IMEI, Bill #, Customer name, Phone..." 
            className="w-full"
          />
        </div>

        {/* ROW 2: CLEAN ORGANIZED FILTERS */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 pt-1">
          <div className="w-full sm:w-48">
            <Select 
              value={paymentFilter} 
              onChange={(e) => setPaymentFilter(e.target.value)}
              options={[
                { value: 'All', label: 'All Payment Methods' },
                { value: 'Cash', label: 'Cash' },
                { value: 'Online', label: 'Online / Bank' },
                { value: 'Khata', label: 'Khata (Credit)' },
              ]}
              className="text-xs font-semibold py-2"
            />
          </div>
          <div className="w-full sm:w-44">
            <Select 
              value={dateFilter} 
              onChange={(e) => setDateFilter(e.target.value)}
              options={[
                { value: 'All', label: 'All Time' },
                { value: 'Today', label: 'Today' },
                { value: 'This Week', label: 'This Week' },
                { value: 'This Month', label: 'This Month' },
                { value: 'Custom Range', label: 'Custom Range' },
              ]}
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
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold rounded-tl-xl">Bill #</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Items</th>
                <th className="px-4 py-3 font-semibold">Total Amount</th>
                <th className="px-4 py-3 font-semibold">Method</th>
                <th className="px-4 py-3 font-semibold rounded-tr-xl text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Loading...</td></tr>
              ) : filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <p>No bills found.</p>
                  </td>
                </tr>
              ) : (
                filteredBills.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-primary-600">{b.billNumber || b.id.substring(0,8).toUpperCase()}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {formatDateSafe(b.date || b.createdAt, 'dd MMM yyyy, hh:mm a')}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{b.customerName || 'Walk-in'}</td>
                    <td className="px-4 py-3">
                      <Badge variant="info">{b.items?.length || 0} Items</Badge>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">
                      Rs. {(b.totalSellPrice || b.totalSellAmount || b.sellPrice || (b.items?.reduce((s: number, it: any) => s + (Number(it.sellPrice) || 0), 0)) || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={b.paymentMethod === 'Cash' ? 'success' : 'cyan'}>
                        {b.paymentMethod}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {b.customerPhone && (
                          <a
                            href={getWhatsAppSaleBillUrl(
                              b.customerPhone,
                              b.customerName,
                              b.items?.[0]?.modelName || b.items?.[0]?.itemName || 'Mobile Purchase',
                              b.totalSellPrice || b.totalSellAmount || b.sellPrice || 0,
                              b.paymentMethod,
                              b.items?.[0]?.imei1,
                              b.billNumber || b.id.substring(0, 8).toUpperCase()
                            )}
                            target="_blank"
                            rel="noreferrer"
                            title="Send WhatsApp Bill"
                            className="p-1.5 text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200"
                          >
                            <MessageCircle className="w-4 h-4 fill-emerald-500/20" />
                          </a>
                        )}
                        {/* Bluetooth Mini Printer */}
                        <button
                          onClick={() => setBluetoothBill(b)}
                          title="Print to Bluetooth Mini Thermal Printer"
                          className="p-1.5 text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
                        >
                          <Bluetooth className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handlePrint(b)} 
                          className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors inline-flex items-center gap-1.5"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Print</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* IN-APP PREVIEW MODAL */}
      <BillPreviewModal
        isOpen={!!previewBill}
        onClose={() => setPreviewBill(null)}
        htmlContent={billHtml}
        title="Sale Receipt Preview"
        billNumber={previewBill?.billNumber || previewBill?.id}
        billData={previewBill}
        onShareWhatsApp={previewBill?.customerPhone ? handleWhatsAppForPreview : undefined}
      />

      {/* DIRECT BLUETOOTH THERMAL PRINTER MODAL */}
      <BluetoothPrinterModal
        isOpen={!!bluetoothBill}
        onClose={() => setBluetoothBill(null)}
        billData={bluetoothBill}
      />
    </div>
  );
}

import React, { useState, useEffect, useRef } from "react";
import { collection, doc, serverTimestamp, writeBatch, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { PrintPromptModal } from '../components/ui/PrintPromptModal';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { isDocForShop } from '../utils/multiTenantService';
import { format } from 'date-fns';
import { generateBillNumber } from '../utils/printBill';
import { playSuccessSound, playErrorSound } from '../utils/soundEffects';
import { QrCode } from 'lucide-react';

const COMPANY_OPTIONS = [
  { value: 'Samsung', label: 'Samsung' },
  { value: 'Apple', label: 'Apple (iPhone)' },
  { value: 'Xiaomi', label: 'Xiaomi / Redmi' },
  { value: 'Infinix', label: 'Infinix' },
  { value: 'Tecno', label: 'Tecno' },
  { value: 'Vivo', label: 'Vivo' },
  { value: 'Oppo', label: 'Oppo' },
  { value: 'Realme', label: 'Realme' },
  { value: 'Itel', label: 'Itel' },
  { value: 'Nokia', label: 'Nokia' },
  { value: 'OnePlus', label: 'OnePlus' },
  { value: 'Google Pixel', label: 'Google Pixel' },
  { value: 'Other', label: 'Other (Type Brand)' },
];

const CONDITION_OPTIONS = [
  { value: 'Used', label: 'Used / Second Hand' },
  { value: 'New', label: 'Brand New (Box Pack)' },
  { value: 'Kit Only', label: 'Kit Only' },
  { value: 'Box Pack', label: 'Box Pack' },
];

const PAYMENT_OPTIONS = [
  { value: 'Cash', label: 'Cash' },
  { value: 'Online/Bank', label: 'Online / Bank' },
  { value: 'Udhar', label: 'Udhar (Khata)' },
];

const WARRANTY_PRESETS = [
  { key: 'none', label: 'No Warranty', days: 0, printLabel: 'No Warranty' },
  { key: '3d', label: '3 Days Check', days: 3, printLabel: '3 Days Check Warranty' },
  { key: '7d', label: '7 Days Check', days: 7, printLabel: '7 Days Check Warranty' },
  { key: '15d', label: '15 Days', days: 15, printLabel: '15 Days Check Warranty' },
  { key: '1y', label: '1 Year Brand', days: 365, printLabel: '1 Year Brand Warranty' },
  { key: 'custom', label: 'Custom Days', days: -1, printLabel: 'Custom' },
];

export default function QuickSalePage() {
  const { user, shopProfile, currentShopId } = useAuth();
  const { success, error } = useToast();

  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    company: 'Samsung',
    customCompany: '',
    modelName: '',
    ramRom: '',
    condition: 'Used',
    imei1: '',
    imei2: '',
    supplierName: '',
    basePrice: '',
    sellPrice: '',
    paymentMethod: 'Cash',
    warrantyKey: '3d',
    customWarrantyDays: '',
    saleDate: format(new Date(), 'yyyy-MM-dd')
  });

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanTargetField, setScanTargetField] = useState<'imei1' | 'imei2'>('imei1');

  const [printPromptData, setPrintPromptData] = useState<{isOpen: boolean, billData: any, profit: number}>({ 
    isOpen: false, 
    billData: null, 
    profit: 0 
  });
  const [loading, setLoading] = useState(false);
  const isSubmittingRef = useRef(false);

  const [khataCustomers, setKhataCustomers] = useState<any[]>([]);
  const [selectedKhataId, setSelectedKhataId] = useState('');

  // Fetch Khata Customers for Udhar payment
  useEffect(() => {
    if (!user) return;
    const fetchKhata = async () => {
      try {
        const snap = await getDocs(collection(db, 'khata'));
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(c => isDocForShop(c, currentShopId));
        list.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
        setKhataCustomers(list);
      } catch (err) {
        console.warn("Error fetching khata customers:", err);
      }
    };
    fetchKhata();
  }, [user, currentShopId]);

  const resolvedCompany = formData.company === 'Other' && formData.customCompany.trim() 
    ? formData.customCompany.trim() 
    : formData.company;

  const basePriceNum = Number(formData.basePrice) || 0;
  const sellPriceNum = Number(formData.sellPrice) || 0;
  const profitNum = sellPriceNum - basePriceNum;
  const marginPct = sellPriceNum > 0 ? ((profitNum / sellPriceNum) * 100).toFixed(1) : '0';

  const isImeiCheckEnabled = Boolean(shopProfile?.enableImeiCheck);

  const resolveWarrantyInfo = () => {
    if (!isImeiCheckEnabled) {
      return {
        warrantyDays: null,
        warrantyLabel: '',
      };
    }
    if (formData.warrantyKey === 'custom') {
      const d = Math.max(0, parseInt(formData.customWarrantyDays, 10) || 0);
      return {
        warrantyDays: d,
        warrantyLabel: d > 0 ? `${d} Days Check Warranty` : 'No Warranty',
      };
    }
    const found = WARRANTY_PRESETS.find(p => p.key === formData.warrantyKey) || WARRANTY_PRESETS[0];
    return {
      warrantyDays: found.days,
      warrantyLabel: found.printLabel,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || isSubmittingRef.current) return;

    if (!formData.modelName.trim()) {
      error("Model name is required");
      try { playErrorSound(); } catch {}
      return;
    }

    if (!sellPriceNum || sellPriceNum <= 0) {
      error("Please enter a valid selling price");
      try { playErrorSound(); } catch {}
      return;
    }

    if (formData.paymentMethod === 'Udhar' && !selectedKhataId) {
      error("Please select a Khata customer for Udhar payment");
      try { playErrorSound(); } catch {}
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);

    try {
      const fullItemName = `${resolvedCompany} ${formData.modelName.trim()}`;
      const resolvedCustomerName = formData.customerName.trim() || 
        (formData.paymentMethod === 'Udhar' 
          ? (khataCustomers.find(c => c.id === selectedKhataId)?.name || 'Khata Customer') 
          : 'Walk-in Customer');

      const { warrantyDays, warrantyLabel } = resolveWarrantyInfo();

      // Generate sequential bill number
      let billNumber = '';
      try {
        const billsSnap = await getDocs(collection(db, 'bills'));
        const shopBillsCount = billsSnap.docs.filter(b => isDocForShop(b.data(), currentShopId)).length;
        const prefix = shopProfile?.shortName || 'MZ';
        billNumber = `${prefix}-${new Date().getFullYear()}-${String(shopBillsCount + 1).padStart(4, '0')}`;
      } catch (e) {
        billNumber = generateBillNumber();
      }

      const chosenSaleDate = formData.saleDate || format(new Date(), 'yyyy-MM-dd');
      const [sYear, sMonth, sDay] = chosenSaleDate.split('-').map(Number);
      const now = new Date();
      const localSaleDateTime = new Date(sYear, sMonth - 1, sDay, now.getHours(), now.getMinutes(), now.getSeconds());

      const batch = writeBatch(db);

      // Create Bill in 'bills'
      const billRef = doc(collection(db, 'bills'));
      const billData: any = {
        shopId: currentShopId,
        shopName: shopProfile?.shopName || 'Mobile Shop',
        userId: user?.uid,
        userEmail: (user?.email || '').toLowerCase(),
        billNumber,
        customerName: resolvedCustomerName,
        customerPhone: formData.customerPhone.trim(),
        paymentMethod: formData.paymentMethod,
        warrantyDays,
        warrantyLabel,
        imei1: formData.imei1.trim(),
        imei2: formData.imei2.trim(),
        khataCustomerId: formData.paymentMethod === 'Udhar' ? selectedKhataId : null,
        khataCustomerName: formData.paymentMethod === 'Udhar' ? khataCustomers.find(c => c.id === selectedKhataId)?.name : null,
        items: [{
          modelName: fullItemName,
          company: resolvedCompany,
          ramRom: formData.ramRom.trim(),
          condition: formData.condition,
          imei1: formData.imei1.trim(),
          imei2: formData.imei2.trim(),
          warrantyDays,
          warrantyLabel,
          supplierName: formData.supplierName.trim(),
          basePrice: basePriceNum,
          sellPrice: sellPriceNum,
          profit: profitNum,
          isQuickSale: true
        }],
        totalBaseCost: basePriceNum,
        totalProfit: profitNum,
        totalSellPrice: sellPriceNum,
        totalSellAmount: sellPriceNum,
        sellPrice: sellPriceNum,
        supplierName: formData.supplierName.trim(),
        saleDate: chosenSaleDate,
        date: localSaleDateTime,
        createdAt: serverTimestamp(),
        isQuickSale: true
      };
      batch.set(billRef, billData);

      // Create Sale in 'sales'
      const saleRef = doc(collection(db, 'sales'));
      const saleData: any = {
        shopId: currentShopId,
        userId: user?.uid,
        userEmail: (user?.email || '').toLowerCase(),
        itemType: 'quick_sale',
        isQuickSale: true,
        itemName: fullItemName,
        company: resolvedCompany,
        modelName: formData.modelName.trim(),
        ramRom: formData.ramRom.trim(),
        condition: formData.condition,
        imei1: formData.imei1.trim(),
        imei2: formData.imei2.trim(),
        warrantyDays,
        warrantyLabel,
        supplierName: formData.supplierName.trim(),
        supplier: formData.supplierName.trim(),
        customerName: resolvedCustomerName,
        customerPhone: formData.customerPhone.trim(),
        basePrice: basePriceNum,
        costPrice: basePriceNum,
        sellPrice: sellPriceNum,
        profit: profitNum,
        paymentMethod: formData.paymentMethod,
        khataCustomerId: formData.paymentMethod === 'Udhar' ? selectedKhataId : null,
        khataCustomerName: formData.paymentMethod === 'Udhar' ? khataCustomers.find(c => c.id === selectedKhataId)?.name : null,
        billId: billRef.id,
        billNumber: billNumber,
        saleDate: chosenSaleDate,
        date: localSaleDateTime,
        createdAt: serverTimestamp()
      };
      batch.set(saleRef, saleData);

      // Create audit trace in 'mobiles' (marked quantity 0, sold immediately)
      const mobileAuditRef = doc(collection(db, 'mobiles'));
      batch.set(mobileAuditRef, {
        shopId: currentShopId,
        userId: user?.uid,
        userEmail: (user?.email || '').toLowerCase(),
        modelName: formData.modelName.trim(),
        company: resolvedCompany,
        brand: resolvedCompany,
        ramRom: formData.ramRom.trim(),
        condition: formData.condition,
        imei1: formData.imei1.trim(),
        imei2: formData.imei2.trim(),
        supplier: formData.supplierName.trim(),
        basePrice: basePriceNum,
        quantity: 0,
        status: 'sold',
        purchaseDate: chosenSaleDate,
        isQuickSale: true,
        soldAt: serverTimestamp(),
        createdAt: serverTimestamp()
      });

      // Handle Udhar (Khata Ledger Update)
      if (formData.paymentMethod === 'Udhar' && selectedKhataId) {
        const khataRef = doc(db, 'khata', selectedKhataId);
        const khataSnap = await getDoc(khataRef);
        if (khataSnap.exists()) {
          const currentBalance = khataSnap.data().totalBalance || 0;
          const newBalance = currentBalance + sellPriceNum;
          
          batch.update(khataRef, { totalBalance: newBalance });
          
          const txnRef = doc(collection(db, 'khataTransactions'));
          batch.set(txnRef, {
            shopId: currentShopId,
            userId: user?.uid,
            userEmail: (user?.email || '').toLowerCase(),
            khataId: selectedKhataId,
            customerName: khataSnap.data().name,
            transactionType: 'udhar',
            amount: sellPriceNum,
            description: `Quick Sale: ${fullItemName}`,
            runningBalance: newBalance,
            saleDate: chosenSaleDate,
            dateStr: chosenSaleDate,
            date: localSaleDateTime,
            createdAt: serverTimestamp(),
            linkedSaleId: billRef.id
          });
        }
      }

      await batch.commit();

      try { playSuccessSound(); } catch {}

      if (formData.paymentMethod === 'Udhar') {
        const khataName = khataCustomers.find(c => c.id === selectedKhataId)?.name;
        success(`Quick Sale recorded. Rs. ${sellPriceNum.toLocaleString()} added to ${khataName}'s Khata`);
      } else {
        success(`Quick Sale completed. Profit: Rs. ${profitNum.toLocaleString()}`);
      }

      setPrintPromptData({
        isOpen: true,
        billData: { id: billRef.id, ...billData },
        profit: profitNum
      });

      // Reset form
      setFormData({
        customerName: '',
        customerPhone: '',
        company: 'Samsung',
        customCompany: '',
        modelName: '',
        ramRom: '',
        condition: 'Used',
        imei1: '',
        imei2: '',
        supplierName: '',
        basePrice: '',
        sellPrice: '',
        paymentMethod: 'Cash',
        warrantyKey: '3d',
        customWarrantyDays: '',
        saleDate: format(new Date(), 'yyyy-MM-dd')
      });
      setSelectedKhataId('');

    } catch (err: any) {
      console.error("Error processing quick sale:", err);
      try { playErrorSound(); } catch {}
      error(err.message || "Failed to process quick sale");
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Quick Sale</h1>
          <p className="text-sm text-slate-500 mt-1">Direct buy and sell in a single entry without stock pre-registration</p>
        </div>
      </div>

      {/* Unified Single Form Section */}
      <div className="bg-white rounded-2xl shadow-card p-4 sm:p-6 border border-slate-100">
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          
          {/* Row 1: Customer Details & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Customer Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Walk-in Customer / Customer Name"
                value={formData.customerName}
                onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#522D60] focus:ring-1 focus:ring-[#522D60]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Customer Phone
              </label>
              <input
                type="tel"
                placeholder="0300-1234567"
                value={formData.customerPhone}
                onChange={e => setFormData({ ...formData, customerPhone: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#522D60] focus:ring-1 focus:ring-[#522D60]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Sale Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.saleDate}
                onChange={e => setFormData({ ...formData, saleDate: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-medium text-slate-900 outline-none focus:border-[#522D60] focus:ring-1 focus:ring-[#522D60]"
              />
            </div>
          </div>

          {/* Row 2: Mobile Company, Model, RAM & Condition */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Mobile Company <span className="text-rose-500">*</span>
              </label>
              <Select
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                options={COMPANY_OPTIONS}
                className="text-xs font-semibold py-2.5"
              />
            </div>

            {formData.company === 'Other' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Brand Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Motorola, Sony"
                  value={formData.customCompany}
                  onChange={e => setFormData({ ...formData, customCompany: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-medium text-slate-900 outline-none focus:border-[#522D60]"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Model Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. iPhone 13 / Galaxy A54"
                value={formData.modelName}
                onChange={e => setFormData({ ...formData, modelName: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#522D60] focus:ring-1 focus:ring-[#522D60]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                RAM / Storage
              </label>
              <input
                type="text"
                placeholder="e.g. 8GB / 128GB"
                value={formData.ramRom}
                onChange={e => setFormData({ ...formData, ramRom: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#522D60] focus:ring-1 focus:ring-[#522D60]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Condition
              </label>
              <Select
                value={formData.condition}
                onChange={(e) => {
                  const nextCond = e.target.value;
                  setFormData({
                    ...formData,
                    condition: nextCond,
                    warrantyKey: nextCond === 'New' ? '1y' : formData.warrantyKey
                  });
                }}
                options={CONDITION_OPTIONS}
                className="text-xs font-semibold py-2.5"
              />
            </div>
          </div>

          {/* Row 2.5: Optional IMEI 1 & IMEI 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {isImeiCheckEnabled ? 'IMEI 1 (Optional — for Bill & IMEI Check)' : 'IMEI 1 (Optional)'}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={18}
                  placeholder="Scan or enter 15-digit IMEI 1"
                  value={formData.imei1}
                  onChange={e => setFormData({ ...formData, imei1: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 outline-none focus:border-[#522D60]"
                />
                <button
                  type="button"
                  title="Scan IMEI 1"
                  onClick={() => {
                    setScanTargetField('imei1');
                    setScannerOpen(true);
                  }}
                  className="px-3 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-[#522D60] cursor-pointer"
                >
                  <QrCode className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                IMEI 2 (Optional)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={18}
                  placeholder="Scan or enter 15-digit IMEI 2"
                  value={formData.imei2}
                  onChange={e => setFormData({ ...formData, imei2: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 outline-none focus:border-[#522D60]"
                />
                <button
                  type="button"
                  title="Scan IMEI 2"
                  onClick={() => {
                    setScanTargetField('imei2');
                    setScannerOpen(true);
                  }}
                  className="px-3 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-[#522D60] cursor-pointer"
                >
                  <QrCode className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Row 3: Supplier Name (when enabled), Base Price, Sell Price & Payment Method */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${Boolean(shopProfile?.enableSupplierKhata) ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
            {Boolean(shopProfile?.enableSupplierKhata) && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Supplier Name (Bought From)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Arshad Wholesaler"
                  value={formData.supplierName}
                  onChange={e => setFormData({ ...formData, supplierName: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#522D60] focus:ring-1 focus:ring-[#522D60]"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Base Price / Cost (PKR) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                required
                placeholder="0"
                value={formData.basePrice}
                onChange={e => setFormData({ ...formData, basePrice: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-bold font-mono text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#522D60] focus:ring-1 focus:ring-[#522D60]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Sell Price (PKR) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                required
                placeholder="0"
                value={formData.sellPrice}
                onChange={e => setFormData({ ...formData, sellPrice: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-bold font-mono text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#522D60] focus:ring-1 focus:ring-[#522D60]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Payment Method <span className="text-rose-500">*</span>
              </label>
              <Select
                value={formData.paymentMethod}
                onChange={(e) => {
                  setFormData({ ...formData, paymentMethod: e.target.value });
                  if (e.target.value !== 'Udhar') setSelectedKhataId('');
                }}
                options={PAYMENT_OPTIONS}
                className="text-xs font-semibold py-2.5"
              />
            </div>
          </div>

          {/* Row 4: 1-Click Phone Warranty Selector (Only shown when IMEI & Warranty Check is enabled in Settings) */}
          {isImeiCheckEnabled && (
            <div className="space-y-2 pt-1">
              <label className="block text-xs font-semibold text-slate-700">
                Phone Warranty (Prints on Bill & Saved for IMEI Check)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                {WARRANTY_PRESETS.map((preset) => {
                  const isSelected = formData.warrantyKey === preset.key;
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => setFormData({ ...formData, warrantyKey: preset.key })}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#522D60] text-white border-[#522D60] shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
              {formData.warrantyKey === 'custom' && (
                <div className="pt-1 max-w-xs">
                  <input
                    type="number"
                    min="1"
                    max="1095"
                    placeholder="Enter custom warranty days (e.g. 10, 30)"
                    value={formData.customWarrantyDays}
                    onChange={e => setFormData({ ...formData, customWarrantyDays: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-bold text-slate-900 outline-none focus:border-[#522D60]"
                  />
                </div>
              )}
            </div>
          )}

          {/* Conditional Udhar / Khata Customer Selection */}
          {formData.paymentMethod === 'Udhar' && (
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
              <label className="block text-xs font-bold text-amber-900 uppercase tracking-wide">
                Select Khata Customer <span className="text-rose-500">*</span>
              </label>
              {khataCustomers.length === 0 ? (
                <div className="text-xs text-amber-800">
                  No customers found in Khata ledger. <a href="/khata" className="underline font-bold">Create customer first</a>.
                </div>
              ) : (
                <select
                  value={selectedKhataId}
                  onChange={(e) => setSelectedKhataId(e.target.value)}
                  required
                  className="w-full border border-amber-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 bg-white outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">-- Choose Khata Customer --</option>
                  {khataCustomers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.totalBalance > 0 ? `(Owes: Rs. ${Number(c.totalBalance).toLocaleString()})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Live Calculation Summary Strip */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center sm:text-left">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cost Price</span>
                <span className="text-sm font-bold text-slate-700 font-mono">
                  Rs. {basePriceNum.toLocaleString()}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Selling Price</span>
                <span className="text-sm font-bold text-slate-900 font-mono">
                  Rs. {sellPriceNum.toLocaleString()}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Profit</span>
                <span className={`text-base font-bold font-mono ${profitNum >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {profitNum >= 0 ? '+' : ''}Rs. {profitNum.toLocaleString()}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Margin</span>
                <span className={`text-sm font-bold font-mono ${profitNum >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {marginPct}%
                </span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-2">
            <Button
              type="submit"
              size="lg"
              disabled={loading}
              isLoading={loading}
              className="w-full py-3.5 rounded-xl bg-[#522D60] hover:bg-[#42244E] text-white font-bold text-xs tracking-wide shadow-sm flex items-center justify-center cursor-pointer"
            >
              Complete Quick Sale
            </Button>
          </div>

        </form>
      </div>

      {/* Barcode Scanner Modal */}
      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(imei) => {
          setFormData(prev => ({ ...prev, [scanTargetField]: imei }));
          setScannerOpen(false);
        }}
        onScanBoth={(imei1, imei2) => {
          setFormData(prev => ({ ...prev, imei1, imei2 }));
          setScannerOpen(false);
          success(`Both IMEIs added: ${imei1} & ${imei2}`);
        }}
        targetField={scanTargetField}
        title={scanTargetField === 'imei2' ? 'Scan IMEI 2' : 'Scan IMEI 1'}
      />

      {/* Invoice / Print Modal */}
      <PrintPromptModal 
        isOpen={printPromptData.isOpen} 
        onClose={() => setPrintPromptData({ isOpen: false, billData: null, profit: 0 })} 
        billData={printPromptData.billData} 
        profit={printPromptData.profit} 
      />

    </div>
  );
}

import React, { useState, useEffect, useRef } from "react";
import { collection, doc, serverTimestamp, writeBatch, getDocs, getDoc, query, orderBy, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { PrintPromptModal } from '../components/ui/PrintPromptModal';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { isDocForShop } from '../utils/multiTenantService';
import { format } from 'date-fns';
import { QrCode, Zap } from 'lucide-react';
import { generateBillNumber } from '../utils/printBill';

export default function QuickSalePage() {
  const { user, shopProfile, currentShopId } = useAuth();
  useEffect(() => {
    if (!user) return;
    const fetchKhataCustomers = async () => {
      try {
        const snap = await getDocs(collection(db, 'khata'));
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(c => isDocForShop(c, currentShopId));
        list.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
        setKhataCustomers(list);
      } catch (err) {
        console.error("Error fetching khata customers:", err);
      }
    };
    fetchKhataCustomers();
  }, [user, currentShopId]);
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    itemName: '',
    company: '',
    basePrice: '',
    sellPrice: '',
    imei1: '',
    imei2: '',
    paymentMethod: 'Cash',
    saleDate: format(new Date(), 'yyyy-MM-dd')
  });

  const [scannerOpen, setScannerOpen] = useState(false);
  const [activeScanField, setActiveScanField] = useState<'imei1' | 'imei2' | null>(null);
  const [printPromptData, setPrintPromptData] = useState<{isOpen: boolean, billData: any, profit: number}>({ isOpen: false, billData: null, profit: 0 });
  const [loading, setLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [khataCustomers, setKhataCustomers] = useState<any[]>([]);
  const [selectedKhataId, setSelectedKhataId] = useState('');
  const { success, error } = useToast();

  const handleScan = (imei: string) => {
    if (activeScanField) {
      setFormData(prev => ({ ...prev, [activeScanField]: imei }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || isSubmittingRef.current) return;

    if (!formData.itemName) {
      error("Item name is required");
      return;
    }
    const sellPrice = Number(formData.sellPrice);
    if (!sellPrice || sellPrice <= 0) {
      error("Enter valid selling price");
      return;
    }
    
    if (formData.paymentMethod === 'Udhar' && !selectedKhataId) {
      error("Please select a Khata customer for Udhar payment");
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);
    try {
      const basePrice = Number(formData.basePrice) || 0;
      const profit = sellPrice - basePrice;

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

      const billRef = doc(collection(db, 'bills'));
      // Ensure exact local calendar date and time (immune to server UTC midnight regression)
      const chosenSaleDate = formData.saleDate || format(new Date(), 'yyyy-MM-dd');
      const [sYear, sMonth, sDay] = chosenSaleDate.split('-').map(Number);
      const now = new Date();
      const localSaleDateTime = new Date(sYear, sMonth - 1, sDay, now.getHours(), now.getMinutes(), now.getSeconds());

      const billData = {
        shopId: currentShopId,
        shopName: shopProfile?.shopName || 'Mobile Shop',
        userId: user?.uid,
        userEmail: (user?.email || '').toLowerCase(),
        billNumber,
        customerName: formData.customerName || 'Walk-in Customer',
        customerPhone: formData.customerPhone || '',
        paymentMethod: formData.paymentMethod,
        khataCustomerId: formData.paymentMethod === 'Udhar' ? selectedKhataId : null,
        khataCustomerName: formData.paymentMethod === 'Udhar' ? khataCustomers.find(c => c.id === selectedKhataId)?.name : null,
        items: [{
          modelName: formData.itemName,
          company: formData.company || '',
          imei1: formData.imei1 || '',
          imei2: formData.imei2 || '',
          basePrice,
          sellPrice,
          isQuickSale: true
        }],
        totalBaseCost: basePrice,
        totalProfit: profit,
        totalSellPrice: sellPrice,
        totalSellAmount: sellPrice,
        sellPrice: sellPrice,
        saleDate: chosenSaleDate,
        date: localSaleDateTime,
        createdAt: serverTimestamp(),
        isQuickSale: true
      };

      const batch = writeBatch(db);
      batch.set(billRef, billData);

      // Create a sale record in sales collection
      const saleRef = doc(collection(db, 'sales'));
      batch.set(saleRef, {
        shopId: currentShopId,
        userId: user?.uid,
        userEmail: (user?.email || '').toLowerCase(),
        itemType: 'quick_sale',
        itemName: formData.company ? `${formData.company} ${formData.itemName}` : formData.itemName,
        company: formData.company || '',
        imei1: formData.imei1 || '',
        imei2: formData.imei2 || '',
        customerName: formData.customerName || 'Walk-in Customer',
        customerPhone: formData.customerPhone || '',
        basePrice,
        sellPrice,
        profit,
        paymentMethod: formData.paymentMethod,
        khataCustomerId: formData.paymentMethod === 'Udhar' ? selectedKhataId : null,
        khataCustomerName: formData.paymentMethod === 'Udhar' ? khataCustomers.find(c => c.id === selectedKhataId)?.name : null,
        billId: billRef.id,
        saleDate: chosenSaleDate,
        date: localSaleDateTime,
        createdAt: serverTimestamp(),
        isQuickSale: true
      });

      if (formData.paymentMethod === 'Udhar' && selectedKhataId) {
        const khataRef = doc(db, 'khata', selectedKhataId);
        const khataSnap = await getDoc(khataRef);
        if (khataSnap.exists()) {
          const currentBalance = khataSnap.data().totalBalance || 0;
          const newBalance = currentBalance + sellPrice;
          
          batch.update(khataRef, { totalBalance: newBalance });
          
          const txnRef = doc(collection(db, 'khataTransactions'));
          batch.set(txnRef, {
            shopId: currentShopId,
            userId: user?.uid,
            userEmail: (user?.email || '').toLowerCase(),
            khataId: selectedKhataId,
            customerName: khataSnap.data().name,
            transactionType: 'udhar',
            amount: sellPrice,
            description: `Quick sale - ${formData.itemName}`,
            runningBalance: newBalance,
            saleDate: chosenSaleDate,
            date: localSaleDateTime,
            createdAt: serverTimestamp(),
            linkedSaleId: billRef.id
          });
        }
      }

      await batch.commit();

      if (formData.paymentMethod === 'Udhar') {
        const khataName = khataCustomers.find(c => c.id === selectedKhataId)?.name;
        success(`Rs. ${sellPrice.toLocaleString()} added to ${khataName}'s Khata`);
      } else {
        success("Quick sale recorded successfully");
      }

      setPrintPromptData({ isOpen: true, billData: { id: billRef.id, ...billData }, profit });
      
      setFormData({
        customerName: '', customerPhone: '', itemName: '', company: '',
        basePrice: '', sellPrice: '', imei1: '', imei2: '', paymentMethod: 'Cash'
      });
      setSelectedKhataId('');
    } catch (err: any) {
      error(err.message || 'Error processing quick sale');
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const profit = Number(formData.sellPrice) - Number(formData.basePrice);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-[#522D60] text-white flex items-center justify-center shadow-md">
          <Zap className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Quick Sale</h1>
          <p className="text-sm text-slate-500 mt-1">Sell an item instantly without adding it to stock first.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input required label="Customer Name *" value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} />
            <Input label="Customer Phone" value={formData.customerPhone} onChange={e => setFormData({...formData, customerPhone: e.target.value})} />
          </div>

          <div>
            <Input required type="date" label="Sale Date *" value={formData.saleDate} onChange={e => setFormData({...formData, saleDate: e.target.value})} />
          </div>

          <hr className="border-slate-100" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input required label="Product Name *" value={formData.itemName} onChange={e => setFormData({...formData, itemName: e.target.value})} />
            <Input label="Company / Brand" value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">IMEI 1</label>
              <div className="flex gap-2">
                <input type="text" maxLength={15} className="w-full rounded-xl border border-primary-500/20 bg-white/5 px-3 py-2.5 text-slate-900 outline-none focus:border-primary-500 focus:ring-2"
                  value={formData.imei1} onChange={e => setFormData({...formData, imei1: e.target.value})} />
                <button type="button" onClick={() => { setActiveScanField('imei1'); setScannerOpen(true); }} className="p-2 border border-primary-200 rounded-xl hover:bg-primary-50 text-primary-600">
                  <QrCode className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">IMEI 2</label>
              <div className="flex gap-2">
                <input type="text" maxLength={15} className="w-full rounded-xl border border-primary-500/20 bg-white/5 px-3 py-2.5 text-slate-900 outline-none focus:border-primary-500 focus:ring-2"
                  value={formData.imei2} onChange={e => setFormData({...formData, imei2: e.target.value})} />
                <button type="button" onClick={() => { setActiveScanField('imei2'); setScannerOpen(true); }} className="p-2 border border-primary-200 rounded-xl hover:bg-primary-50 text-primary-600">
                  <QrCode className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <Input required type="number" min="0" label="Base Price (Cost) *" value={formData.basePrice} onChange={e => setFormData({...formData, basePrice: e.target.value})} />
            <Input required type="number" min="0" label="Sell Price *" value={formData.sellPrice} onChange={e => setFormData({...formData, sellPrice: e.target.value})} />
            
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 h-[52px] flex items-center justify-between">
              <span className="text-sm text-slate-500 font-medium">Profit:</span>
              <span className={`font-bold ${!formData.sellPrice || !formData.basePrice ? 'text-slate-400' : profit >= 0 ? 'text-accent-emerald' : 'text-accent-rose'}`}>
                {profit >= 0 ? '+' : ''}Rs. {isNaN(profit) ? '0' : profit.toLocaleString()}
              </span>
            </div>
          </div>

          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method *</label>
            <div className="grid grid-cols-3 gap-2">
              {['Cash', 'Bank Transfer', 'Udhar'].map(method => (
                <button
                  key={method}
                  type="button"
                  onClick={() => {
                    setFormData({...formData, paymentMethod: method});
                    if (method !== 'Udhar') setSelectedKhataId('');
                  }}
                  className={`py-2.5 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
                    formData.paymentMethod === method
                      ? method === 'Cash'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : method === 'Bank Transfer'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-amber-500 bg-amber-50 text-amber-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {method === 'Cash' && '💵 '}
                  {method === 'Bank Transfer' && '🏦 '}
                  {method === 'Udhar' && '📋 '}
                  {method}
                </button>
              ))}
            </div>
            
            {formData.paymentMethod === 'Udhar' && (
              <div className="mt-3 p-4 bg-amber-50/50 border border-amber-200 rounded-xl">
                <label className="block text-xs font-semibold text-amber-800 mb-1.5 uppercase tracking-wide">Select Customer (Khata) *</label>
                {khataCustomers.length === 0 ? (
                  <div className="text-sm text-amber-700">
                    ⚠️ No customers in Khata. <a href="/khata" className="underline font-medium">Add a customer first</a>.
                  </div>
                ) : (
                  <select
                    value={selectedKhataId}
                    onChange={(e) => setSelectedKhataId(e.target.value)}
                    required
                    className="w-full border-2 border-amber-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
                  >
                    <option value="">-- Select Customer --</option>
                    {khataCustomers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} {c.totalBalance > 0 ? ` (Owes: Rs. ${c.totalBalance.toLocaleString()})` : ''}</option>
                    ))}
                  </select>
                )}
                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                  <span className="text-[10px]">💡</span> Sale amount will be added to this customer's Udhar balance
                </p>
              </div>
            )}
          </div>
  

          <Button type="submit" size="lg" className="w-full" isLoading={loading} disabled={loading}>
            Complete Quick Sale
          </Button>

        </form>
      </div>

      <BarcodeScanner isOpen={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleScan} />
      <PrintPromptModal isOpen={printPromptData.isOpen} onClose={() => setPrintPromptData({ isOpen: false, billData: null, profit: 0 })} billData={printPromptData.billData} profit={printPromptData.profit} />
    </div>
  );
}

import React, { useEffect, useState, useRef } from "react";
import { collection, getDoc, query, orderBy, onSnapshot, addDoc, doc, serverTimestamp, writeBatch, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Button } from '../components/ui/Button';
import { SearchBar } from '../components/ui/SearchBar';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { PrintPromptModal } from '../components/ui/PrintPromptModal';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { isDocForShop } from '../utils/multiTenantService';
import { parseDateSafe } from '../utils/dateUtils';
import { format } from 'date-fns';
import { Zap, Smartphone, QrCode, X, Plus, Calendar } from 'lucide-react';

export default function MobilesStockPage() {
  const { user, shopProfile, currentShopId } = useAuth();
  const [mobiles, setMobiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [khataCustomers, setKhataCustomers] = useState<any[]>([]);
  const [singleSelectedKhataId, setSingleSelectedKhataId] = useState('');
  const [multiSelectedKhataId, setMultiSelectedKhataId] = useState('');
  const [multiTotalProfit, setMultiTotalProfit] = useState<number>(0);
  
  // Single Sell State & submission guard
  const [singleSellModal, setSingleSellModal] = useState<any>(null);
  const [isSingleSelling, setIsSingleSelling] = useState(false);
  const isSingleSellingRef = useRef(false);
  
  // Multi Sell State & submission guard
  const [multiSellModalOpen, setMultiSellModalOpen] = useState(false);
  const [isMultiSelling, setIsMultiSelling] = useState(false);
  const isMultiSellingRef = useRef(false);
  const [multiCustomerName, setMultiCustomerName] = useState('');
  const [multiCustomerPhone, setMultiCustomerPhone] = useState('');
  const [multiSaleDate, setMultiSaleDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [multiPaymentMethod, setMultiPaymentMethod] = useState('Cash');
  const [multiItems, setMultiItems] = useState<any[]>([]);
  
  // Scanner State
  const [scannerOpen, setScannerOpen] = useState(false);
  const [activeScanField, setActiveScanField] = useState<{id?: string, field: string} | null>(null);

  // Print Prompt
  const [printPromptData, setPrintPromptData] = useState<{isOpen: boolean, billData: any, profit: number}>({ isOpen: false, billData: null, profit: 0 });

  const { success, error } = useToast();

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
        console.error(err);
      }
    };
    fetchKhata();

    const q = collection(db, 'mobiles');
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(m => isDocForShop(m, currentShopId));
        list.sort((a: any, b: any) => {
          const da = a.createdAt?.toMillis ? a.createdAt.toMillis() : (parseDateSafe(a.createdAt || a.purchaseDate)?.getTime() || 0);
          const db = b.createdAt?.toMillis ? b.createdAt.toMillis() : (parseDateSafe(b.createdAt || b.purchaseDate)?.getTime() || 0);
          return db - da;
        });
        setMobiles(list);
        setLoading(false);
      },
      (err) => {
        console.warn('MobilesStock listener error:', err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, [user, currentShopId]);

  const filteredMobiles = mobiles.filter(m => {
    if (m.quantity <= 0) return false;
    const term = search.toLowerCase().trim();
    if (!term) return true;
    return (
      (m.modelName && m.modelName.toLowerCase().includes(term)) ||
      (m.company && m.company.toLowerCase().includes(term)) ||
      (m.condition && m.condition.toLowerCase().includes(term)) ||
      (m.color && m.color.toLowerCase().includes(term)) ||
      (m.storage && m.storage.toLowerCase().includes(term)) ||
      (m.supplierName && m.supplierName.toLowerCase().includes(term)) ||
      (m.imei1 && m.imei1.includes(term)) ||
      (m.imei2 && m.imei2.includes(term))
    );
  });

  const openSingleSell = (mobile: any) => {
    setSingleSellModal({
      ...mobile,
      customerName: '',
      customerPhone: '',
      saleDate: format(new Date(), 'yyyy-MM-dd'),
      sellPrice: mobile.basePrice.toString(),
      imei1: mobile.imei1 || '',
      imei2: mobile.imei2 || '',
      paymentMethod: 'Cash'
    });
  };

  const handleSingleSell = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleSellModal || isSingleSellingRef.current || isSingleSelling) return;

    if (singleSellModal.paymentMethod === 'Udhar' && !singleSelectedKhataId) {
      return error("Please select a Khata customer for Udhar payment");
    }

    isSingleSellingRef.current = true;
    setIsSingleSelling(true);

    try {
      const sellPrice = Number(singleSellModal.sellPrice);
      const basePrice = singleSellModal.basePrice;
      const profit = sellPrice - basePrice;

      // Ensure exact local calendar date and time (immune to server UTC midnight regression)
      const chosenSaleDate = singleSellModal.saleDate || format(new Date(), 'yyyy-MM-dd');
      const [sYear, sMonth, sDay] = chosenSaleDate.split('-').map(Number);
      const now = new Date();
      const localSaleDateTime = new Date(sYear, sMonth - 1, sDay, now.getHours(), now.getMinutes(), now.getSeconds());

      const batch = writeBatch(db);
      
      // 1. Decrease quantity
      const mobileRef = doc(db, 'mobiles', singleSellModal.id);
      batch.update(mobileRef, { quantity: singleSellModal.quantity - 1 });

      // 2. Create Sale Record
      const saleRef = doc(collection(db, 'sales'));
      const saleData = {
        shopId: currentShopId,
        userId: user?.uid,
        userEmail: (user?.email || '').toLowerCase(),
        itemType: 'mobile',
        itemId: singleSellModal.id,
        itemName: `${singleSellModal.company} ${singleSellModal.modelName}`,
        company: singleSellModal.company,
        imei1: singleSellModal.imei1,
        imei2: singleSellModal.imei2,
        customerName: singleSellModal.customerName,
        customerPhone: singleSellModal.customerPhone,
        basePrice,
        sellPrice,
        profit,
        paymentMethod: singleSellModal.paymentMethod,
        khataCustomerId: singleSellModal.paymentMethod === 'Udhar' ? singleSelectedKhataId : null,
        khataCustomerName: singleSellModal.paymentMethod === 'Udhar' ? khataCustomers.find(c => c.id === singleSelectedKhataId)?.name : null,
        saleDate: chosenSaleDate,
        date: localSaleDateTime,
        createdAt: serverTimestamp()
      };
      batch.set(saleRef, saleData);

      // 3. Create Bill Record
      const billRef = doc(collection(db, 'bills'));
      const billsSnap = await getDocs(collection(db, 'bills'));
      const shopBillsCount = billsSnap.docs.filter(b => isDocForShop(b.data(), currentShopId)).length;
      const billPrefix = shopProfile?.shortName || 'MZ';
      const billNumber = `${billPrefix}-${new Date().getFullYear()}-${String(shopBillsCount + 1).padStart(4, '0')}`;
      
      const billData = {
        shopId: currentShopId,
        shopName: shopProfile?.shopName || 'Mobile Shop',
        userId: user?.uid,
        userEmail: (user?.email || '').toLowerCase(),
        billNumber,
        customerName: singleSellModal.customerName,
        customerPhone: singleSellModal.customerPhone,
        items: [{
          mobileId: singleSellModal.id,
          modelName: `${singleSellModal.company} ${singleSellModal.modelName}`,
          ramRom: singleSellModal.ramRom,
          imei1: singleSellModal.imei1,
          imei2: singleSellModal.imei2,
          sellPrice,
          basePrice,
          profit
        }],
        totalSellPrice: sellPrice,
        totalProfit: profit,
        paymentMethod: singleSellModal.paymentMethod,
        khataCustomerId: singleSellModal.paymentMethod === 'Udhar' ? singleSelectedKhataId : null,
        khataCustomerName: singleSellModal.paymentMethod === 'Udhar' ? khataCustomers.find(c => c.id === singleSelectedKhataId)?.name : null,
        saleDate: chosenSaleDate,
        date: localSaleDateTime,
        createdAt: serverTimestamp()
      };
      batch.set(billRef, billData);
      batch.update(saleRef, { billId: billRef.id });

      // Handle Udhar
      if (singleSellModal.paymentMethod === 'Udhar' && singleSelectedKhataId) {
        const khataRef = doc(db, 'khata', singleSelectedKhataId);
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
            khataId: singleSelectedKhataId,
            customerName: khataSnap.data().name,
            transactionType: 'udhar',
            amount: sellPrice,
            description: `Mobile sale - ${singleSellModal.modelName}`,
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

      if (singleSellModal.paymentMethod === 'Udhar') {
        const khataName = khataCustomers.find(c => c.id === singleSelectedKhataId)?.name;
        success(`Rs. ${sellPrice.toLocaleString()} added to ${khataName}'s Khata`);
      } else {
        success("Sale completed");
      }

      setSingleSellModal(null);
      setSingleSelectedKhataId('');
      setPrintPromptData({ isOpen: true, billData: { id: billRef.id, ...billData }, profit });
      
    } catch (err: any) {
      error(err.message || 'Error processing sale');
    } finally {
      setIsSingleSelling(false);
      isSingleSellingRef.current = false;
    }
  };

  const openMultiSell = () => {
    setMultiCustomerName('');
    setMultiCustomerPhone('');
    setMultiPaymentMethod('Cash');
    setMultiItems([{
      id: Date.now().toString(),
      mobileId: '', modelName: '', basePrice: 0, ramRom: '', company: ''
    }]);
    setMultiSellModalOpen(true);
  };

  const addMultiRow = () => {
    setMultiItems(prev => [...prev, {
      id: Date.now().toString(),
      mobileId: '', modelName: '', basePrice: 0, ramRom: '', company: ''
    }]);
  };

  const updateMultiItem = (id: string, field: string, value: any) => {
    setMultiItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      if (field === 'mobileId') {
        const mobile = mobiles.find(m => m.id === value);
        return { 
          ...item, 
          mobileId: value, 
          modelName: mobile?.modelName || '', 
          company: mobile?.company || '',
          ramRom: mobile?.ramRom || '',
          basePrice: mobile?.basePrice || 0,
          imei1: mobile?.imei1 || '',
          imei2: mobile?.imei2 || '',
        };
      }
      return { ...item, [field]: value };
    }));
  };

  const handleMultiSell = async () => {
    if (isMultiSellingRef.current || isMultiSelling) return;

    // Validate
    if (!multiCustomerName) return error("Customer name is required");
    const validItems = multiItems.filter(i => i.mobileId);
    if (validItems.length === 0) return error("Please select at least one mobile to sell");

    if (multiPaymentMethod === 'Udhar' && !multiSelectedKhataId) {
      return error("Please select a Khata customer for Udhar payment");
    }

    isMultiSellingRef.current = true;
    setIsMultiSelling(true);

    try {
      const batch = writeBatch(db);
      
      const totalBasePrice = validItems.reduce((acc, item) => acc + (item.basePrice || 0), 0);
      const totalProfit = Number(multiTotalProfit) || 0;
      const totalSellPrice = totalBasePrice + totalProfit;

      // Group quantity reductions to check stock
      const qtyMap: Record<string, number> = {};
      validItems.forEach(i => {
        qtyMap[i.mobileId] = (qtyMap[i.mobileId] || 0) + 1;
      });
      
      for (const mobileId of Object.keys(qtyMap)) {
        const m = mobiles.find(x => x.id === mobileId);
        if (m && m.quantity < qtyMap[mobileId]) {
          throw new Error(`Not enough stock for ${m.modelName}`);
        }
        const mobileRef = doc(db, 'mobiles', mobileId);
        batch.update(mobileRef, { quantity: m.quantity - qtyMap[mobileId] });
      }

      // Create Bill
      const billRef = doc(collection(db, 'bills'));
      const billsSnap = await getDocs(collection(db, 'bills'));
      const shopBillsCount = billsSnap.docs.filter(b => isDocForShop(b.data(), currentShopId)).length;
      const billPrefix = shopProfile?.shortName || 'MZ';
      const billNumber = `${billPrefix}-${new Date().getFullYear()}-${String(shopBillsCount + 1).padStart(4, '0')}`;
      
      const billItems = validItems.map(item => {
        return {
          mobileId: item.mobileId,
          modelName: item.modelName,
          company: item.company,
          ramRom: item.ramRom,
          imei1: item.imei1 || '',
          imei2: item.imei2 || '',
          basePrice: item.basePrice,
          sellPrice: item.basePrice + (totalProfit / validItems.length), // Distribute profit evenly for bill items
          profit: totalProfit / validItems.length
        };
      });

      // Ensure exact local calendar date and time (immune to server UTC midnight regression)
      const chosenSaleDate = multiSaleDate || format(new Date(), 'yyyy-MM-dd');
      const [sYear, sMonth, sDay] = chosenSaleDate.split('-').map(Number);
      const now = new Date();
      const localSaleDateTime = new Date(sYear, sMonth - 1, sDay, now.getHours(), now.getMinutes(), now.getSeconds());

      const billData = {
        shopId: currentShopId,
        shopName: shopProfile?.shopName || 'Mobile Shop',
        userId: user?.uid,
        userEmail: (user?.email || '').toLowerCase(),
        billNumber,
        customerName: multiCustomerName,
        customerPhone: multiCustomerPhone,
        items: billItems,
        totalSellPrice,
        totalProfit,
        totalBaseCost: totalBasePrice,
        paymentMethod: multiPaymentMethod,
        khataCustomerId: multiPaymentMethod === 'Udhar' ? multiSelectedKhataId : null,
        khataCustomerName: multiPaymentMethod === 'Udhar' ? khataCustomers.find(c => c.id === multiSelectedKhataId)?.name : null,
        saleDate: chosenSaleDate,
        date: localSaleDateTime,
        createdAt: serverTimestamp()
      };
      
      batch.set(billRef, billData);

      // Create Sale records
      billItems.forEach(item => {
        const saleRef = doc(collection(db, 'sales'));
        batch.set(saleRef, {
          shopId: currentShopId,
          userId: user?.uid,
          userEmail: (user?.email || '').toLowerCase(),
          itemType: 'mobile',
          itemId: item.mobileId,
          itemName: `${item.company} ${item.modelName}`,
          company: item.company,
          imei1: '',
          imei2: '',
          customerName: multiCustomerName,
          customerPhone: multiCustomerPhone,
          basePrice: item.basePrice,
          sellPrice: item.sellPrice,
          profit: item.profit,
          paymentMethod: multiPaymentMethod,
          khataCustomerId: multiPaymentMethod === 'Udhar' ? multiSelectedKhataId : null,
          khataCustomerName: multiPaymentMethod === 'Udhar' ? khataCustomers.find(c => c.id === multiSelectedKhataId)?.name : null,
          billId: billRef.id,
          saleDate: chosenSaleDate,
          date: localSaleDateTime,
          createdAt: serverTimestamp()
        });
      });

      // Handle Udhar
      if (multiPaymentMethod === 'Udhar' && multiSelectedKhataId) {
        const khataRef = doc(db, 'khata', multiSelectedKhataId);
        const khataSnap = await getDoc(khataRef);
        if (khataSnap.exists()) {
          const currentBalance = khataSnap.data().totalBalance || 0;
          const newBalance = currentBalance + totalSellPrice;
          
          batch.update(khataRef, { totalBalance: newBalance });
          
          const txnRef = doc(collection(db, 'khataTransactions'));
          batch.set(txnRef, {
            shopId: currentShopId,
            userId: user?.uid,
            userEmail: (user?.email || '').toLowerCase(),
            khataId: multiSelectedKhataId,
            customerName: khataSnap.data().name,
            transactionType: 'udhar',
            amount: totalSellPrice,
            description: `Multiple Sale - ${validItems.length} mobiles`,
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

      if (multiPaymentMethod === 'Udhar') {
        const khataName = khataCustomers.find(c => c.id === multiSelectedKhataId)?.name;
        success(`Rs. ${totalSellPrice.toLocaleString()} added to ${khataName}'s Khata`);
      } else {
        success("Multiple sale completed");
      }

      setMultiSellModalOpen(false);
      setPrintPromptData({ isOpen: true, billData: { id: billRef.id, ...billData }, profit: totalProfit });
      setMultiSelectedKhataId('');
      setMultiTotalProfit(0);
    
    } catch (err: any) {
      error(err.message || 'Error processing sale');
    } finally {
      setIsMultiSelling(false);
      isMultiSellingRef.current = false;
    }
  };

  const handleScan = (imei: string) => {
    if (activeScanField) {
      if (!activeScanField.id) {
        // Single sell
        setSingleSellModal((prev: any) => ({ ...prev, [activeScanField.field]: imei }));
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Mobiles in Stock</h1>
          <p className="text-sm text-slate-500 mt-1">Available inventory ready for sale</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={openMultiSell} className="bg-[#522D60] hover:bg-[#42244E] text-white font-bold">
            <Zap className="w-4 h-4 mr-2" />
            Sell Multiple
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card p-4">
        <div className="mb-6">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by Model, Brand, IMEI, Color, Condition..." />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-slate-50 rounded-xl p-4 h-32 animate-pulse border border-slate-100" />
            ))
          ) : filteredMobiles.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-500">
              <Smartphone className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p>No mobiles available in stock.</p>
            </div>
          ) : (
            filteredMobiles.map((m) => (
              <div key={m.id} className="bg-primary-50 border border-primary-100 rounded-xl p-4 flex flex-col relative overflow-hidden group">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-500/15 text-amber-500 font-bold flex items-center justify-center shrink-0 border border-amber-500/20">
                      {(m.company || m.brand || 'M').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 leading-tight">{m.modelName}</h3>
                      <p className="text-sm font-medium text-amber-600">{m.company || m.brand || 'Samsung'}</p>
                    </div>
                  </div>
                  <Badge variant={m.quantity === 1 ? 'danger' : m.quantity <= 3 ? 'warning' : 'success'}>
                    Qty: {m.quantity}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-2 mb-4 text-xs font-medium flex-wrap">
                  {m.registerPageNo && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md font-mono font-black border border-amber-300">
                      Pg #{m.registerPageNo}
                    </span>
                  )}
                  <span className="px-2 py-1 bg-white rounded-md text-primary-600 border border-primary-100">{m.ramRom || 'N/A'}</span>
                  <span className="px-2 py-1 bg-white rounded-md text-slate-500 border border-slate-200">{m.condition}</span>
                </div>
                
                <div className="mt-auto flex items-center justify-between pt-3 border-t border-primary-500/10">
                  <div className="text-slate-900 font-bold">
                    Rs. {m.basePrice?.toLocaleString()}
                  </div>
                  <Button size="sm" onClick={() => openSingleSell(m)}>
                    Sell
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* SINGLE SELL MODAL */}
      <Modal 
        isOpen={!!singleSellModal} 
        onClose={() => setSingleSellModal(null)}
        title={`Sell ${singleSellModal?.modelName}`}
      >
        {singleSellModal && (
          <form onSubmit={handleSingleSell} className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-3 mb-4 flex justify-between items-center text-sm">
              <span className="text-slate-500">Base Price:</span>
              <span className="font-bold">Rs. {singleSellModal.basePrice.toLocaleString()}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500">Customer Name *</label>
                <input required type="text" className="w-full rounded-xl border border-primary-500/20 bg-white/5 px-4 py-2 text-slate-900 outline-none focus:border-primary-500 focus:ring-2"
                  value={singleSellModal.customerName} onChange={e => setSingleSellModal({...singleSellModal, customerName: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500">Customer Phone</label>
                <input type="text" className="w-full rounded-xl border border-primary-500/20 bg-white/5 px-4 py-2 text-slate-900 outline-none focus:border-primary-500 focus:ring-2"
                  value={singleSellModal.customerPhone} onChange={e => setSingleSellModal({...singleSellModal, customerPhone: e.target.value})} />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-medium text-slate-500">Sell Price (Rs.) *</label>
                <input required type="number" min={singleSellModal.basePrice} className="w-full rounded-xl border border-primary-500/20 bg-white/5 px-4 py-2 text-slate-900 outline-none focus:border-primary-500 focus:ring-2"
                  value={singleSellModal.sellPrice} onChange={e => setSingleSellModal({...singleSellModal, sellPrice: e.target.value})} />
                {Number(singleSellModal.sellPrice) > 0 && (
                  <p className={`text-xs mt-1 ${Number(singleSellModal.sellPrice) >= singleSellModal.basePrice ? 'text-accent-emerald' : 'text-accent-rose'}`}>
                    Profit: Rs. {(Number(singleSellModal.sellPrice) - singleSellModal.basePrice).toLocaleString()}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500">IMEI 1 (Optional)</label>
                <div className="flex gap-2">
                  <input type="text" maxLength={18} placeholder="Optional IMEI 1" className="w-full font-mono text-sm rounded-xl border border-primary-500/20 bg-white/5 px-3 py-2 text-slate-900 outline-none focus:border-primary-500 focus:ring-2"
                    value={singleSellModal.imei1} onChange={e => setSingleSellModal({...singleSellModal, imei1: e.target.value})} />
                  <button type="button" title="Scan IMEI 1" onClick={() => { setActiveScanField({ field: 'imei1' }); setScannerOpen(true); }} className="p-2 border border-primary-200 rounded-xl hover:bg-primary-50 text-primary-600">
                    <QrCode className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500">IMEI 2 (Optional)</label>
                <div className="flex gap-2">
                  <input type="text" maxLength={18} placeholder="Optional IMEI 2" className="w-full font-mono text-sm rounded-xl border border-primary-500/20 bg-white/5 px-3 py-2 text-slate-900 outline-none focus:border-primary-500 focus:ring-2"
                    value={singleSellModal.imei2} onChange={e => setSingleSellModal({...singleSellModal, imei2: e.target.value})} />
                  <button type="button" title="Scan IMEI 2" onClick={() => { setActiveScanField({ field: 'imei2' }); setScannerOpen(true); }} className="p-2 border border-primary-200 rounded-xl hover:bg-primary-50 text-primary-600">
                    <QrCode className="w-5 h-5" />
                  </button>
                </div>
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
                    setSingleSellModal({...singleSellModal, paymentMethod: method});
                    if (method !== 'Udhar') setSingleSelectedKhataId('');
                  }}
                  className={`py-2.5 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
                    singleSellModal.paymentMethod === method
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
            
            {singleSellModal.paymentMethod === 'Udhar' && (
              <div className="mt-3 p-4 bg-amber-50/50 border border-amber-200 rounded-xl">
                <label className="block text-xs font-semibold text-amber-800 mb-1.5 uppercase tracking-wide">Select Customer (Khata) *</label>
                {khataCustomers.length === 0 ? (
                  <div className="text-sm text-amber-700">
                    ⚠️ No customers in Khata. <a href="/khata" className="underline font-medium">Add a customer first</a>.
                  </div>
                ) : (
                  <select
                    value={singleSelectedKhataId}
                    onChange={(e) => setSingleSelectedKhataId(e.target.value)}
                    required
                    className="w-full border-2 border-amber-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
                  >
                    <option value="">-- Select Customer --</option>
                    {khataCustomers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} {c.totalBalance > 0 ? ` (Owes: Rs. ${c.totalBalance.toLocaleString()})` : ''}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
  

            <div className="pt-4">
              <Button 
                type="submit" 
                isLoading={isSingleSelling}
                disabled={isSingleSelling}
                className="w-full bg-[#522D60] hover:bg-[#42244E] text-white border-0 font-bold"
              >
                Complete Sale
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* MULTI SELL MODAL */}
      <Modal isOpen={multiSellModalOpen} onClose={() => setMultiSellModalOpen(false)} title="Sell Multiple Mobiles" size="xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Customer Name *</label>
            <input required type="text" className="w-full rounded-xl border border-primary-500/20 px-4 py-2 text-slate-900 outline-none focus:border-primary-500 focus:ring-2"
              value={multiCustomerName} onChange={e => setMultiCustomerName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Customer Phone</label>
            <input type="text" className="w-full rounded-xl border border-primary-500/20 px-4 py-2 text-slate-900 outline-none focus:border-primary-500 focus:ring-2"
              value={multiCustomerPhone} onChange={e => setMultiCustomerPhone(e.target.value)} />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium text-slate-500">Sale Date *</label>
            <input required type="date" className="w-full rounded-xl border border-primary-500/20 px-4 py-2 text-slate-900 outline-none focus:border-primary-500 focus:ring-2"
              value={multiSaleDate} onChange={e => setMultiSaleDate(e.target.value)} />
          </div>
        </div>
        
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method *</label>
          <div className="grid grid-cols-3 gap-2">
            {['Cash', 'Bank Transfer', 'Udhar'].map(method => (
              <button
                key={method}
                type="button"
                onClick={() => {
                  setMultiPaymentMethod(method);
                  if (method !== 'Udhar') setMultiSelectedKhataId('');
                }}
                className={`py-2.5 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
                  multiPaymentMethod === method
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
          
          {multiPaymentMethod === 'Udhar' && (
            <div className="mt-3 p-4 bg-amber-50/50 border border-amber-200 rounded-xl">
              <label className="block text-xs font-semibold text-amber-800 mb-1.5 uppercase tracking-wide">Select Customer (Khata) *</label>
              {khataCustomers.length === 0 ? (
                <div className="text-sm text-amber-700">
                  ⚠️ No customers in Khata. <a href="/khata" className="underline font-medium">Add a customer first</a>.
                </div>
              ) : (
                <select
                  value={multiSelectedKhataId}
                  onChange={(e) => setMultiSelectedKhataId(e.target.value)}
                  required
                  className="w-full border-2 border-amber-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
                >
                  <option value="">-- Select Customer --</option>
                  {khataCustomers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.totalBalance > 0 ? ` (Owes: Rs. ${c.totalBalance.toLocaleString()})` : ''}</option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>
  

        <div className="space-y-4 mb-4 max-h-[40vh] overflow-y-auto pr-2">
          {multiItems.map((item, index) => (
            <div key={item.id} className="border border-primary-100 rounded-xl p-4 bg-primary-50/30 relative">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-primary-700">Mobile #{index + 1}</span>
                {multiItems.length > 1 && (
                  <button onClick={() => setMultiItems(prev => prev.filter(i => i.id !== item.id))} className="text-accent-rose hover:bg-accent-rose/10 p-1 rounded-md transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <select
                value={item.mobileId}
                onChange={(e) => updateMultiItem(item.id, 'mobileId', e.target.value)}
                className="w-full mb-3 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              >
                <option value="">Select Mobile *</option>
                {mobiles.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.company} {m.modelName} — {m.ramRom} (Qty: {m.quantity})
                  </option>
                ))}
              </select>

              {item.mobileId && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Sell Price (Optional)</label>
                    <input
                      type="number"
                      value={item.sellPrice || ''}
                      onChange={(e) => updateMultiItem(item.id, 'sellPrice', e.target.value)}
                      placeholder={`Min: Rs. ${item.basePrice}`}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                    />
                    {Number(item.sellPrice) > 0 && (
                      <p className={`text-[11px] mt-1 font-medium ${Number(item.sellPrice) >= item.basePrice ? 'text-accent-emerald' : 'text-accent-rose'}`}>
                        Profit: Rs. {(Number(item.sellPrice) - item.basePrice).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/80 flex flex-col justify-center text-xs text-slate-600 gap-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Base Cost:</span>
                      <strong className="text-slate-800 font-semibold">Rs. {(item.basePrice || 0).toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">RAM / Storage:</span>
                      <strong className="text-slate-800 font-semibold">{item.ramRom || 'N/A'}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <button onClick={addMultiRow} className="w-full py-2.5 border-2 border-dashed border-[#522D60]/30 rounded-xl text-[#522D60] hover:bg-[#FAF5FC] transition-colors text-sm font-semibold flex items-center justify-center gap-2 mb-6">
          <Plus className="w-4 h-4" /> Add Another Mobile
        </button>

        <div className="bg-[#522D60] rounded-2xl p-4 text-white mb-6 shadow-md border border-[#522D60]">
          <div className="flex justify-between text-xs sm:text-sm mb-2 pb-2 border-b border-white/20">
            <span className="text-white/80">Total Base Cost (all mobiles):</span>
            <span className="font-semibold">Rs. {multiItems.reduce((s, i) => s + (i.basePrice || 0), 0).toLocaleString()}</span>
          </div>
          
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs sm:text-sm font-medium text-white/90">Total Profit Expected:</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-white/80 font-medium">Rs.</span>
              <input
                type="number"
                min="0"
                value={multiTotalProfit || ''}
                onChange={(e) => setMultiTotalProfit(parseFloat(e.target.value) || 0)}
                placeholder="Profit"
                className="w-32 bg-white/15 border border-white/30 text-white placeholder:text-white/50 rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-white text-right font-bold text-sm"
              />
            </div>
          </div>

          <div className="flex justify-between font-extrabold text-base sm:text-lg pt-2 border-t border-white/20">
            <span>Total Final Sale Amount:</span>
            <span className="text-white">Rs. {(multiItems.reduce((s, i) => s + (i.basePrice || 0), 0) + (multiTotalProfit || 0)).toLocaleString()}</span>
          </div>
        </div>

        <Button 
          onClick={handleMultiSell} 
          isLoading={isMultiSelling} 
          disabled={isMultiSelling} 
          className="w-full bg-[#522D60] hover:bg-[#42244E] text-white font-bold py-3 rounded-xl shadow-md"
        >
          Complete Sale & Generate Bill
        </Button>
      </Modal>

      <BarcodeScanner isOpen={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleScan} />
      <PrintPromptModal isOpen={printPromptData.isOpen} onClose={() => setPrintPromptData({ isOpen: false, billData: null, profit: 0 })} billData={printPromptData.billData} profit={printPromptData.profit} />
    </div>
  );
}

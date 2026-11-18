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
  const [multiTotalProfit, setMultiTotalProfit] = useState<number | string>(0);
  
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

    const unsubKhata = onSnapshot(
      collection(db, 'khata'),
      (snap) => {
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(c => isDocForShop(c, currentShopId));
        list.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
        setKhataCustomers(list);
      },
      () => {}
    );

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
    return () => {
      unsubKhata();
      unsub();
    };
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

  const WARRANTY_PRESETS = [
    { key: 'none', label: 'No Warranty', days: 0, printLabel: 'No Warranty' },
    { key: '3d', label: '3 Days Check', days: 3, printLabel: '3 Days Check Warranty' },
    { key: '7d', label: '7 Days Check', days: 7, printLabel: '7 Days Check Warranty' },
    { key: '15d', label: '15 Days', days: 15, printLabel: '15 Days Check Warranty' },
    { key: '1y', label: '1 Year Brand', days: 365, printLabel: '1 Year Brand Warranty' },
    { key: 'custom', label: 'Custom Days', days: -1, printLabel: 'Custom' },
  ];

  const isImeiCheckEnabled = Boolean(shopProfile?.enableImeiCheck);

  const resolveWarrantyInfo = (warrantyKey: string, customDaysStr: string) => {
    if (!isImeiCheckEnabled) {
      return {
        warrantyDays: null,
        warrantyLabel: '',
      };
    }
    if (warrantyKey === 'custom') {
      const d = Math.max(0, parseInt(customDaysStr, 10) || 0);
      return {
        warrantyDays: d,
        warrantyLabel: d > 0 ? `${d} Days Check Warranty` : 'No Warranty',
      };
    }
    const found = WARRANTY_PRESETS.find(p => p.key === warrantyKey) || WARRANTY_PRESETS[0];
    return {
      warrantyDays: found.days,
      warrantyLabel: found.printLabel,
    };
  };

  const [multiWarrantyKey, setMultiWarrantyKey] = useState('none');
  const [multiCustomWarrantyDays, setMultiCustomWarrantyDays] = useState('');

  const openSingleSell = (mobile: any) => {
    setSingleSellModal({
      ...mobile,
      customerName: '',
      customerPhone: '',
      saleDate: format(new Date(), 'yyyy-MM-dd'),
      sellPrice: mobile.basePrice.toString(),
      imei1: mobile.imei1 || '',
      imei2: mobile.imei2 || '',
      paymentMethod: 'Cash',
      warrantyKey: mobile.condition === 'New' ? '1y' : '3d',
      customWarrantyDays: ''
    });
  };

  const handleSingleSell = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleSellModal || isSingleSellingRef.current || isSingleSelling) return;

    const sellPrice = Number(singleSellModal.sellPrice);
    if (isNaN(sellPrice) || sellPrice <= 0) {
      return error("Please enter a valid sell price");
    }

    if (singleSellModal.paymentMethod === 'Udhar' && !singleSelectedKhataId) {
      return error("Please select a Khata customer for Udhar payment");
    }

    isSingleSellingRef.current = true;
    setIsSingleSelling(true);

    try {
      const basePrice = Number(singleSellModal.basePrice) || 0;
      const profit = sellPrice - basePrice;
      const { warrantyDays, warrantyLabel } = resolveWarrantyInfo(
        singleSellModal.warrantyKey || 'none',
        singleSellModal.customWarrantyDays || ''
      );

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
      const resolvedCustomerName = singleSellModal.customerName?.trim() 
        || (singleSellModal.paymentMethod === 'Udhar' ? (khataCustomers.find(c => c.id === singleSelectedKhataId)?.name || 'Khata Customer') : 'Walk-in Customer');

      const cleanSingleCompany = singleSellModal.company || singleSellModal.brand || 'Samsung';
      const cleanSingleModel = singleSellModal.modelName || singleSellModal.name || 'Mobile';
      const fullSingleName = cleanSingleModel.toLowerCase().startsWith(cleanSingleCompany.toLowerCase())
        ? cleanSingleModel
        : `${cleanSingleCompany} ${cleanSingleModel}`.trim();

      // 2. Create Bill Record
      const billRef = doc(collection(db, 'bills'));
      const billsSnap = await getDocs(collection(db, 'bills'));
      const shopBillsCount = billsSnap.docs.filter(b => isDocForShop(b.data(), currentShopId)).length;
      const billPrefix = shopProfile?.shortName || 'MZ';
      const billNumber = `${billPrefix}-${new Date().getFullYear()}-${String(shopBillsCount + 1).padStart(4, '0')}`;

      // 3. Create Sale Record
      const saleRef = doc(collection(db, 'sales'));
      const saleData = {
        shopId: currentShopId,
        userId: user?.uid,
        userEmail: (user?.email || '').toLowerCase(),
        itemType: 'mobile',
        itemId: singleSellModal.id,
        itemName: fullSingleName,
        name: fullSingleName,
        modelName: cleanSingleModel,
        company: cleanSingleCompany,
        brand: cleanSingleCompany,
        ramRom: singleSellModal.ramRom || '',
        condition: singleSellModal.condition || 'Used',
        supplierName: singleSellModal.supplier || singleSellModal.supplierName || '',
        supplier: singleSellModal.supplier || singleSellModal.supplierName || '',
        imei1: singleSellModal.imei1 || '',
        imei2: singleSellModal.imei2 || '',
        customerName: resolvedCustomerName,
        customerPhone: singleSellModal.customerPhone || '',
        basePrice,
        costPrice: basePrice,
        sellPrice,
        profit,
        warrantyDays,
        warrantyLabel,
        paymentMethod: singleSellModal.paymentMethod,
        khataCustomerId: singleSellModal.paymentMethod === 'Udhar' ? singleSelectedKhataId : null,
        khataCustomerName: singleSellModal.paymentMethod === 'Udhar' ? khataCustomers.find(c => c.id === singleSelectedKhataId)?.name : null,
        billId: billRef.id,
        billNumber,
        saleDate: chosenSaleDate,
        date: localSaleDateTime,
        createdAt: serverTimestamp()
      };
      batch.set(saleRef, saleData);
      
      const billData = {
        shopId: currentShopId,
        shopName: shopProfile?.shopName || 'Mobile Shop',
        userId: user?.uid,
        userEmail: (user?.email || '').toLowerCase(),
        billNumber,
        customerName: resolvedCustomerName,
        customerPhone: singleSellModal.customerPhone || '',
        warrantyDays,
        warrantyLabel,
        items: [{
          mobileId: singleSellModal.id,
          modelName: cleanSingleModel,
          itemName: fullSingleName,
          name: fullSingleName,
          company: cleanSingleCompany,
          brand: cleanSingleCompany,
          ramRom: singleSellModal.ramRom || '',
          condition: singleSellModal.condition || 'Used',
          imei1: singleSellModal.imei1 || '',
          imei2: singleSellModal.imei2 || '',
          sellPrice,
          basePrice,
          profit,
          warrantyDays,
          warrantyLabel
        }],
        totalBaseCost: basePrice,
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
            description: `Mobile Sale: ${fullSingleName}`,
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
    setMultiWarrantyKey('3d');
    setMultiCustomWarrantyDays('');
    setMultiTotalProfit(0);
    setMultiItems([{
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      mobileId: '', modelName: '', basePrice: 0, ramRom: '', company: '', sellPrice: ''
    }]);
    setMultiSellModalOpen(true);
  };

  const addMultiRow = () => {
    setMultiItems(prev => [...prev, {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      mobileId: '', modelName: '', basePrice: 0, ramRom: '', company: '', sellPrice: ''
    }]);
  };

  const updateMultiItem = (id: string, field: string, value: any) => {
    setMultiItems(prev => {
      const next = prev.map(item => {
        if (item.id !== id) return item;
        if (field === 'mobileId') {
          const mobile = mobiles.find(m => m.id === value);
          return { 
            ...item, 
            mobileId: value, 
            modelName: mobile?.modelName || mobile?.name || '', 
            company: mobile?.company || mobile?.brand || 'Samsung',
            ramRom: mobile?.ramRom || mobile?.storage || '',
            basePrice: Number(mobile?.basePrice ?? mobile?.buyPrice ?? mobile?.costPrice) || 0,
            condition: mobile?.condition || 'Used',
            supplierName: mobile?.supplier || mobile?.supplierName || '',
            imei1: mobile?.imei1 || '',
            imei2: mobile?.imei2 || '',
          };
        }
        return { ...item, [field]: value };
      });

      // Only auto-compute combined profit from individual sell prices when user edits sellPrice
      // and at least one item has a sellPrice that differs from its base cost
      if (field === 'sellPrice') {
        const itemsWithCustomPrice = next.filter(
          i =>
            i.mobileId &&
            i.sellPrice !== undefined &&
            i.sellPrice !== '' &&
            !isNaN(Number(i.sellPrice)) &&
            Number(i.sellPrice) > 0 &&
            Math.round(Number(i.sellPrice)) !== Math.round(Number(i.basePrice) || 0)
        );
        if (itemsWithCustomPrice.length > 0) {
          const computedProfit = itemsWithCustomPrice.reduce(
            (sum, i) => sum + (Math.round(Number(i.sellPrice)) - (Math.round(Number(i.basePrice)) || 0)),
            0
          );
          setMultiTotalProfit(computedProfit);
        }
      }
      return next;
    });
  };

  const handleMultiSell = async () => {
    if (isMultiSellingRef.current || isMultiSelling) return;

    // Validate selected mobiles
    const validItems = multiItems.filter(i => i.mobileId);
    if (validItems.length === 0) return error("Please select at least one mobile to sell");

    if (multiPaymentMethod === 'Udhar' && !multiSelectedKhataId) {
      return error("Please select a Khata customer for Udhar payment");
    }

    isMultiSellingRef.current = true;
    setIsMultiSelling(true);

    try {
      const batch = writeBatch(db);
      const { warrantyDays, warrantyLabel } = resolveWarrantyInfo(multiWarrantyKey, multiCustomWarrantyDays);
      
      const totalBasePrice = validItems.reduce((acc, item) => acc + (Math.round(Number(item.basePrice)) || 0), 0);
      const enteredTotalProfit = Math.round(Number(multiTotalProfit) || 0);

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

      // Check if items have explicit individual sell prices that differ from base cost
      const itemsWithCustomSell = validItems.filter(
        i =>
          i.sellPrice !== undefined &&
          i.sellPrice !== '' &&
          !isNaN(Number(i.sellPrice)) &&
          Number(i.sellPrice) > 0 &&
          Math.round(Number(i.sellPrice)) !== Math.round(Number(i.basePrice) || 0)
      );
      const customProfitSum = itemsWithCustomSell.reduce(
        (sum, i) => sum + (Math.round(Number(i.sellPrice)) - (Math.round(Number(i.basePrice)) || 0)),
        0
      );

      const useIndividualPrices =
        itemsWithCustomSell.length > 0 &&
        (itemsWithCustomSell.length < validItems.length || customProfitSum === enteredTotalProfit);

      const unpricedCount = validItems.length - itemsWithCustomSell.length;
      const remainingProfitForUnpriced = enteredTotalProfit - customProfitSum;
      let unpricedIdx = 0;

      const billItems = validItems.map((item, idx) => {
        const itemBase = Math.round(Number(item.basePrice) || 0);
        const isCustomPriced =
          useIndividualPrices &&
          item.sellPrice !== undefined &&
          item.sellPrice !== '' &&
          !isNaN(Number(item.sellPrice)) &&
          Number(item.sellPrice) > 0 &&
          Math.round(Number(item.sellPrice)) !== itemBase;

        let itemProfit = 0;
        let itemSell = itemBase;

        if (isCustomPriced) {
          itemSell = Math.round(Number(item.sellPrice));
          itemProfit = itemSell - itemBase;
        } else if (useIndividualPrices && unpricedCount > 0) {
          const baseShare = Math.floor(remainingProfitForUnpriced / unpricedCount);
          const rem = remainingProfitForUnpriced - baseShare * unpricedCount;
          itemProfit = unpricedIdx === 0 ? baseShare + rem : baseShare;
          itemSell = itemBase + itemProfit;
          unpricedIdx++;
        } else {
          // Combined Profit Mode across all selected mobiles
          const count = validItems.length;
          const baseShare = Math.floor(enteredTotalProfit / count);
          const rem = enteredTotalProfit - baseShare * count;
          itemProfit = idx === 0 ? baseShare + rem : baseShare;
          itemSell = itemBase + itemProfit;
        }

        const cleanCompany = item.company || 'Samsung';
        const cleanModel = item.modelName || 'Mobile';
        const fullItemName = cleanModel.toLowerCase().startsWith(cleanCompany.toLowerCase())
          ? cleanModel
          : `${cleanCompany} ${cleanModel}`.trim();

        return {
          mobileId: item.mobileId,
          modelName: cleanModel,
          itemName: fullItemName,
          name: fullItemName,
          company: cleanCompany,
          brand: cleanCompany,
          ramRom: item.ramRom || '',
          condition: item.condition || 'Used',
          supplierName: item.supplierName || '',
          imei1: item.imei1 || '',
          imei2: item.imei2 || '',
          basePrice: itemBase,
          sellPrice: itemSell,
          profit: itemProfit,
          warrantyDays,
          warrantyLabel
        };
      });

      const totalProfit = billItems.reduce((sum, i) => sum + i.profit, 0);
      const totalSellPrice = billItems.reduce((sum, i) => sum + i.sellPrice, 0);

      // Ensure exact local calendar date and time (immune to server UTC midnight regression)
      const chosenSaleDate = multiSaleDate || format(new Date(), 'yyyy-MM-dd');
      const [sYear, sMonth, sDay] = chosenSaleDate.split('-').map(Number);
      const now = new Date();
      const localSaleDateTime = new Date(sYear, sMonth - 1, sDay, now.getHours(), now.getMinutes(), now.getSeconds());

      const resolvedCustomerName = multiCustomerName?.trim() 
        || (multiPaymentMethod === 'Udhar' ? (khataCustomers.find(c => c.id === multiSelectedKhataId)?.name || 'Khata Customer') : 'Walk-in Customer');

      const billData = {
        shopId: currentShopId,
        shopName: shopProfile?.shopName || 'Mobile Shop',
        userId: user?.uid,
        userEmail: (user?.email || '').toLowerCase(),
        billNumber,
        customerName: resolvedCustomerName,
        customerPhone: multiCustomerPhone || '',
        warrantyDays,
        warrantyLabel,
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
          isMultiSale: validItems.length > 1,
          multiSaleCount: validItems.length,
          totalCombinedProfit: totalProfit,
          totalCombinedSellPrice: totalSellPrice,
          itemId: item.mobileId,
          itemName: item.itemName,
          name: item.itemName,
          modelName: item.modelName,
          company: item.company,
          brand: item.company,
          ramRom: item.ramRom || '',
          condition: item.condition || 'Used',
          supplierName: item.supplierName || '',
          supplier: item.supplierName || '',
          imei1: item.imei1 || '',
          imei2: item.imei2 || '',
          customerName: resolvedCustomerName,
          customerPhone: multiCustomerPhone || '',
          basePrice: item.basePrice,
          costPrice: item.basePrice,
          sellPrice: item.sellPrice,
          profit: item.profit,
          warrantyDays,
          warrantyLabel,
          paymentMethod: multiPaymentMethod,
          khataCustomerId: multiPaymentMethod === 'Udhar' ? multiSelectedKhataId : null,
          khataCustomerName: multiPaymentMethod === 'Udhar' ? khataCustomers.find(c => c.id === multiSelectedKhataId)?.name : null,
          billId: billRef.id,
          billNumber,
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
          
          const productNamesList = billItems.map(i => i.itemName).filter(Boolean).join(', ');
          const txnRef = doc(collection(db, 'khataTransactions'));
          batch.set(txnRef, {
            shopId: currentShopId,
            userId: user?.uid,
            userEmail: (user?.email || '').toLowerCase(),
            khataId: multiSelectedKhataId,
            customerName: khataSnap.data().name,
            transactionType: 'udhar',
            amount: totalSellPrice,
            description: `Multiple Sale (${validItems.length} Mobiles): ${productNamesList}`,
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
                <label className="text-xs font-medium text-slate-500">Customer Name (Optional)</label>
                <input type="text" placeholder="Walk-in Customer (Optional)" className="w-full rounded-xl border border-primary-500/20 bg-white/5 px-4 py-2 text-slate-900 outline-none focus:border-primary-500 focus:ring-2"
                  value={singleSellModal.customerName} onChange={e => setSingleSellModal({...singleSellModal, customerName: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500">Customer Phone</label>
                <input type="text" className="w-full rounded-xl border border-primary-500/20 bg-white/5 px-4 py-2 text-slate-900 outline-none focus:border-primary-500 focus:ring-2"
                  value={singleSellModal.customerPhone} onChange={e => setSingleSellModal({...singleSellModal, customerPhone: e.target.value})} />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-medium text-slate-500">Sell Price (Rs.) *</label>
                <input required type="number" min="1" step="any" className="w-full rounded-xl border border-primary-500/20 bg-white/5 px-4 py-2 text-slate-900 outline-none focus:border-primary-500 focus:ring-2"
                  value={singleSellModal.sellPrice} onChange={e => setSingleSellModal({...singleSellModal, sellPrice: e.target.value})} />
                {Number(singleSellModal.sellPrice) > 0 && (
                  <p className={`text-xs mt-1 font-semibold ${Number(singleSellModal.sellPrice) >= singleSellModal.basePrice ? 'text-accent-emerald' : 'text-rose-600'}`}>
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

            {/* 1-CLICK WARRANTY SELECTOR (Only shown when IMEI & Warranty Check is enabled in Settings) */}
            {isImeiCheckEnabled && (
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Phone Warranty (Prints on Bill & Saved for IMEI Check)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {WARRANTY_PRESETS.map((preset) => {
                    const isSelected = (singleSellModal.warrantyKey || 'none') === preset.key;
                    return (
                      <button
                        key={preset.key}
                        type="button"
                        onClick={() => setSingleSellModal({ ...singleSellModal, warrantyKey: preset.key })}
                        className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
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
                {singleSellModal.warrantyKey === 'custom' && (
                  <div className="pt-1">
                    <input
                      type="number"
                      min="1"
                      max="1095"
                      placeholder="Enter custom warranty days (e.g. 10, 30, 60)"
                      value={singleSellModal.customWarrantyDays || ''}
                      onChange={(e) => setSingleSellModal({ ...singleSellModal, customWarrantyDays: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-bold text-slate-900 outline-none focus:border-[#522D60]"
                    />
                  </div>
                )}
              </div>
            )}

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
            <label className="text-xs font-medium text-slate-500">Customer Name (Optional)</label>
            <input type="text" placeholder="Walk-in Customer (Optional)" className="w-full rounded-xl border border-primary-500/20 px-4 py-2 text-slate-900 outline-none focus:border-primary-500 focus:ring-2"
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
        
        {/* 1-CLICK WARRANTY SELECTOR FOR MULTI SELL (Only shown when IMEI & Warranty Check is enabled in Settings) */}
        {isImeiCheckEnabled && (
          <div className="mb-5 space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Phone Warranty (Prints on Bill & Saved for IMEI Check)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
              {WARRANTY_PRESETS.map((preset) => {
                const isSelected = multiWarrantyKey === preset.key;
                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => setMultiWarrantyKey(preset.key)}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
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
            {multiWarrantyKey === 'custom' && (
              <div className="pt-1">
                <input
                  type="number"
                  min="1"
                  max="1095"
                  placeholder="Enter custom warranty days (e.g. 10, 30, 60)"
                  value={multiCustomWarrantyDays}
                  onChange={(e) => setMultiCustomWarrantyDays(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-bold text-slate-900 outline-none focus:border-[#522D60]"
                />
              </div>
            )}
          </div>
        )}

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
          {multiItems.map((item, index) => {
            const validCount = Math.max(1, multiItems.filter(i => i.mobileId).length);
            const selectedOrderIdx = multiItems.filter(i => i.mobileId).findIndex(i => i.id === item.id);
            const enteredCombinedProfit = Math.round(Number(multiTotalProfit) || 0);
            const baseShare = Math.floor(enteredCombinedProfit / validCount);
            const rem = enteredCombinedProfit - baseShare * validCount;
            const shareProfit = selectedOrderIdx === 0 ? baseShare + rem : baseShare;
            const itemBase = Math.round(Number(item.basePrice) || 0);
            const hasCustomSell =
              item.sellPrice !== undefined &&
              item.sellPrice !== '' &&
              !isNaN(Number(item.sellPrice)) &&
              Number(item.sellPrice) > 0 &&
              Math.round(Number(item.sellPrice)) !== itemBase;
            const effectiveItemProfit = hasCustomSell
              ? Math.round(Number(item.sellPrice)) - itemBase
              : shareProfit;
            const effectiveItemSell = itemBase + effectiveItemProfit;

            return (
              <div key={item.id} className="border border-primary-100 rounded-xl p-4 bg-primary-50/30 relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-primary-700">
                    Mobile #{index + 1}
                    {item.mobileId && (
                      <span className="ml-2 text-xs font-bold text-slate-800">
                        — {item.company} {item.modelName}
                      </span>
                    )}
                  </span>
                  {multiItems.length > 1 && (
                    <button onClick={() => setMultiItems(prev => prev.filter(i => i.id !== item.id))} className="text-accent-rose hover:bg-accent-rose/10 p-1 rounded-md transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <select
                  value={item.mobileId}
                  onChange={(e) => updateMultiItem(item.id, 'mobileId', e.target.value)}
                  className="w-full mb-3 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                >
                  <option value="">Select Mobile *</option>
                  {mobiles
                    .filter(m => (Number(m.quantity) || 0) > 0 || m.id === item.mobileId)
                    .map(m => (
                      <option key={m.id} value={m.id}>
                        {m.company || m.brand || 'Samsung'} {m.modelName} {m.ramRom ? `— ${m.ramRom}` : ''} | Cost: Rs. {(Number(m.basePrice) || 0).toLocaleString()} (Qty: {m.quantity})
                      </option>
                    ))}
                </select>

                {item.mobileId && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">
                        Individual Sell Price (Optional)
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        value={item.sellPrice || ''}
                        onChange={(e) => updateMultiItem(item.id, 'sellPrice', e.target.value)}
                        placeholder="Leave blank to use Combined Profit below"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                      />
                      <p className={`text-[11px] mt-1 font-semibold ${effectiveItemProfit >= 0 ? 'text-accent-emerald' : 'text-rose-600'}`}>
                        Profit: {effectiveItemProfit >= 0 ? '+' : ''}Rs. {effectiveItemProfit.toLocaleString()} • Sell: Rs. {effectiveItemSell.toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/80 flex flex-col justify-center text-xs text-slate-600 gap-1.5">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Base Cost:</span>
                        <strong className="text-slate-800 font-semibold">Rs. {itemBase.toLocaleString()}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">RAM / Storage:</span>
                        <strong className="text-slate-800 font-semibold">{item.ramRom || 'N/A'}</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button onClick={addMultiRow} className="w-full py-2.5 border-2 border-dashed border-[#522D60]/30 rounded-xl text-[#522D60] hover:bg-[#FAF5FC] transition-colors text-sm font-semibold flex items-center justify-center gap-2 mb-6">
          <Plus className="w-4 h-4" /> Add Another Mobile
        </button>

        <div className="bg-[#522D60] rounded-2xl p-4 text-white mb-6 shadow-md border border-[#522D60]">
          <div className="flex justify-between text-xs sm:text-sm mb-2 pb-2 border-b border-white/20">
            <span className="text-white/80">Total Base Cost (all mobiles):</span>
            <span className="font-semibold">Rs. {multiItems.reduce((s, i) => s + (Number(i.basePrice) || 0), 0).toLocaleString()}</span>
          </div>
          
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs sm:text-sm font-medium text-white/90">Combined Profit (All Mobiles):</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-white/80 font-medium">Rs.</span>
              <input
                type="number"
                step="any"
                value={multiTotalProfit === 0 ? '' : multiTotalProfit}
                onChange={(e) => {
                  const val = e.target.value;
                  setMultiTotalProfit(val);
                  // Clear any individual sellPrice overrides so Combined Profit applies cleanly across all items
                  setMultiItems(prev => prev.map(it => ({ ...it, sellPrice: '' })));
                }}
                placeholder="Profit / -Loss"
                className="w-32 bg-white/15 border border-white/30 text-white placeholder:text-white/50 rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-white text-right font-bold text-sm"
              />
            </div>
          </div>

          <div className="flex justify-between font-extrabold text-base sm:text-lg pt-2 border-t border-white/20">
            <span>Total Final Sale Amount:</span>
            <span className="text-white">Rs. {(multiItems.reduce((s, i) => s + (Number(i.basePrice) || 0), 0) + (Number(multiTotalProfit) || 0)).toLocaleString()}</span>
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

      <BarcodeScanner 
        isOpen={scannerOpen} 
        onClose={() => setScannerOpen(false)} 
        onScan={handleScan}
        onScanBoth={(imei1, imei2) => {
          setSingleSellModal((prev: any) => ({ ...prev, imei1, imei2 }));
          success(`Both IMEIs added: ${imei1} & ${imei2}`);
        }}
        targetField={activeScanField?.field}
        title={activeScanField?.field === 'imei2' ? 'Scan IMEI 2' : 'Scan IMEI 1'}
      />
      <PrintPromptModal isOpen={printPromptData.isOpen} onClose={() => setPrintPromptData({ isOpen: false, billData: null, profit: 0 })} billData={printPromptData.billData} profit={printPromptData.profit} />
    </div>
  );
}

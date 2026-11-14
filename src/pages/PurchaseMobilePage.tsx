import React, { useEffect, useState, useRef } from "react";
import { collection, query, orderBy, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { SearchBar } from '../components/ui/SearchBar';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { useAuth } from '../contexts/AuthContext';
import { isDocForShop } from '../utils/multiTenantService';
import { Edit, Trash2, Smartphone, QrCode } from 'lucide-react';
import { format } from 'date-fns';
import { parseDateSafe, formatDateSafe } from '../utils/dateUtils';
import { BarcodeScanner } from '../components/BarcodeScanner';

const COMPANIES = [
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

const FILTER_COMPANIES = [
  { value: '', label: 'All Companies' },
  ...COMPANIES
];

export default function PurchaseMobilePage() {
  const { user, shopProfile, currentShopId } = useAuth();
  const [mobiles, setMobiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  
  // Scanner state
  const [scannerOpen, setScannerOpen] = useState(false);
  const [activeScanField, setActiveScanField] = useState<'imei1' | 'imei2' | null>(null);
  const [suppliersList, setSuppliersList] = useState<any[]>([]);

  // Inline Quick Add Supplier inside Purchase Modal
  const [showInlineAddSupplier, setShowInlineAddSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);

  const [formData, setFormData] = useState({
    modelName: '',
    company: 'Samsung',
    customCompany: '',
    ramRom: '',
    basePrice: '',
    quantity: '1',
    condition: 'New',
    purchaseDate: format(new Date(), 'yyyy-MM-dd'),
    supplier: '',
    supplierId: '',
    purchasePaymentType: 'Cash' as 'Cash' | 'SupplierCredit',
    registerPageNo: '',
    imei1: '',
    imei2: '',
    notes: ''
  });

  const { success, error } = useToast();
  const { confirm } = useConfirm();

  const handleCreateSupplierInline = async () => {
    if (!user || !currentShopId) return error('Please sign in first');
    const cleanName = newSupplierName.trim();
    if (!cleanName) return error('Please enter supplier name');
    if (isCreatingSupplier) return;

    setIsCreatingSupplier(true);
    try {
      const supRef = await addDoc(collection(db, 'suppliers'), {
        shopId: currentShopId,
        userId: user.uid,
        userEmail: (user.email || '').toLowerCase(),
        name: cleanName,
        phone: newSupplierPhone.trim(),
        notes: '',
        totalBalance: 0,
        createdAt: serverTimestamp(),
      });

      setFormData((prev) => ({
        ...prev,
        supplierId: supRef.id,
        supplier: cleanName,
        purchasePaymentType: 'SupplierCredit',
      }));
      setNewSupplierName('');
      setNewSupplierPhone('');
      setShowInlineAddSupplier(false);
      success(`Supplier "${cleanName}" added and selected`);
    } catch (err: any) {
      error(err.message || 'Failed to add supplier');
    } finally {
      setIsCreatingSupplier(false);
    }
  };

  const handleScan = (imei: string) => {
    if (activeScanField) {
      setFormData(prev => ({ ...prev, [activeScanField]: imei }));
      success(`IMEI scanned: ${imei}`);
    }
  };

  useEffect(() => {
    if (!user) return;
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
        console.warn('PurchaseMobile listener error:', err.message);
        setLoading(false);
      }
    );

    const unsubSuppliers = onSnapshot(
      collection(db, 'suppliers'),
      (snap) => {
        const sList = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(s => isDocForShop(s, currentShopId));
        sList.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
        setSuppliersList(sList);
      },
      () => {}
    );

    return () => {
      unsub();
      unsubSuppliers();
    };
  }, [user, currentShopId]);

  const filteredMobiles = mobiles.filter(m => {
    const comp = m.company || m.brand || '';
    const regNo = (m.registerPageNo || '').toString();
    const matchesSearch = (m.modelName && m.modelName.toLowerCase().includes(search.toLowerCase())) || 
                          comp.toLowerCase().includes(search.toLowerCase()) ||
                          regNo.toLowerCase().includes(search.toLowerCase()) ||
                          (m.imei1 && m.imei1.includes(search)) ||
                          (m.imei2 && m.imei2.includes(search));
    const matchesCompany = filterCompany ? comp.toLowerCase() === filterCompany.toLowerCase() : true;
    return matchesSearch && matchesCompany;
  });

  const handleOpenModal = (mobile?: any) => {
    setShowInlineAddSupplier(false);
    setNewSupplierName('');
    setNewSupplierPhone('');
    if (mobile) {
      setEditingId(mobile.id);
      const rawComp = mobile.company || mobile.brand || '';
      const isPreset = COMPANIES.some(c => c.value.toLowerCase() === rawComp.toLowerCase() && c.value !== 'Other');
      setFormData({
        modelName: mobile.modelName || '',
        company: isPreset ? rawComp : (rawComp ? 'Other' : 'Samsung'),
        customCompany: isPreset ? '' : rawComp,
        ramRom: mobile.ramRom || '',
        basePrice: (mobile.basePrice ?? '').toString(),
        quantity: (mobile.quantity ?? '1').toString(),
        condition: mobile.condition || 'New',
        purchaseDate: formatDateSafe(mobile.purchaseDate || new Date(), 'yyyy-MM-dd'),
        supplier: mobile.supplier || '',
        supplierId: mobile.supplierId || '',
        purchasePaymentType: mobile.purchasePaymentType === 'SupplierCredit' ? 'SupplierCredit' : 'Cash',
        registerPageNo: (mobile.registerPageNo ?? '').toString(),
        imei1: mobile.imei1 || '',
        imei2: mobile.imei2 || '',
        notes: mobile.notes || ''
      });
    } else {
      setEditingId(null);
      setFormData({
        modelName: '',
        company: 'Samsung',
        customCompany: '',
        ramRom: '',
        basePrice: '',
        quantity: '1',
        condition: 'New',
        purchaseDate: format(new Date(), 'yyyy-MM-dd'),
        supplier: '',
        supplierId: '',
        purchasePaymentType: 'Cash',
        registerPageNo: '',
        imei1: '',
        imei2: '',
        notes: ''
      });
    }
    setIsModalOpen(true);
  };

  const isSupplierKhataEnabled = Boolean(shopProfile?.enableSupplierKhata);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || isSubmitting) return;

    try {
      const resolvedCompany = formData.company === 'Other'
        ? (formData.customCompany.trim() || 'Other')
        : (formData.company.trim() || 'Samsung');

      if (!formData.modelName.trim()) {
        return error('Please enter model name');
      }

      const effectivePaymentType = isSupplierKhataEnabled ? formData.purchasePaymentType : 'Cash';
      const effectiveSupplierId = isSupplierKhataEnabled ? formData.supplierId : '';

      if (!editingId && effectivePaymentType === 'SupplierCredit' && !effectiveSupplierId) {
        return error('Please select or add a Supplier for Credit (Supplier Khata) purchase');
      }

      isSubmittingRef.current = true;
      setIsSubmitting(true);

      const selectedSup = effectiveSupplierId ? suppliersList.find(s => s.id === effectiveSupplierId) : null;
      const resolvedSupplierName = selectedSup ? selectedSup.name : formData.supplier.trim();
      const unitCost = Number(formData.basePrice) || 0;
      const qty = Number(formData.quantity) || 1;
      const totalPurchaseAmount = unitCost * qty;

      const data = {
        shopId: currentShopId,
        userId: user?.uid,
        userEmail: (user?.email || '').toLowerCase(),
        modelName: formData.modelName.trim(),
        company: resolvedCompany,
        ramRom: formData.ramRom.trim(),
        basePrice: unitCost,
        initialQuantity: qty,
        quantity: qty,
        condition: formData.condition,
        purchaseDate: parseDateSafe(formData.purchaseDate) || new Date(),
        purchaseDateStr: formData.purchaseDate || format(new Date(), 'yyyy-MM-dd'),
        supplier: resolvedSupplierName,
        supplierId: effectiveSupplierId || null,
        purchasePaymentType:
          effectiveSupplierId && effectivePaymentType === 'Cash'
            ? 'CashExplicit'
            : effectivePaymentType,
        supplierTxCreated: Boolean(selectedSup && totalPurchaseAmount > 0 && effectivePaymentType === 'SupplierCredit'),
        registerPageNo: formData.registerPageNo ? formData.registerPageNo.trim() : '',
        imei1: formData.imei1 ? formData.imei1.trim() : '',
        imei2: formData.imei2 ? formData.imei2.trim() : '',
        notes: formData.notes.trim(),
      };

      if (editingId) {
        await updateDoc(doc(db, 'mobiles', editingId), data);
        success('Mobile updated successfully');
      } else {
        const mobileDocRef = await addDoc(collection(db, 'mobiles'), {
          ...data,
          createdAt: serverTimestamp()
        });

        // If Supplier Khata is enabled and a registered supplier is selected on credit, record in Supplier Khata
        if (isSupplierKhataEnabled && selectedSup && totalPurchaseAmount > 0 && effectivePaymentType === 'SupplierCredit') {
          const rawBal = Number(selectedSup.totalBalance) || 0;
          const baseBal = rawBal > 0 ? rawBal : 0;
          const newBal = baseBal + totalPurchaseAmount;
          const pDateStr = formData.purchaseDate || format(new Date(), 'yyyy-MM-dd');

          await addDoc(collection(db, 'supplierTransactions'), {
            shopId: currentShopId,
            userId: user?.uid,
            userEmail: (user?.email || '').toLowerCase(),
            supplierId: selectedSup.id,
            supplierName: selectedSup.name,
            transactionType: 'purchase',
            amount: totalPurchaseAmount,
            paymentMethod: 'Credit Purchase',
            referenceId: formData.registerPageNo ? `Pg#${formData.registerPageNo}` : '',
            description: `${qty}x ${resolvedCompany} ${formData.modelName.trim()}${formData.imei1 ? ` (IMEI: ${formData.imei1})` : ''}`,
            runningBalance: newBal,
            linkedMobileId: mobileDocRef.id,
            date: parseDateSafe(pDateStr) || new Date(),
            dateStr: pDateStr,
            createdAt: serverTimestamp()
          });

          await updateDoc(doc(db, 'suppliers', selectedSup.id), {
            totalBalance: newBal,
            updatedAt: serverTimestamp()
          });

          success(`Mobile added & Rs. ${totalPurchaseAmount.toLocaleString()} added to ${selectedSup.name}'s Supplier Khata`);
        } else {
          success('Mobile added successfully');
        }
      }
      setIsModalOpen(false);
    } catch (err: any) {
      error(err.message || 'Error saving mobile');
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  const handleDelete = async (id: string, name?: string) => {
    const isConfirmed = await confirm({
      title: 'Delete Mobile Stock',
      message: name
        ? `Are you sure you want to permanently delete "${name}" from your inventory? This cannot be undone.`
        : 'Are you sure you want to permanently delete this mobile from your inventory? This cannot be undone.',
      confirmText: 'Delete Mobile',
      cancelText: 'Keep Mobile',
      type: 'danger',
    });

    if (isConfirmed) {
      try {
        await deleteDoc(doc(db, 'mobiles', id));
        success('Mobile deleted successfully');
      } catch (err: any) {
        error(err.message || 'Error deleting mobile');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Purchase Mobile</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your purchased stock</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="shrink-0">
          + Add Mobile
        </Button>
      </div>

      <div className="bg-white rounded-2xl shadow-card p-4">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <SearchBar value={search} onChange={setSearch} placeholder="Search models, company, brand..." />
          <Select 
            className="sm:max-w-[200px]"
            value={filterCompany} 
            onChange={(e) => setFilterCompany(e.target.value)}
            options={FILTER_COMPANIES}
          />
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold rounded-tl-xl">Company / Brand</th>
                <th className="px-4 py-3 font-semibold">Model</th>
                <th className="px-4 py-3 font-semibold">Reg. Page #</th>
                <th className="px-4 py-3 font-semibold">RAM/ROM</th>
                <th className="px-4 py-3 font-semibold">Base Price</th>
                <th className="px-4 py-3 font-semibold">Qty</th>
                <th className="px-4 py-3 font-semibold">Condition</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold rounded-tr-xl text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-32"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-8"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
                    <td className="px-4 py-4"></td>
                  </tr>
                ))
              ) : filteredMobiles.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                    <Smartphone className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <p>No mobiles found. Add your first mobile above.</p>
                  </td>
                </tr>
              ) : (
                filteredMobiles.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-700 border border-amber-500/30">
                        {m.company || m.brand || 'Samsung'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{m.modelName}</td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-700">
                      {m.registerPageNo ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200/80 text-xs font-black">
                          Pg #{m.registerPageNo}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{m.ramRom || '-'}</td>
                    <td className="px-4 py-3 font-medium">Rs. {m.basePrice?.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <Badge variant={m.quantity > 3 ? 'success' : m.quantity > 0 ? 'warning' : 'danger'}>
                        {m.quantity}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={m.condition === 'New' ? 'info' : 'default'}>{m.condition}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {formatDateSafe(m.purchaseDate, 'dd MMM yyyy')}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button onClick={() => handleOpenModal(m)} className="p-1.5 text-primary-500 hover:bg-primary-50 rounded-lg transition-colors">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(m.id, `${m.company} ${m.modelName}`)} className="p-1.5 text-accent-rose hover:bg-accent-rose/10 rounded-lg transition-colors cursor-pointer" title="Delete Mobile">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View (Optimized for Phones) */}
        <div className="md:hidden divide-y divide-slate-100">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="py-4 space-y-2 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                <div className="h-4 bg-slate-100 rounded w-2/3"></div>
              </div>
            ))
          ) : filteredMobiles.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <Smartphone className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p>No mobiles found. Add your first mobile above.</p>
            </div>
          ) : (
            filteredMobiles.map((m) => (
              <div key={m.id} className="py-3.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm leading-snug">{m.modelName}</h3>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-800 border border-amber-500/30">
                        {m.company || m.brand || 'Samsung'}
                      </span>
                      {m.registerPageNo && (
                        <span className="text-[11px] font-mono font-black px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                          Pg #{m.registerPageNo}
                        </span>
                      )}
                      {m.ramRom && (
                        <span className="text-[11px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                          {m.ramRom}
                        </span>
                      )}
                      <Badge variant={m.condition === 'New' ? 'info' : 'default'} className="text-[10px] py-0">
                        {m.condition}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant={m.quantity > 3 ? 'success' : m.quantity > 0 ? 'warning' : 'danger'}>
                      Qty: {m.quantity}
                    </Badge>
                    <p className="font-extrabold text-slate-900 text-sm mt-1">
                      Rs. {m.basePrice?.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-50 text-xs">
                  <span className="text-slate-400">
                    {formatDateSafe(m.purchaseDate, 'dd MMM yyyy')}
                  </span>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleOpenModal(m)} 
                      className="px-2.5 py-1 text-xs font-semibold text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button 
                      onClick={() => handleDelete(m.id, `${m.company} ${m.modelName}`)} 
                      className="px-2.5 py-1 text-xs font-semibold text-accent-rose bg-accent-rose/10 hover:bg-accent-rose/20 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingId ? 'Edit Mobile' : 'Add Mobile'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Company <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={formData.company}
                onChange={e => setFormData({...formData, company: e.target.value})}
                className="w-full h-[42px] rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none focus:border-[#522D60] focus:ring-2 focus:ring-[#522D60]/15 transition-all"
              >
                {COMPANIES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Model Name <span className="text-rose-500">*</span>
              </label>
              <input
                required
                type="text"
                placeholder="e.g. iPhone 13 Pro / Galaxy A54"
                className="w-full h-[42px] rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none focus:border-[#522D60] focus:ring-2 focus:ring-[#522D60]/15 transition-all"
                value={formData.modelName}
                onChange={e => setFormData({...formData, modelName: e.target.value})}
              />
            </div>

            {formData.company === 'Other' && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Custom Brand Name <span className="text-rose-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Motorola, Sony, Honor"
                  className="w-full h-[42px] rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none focus:border-[#522D60] focus:ring-2 focus:ring-[#522D60]/15 transition-all"
                  value={formData.customCompany}
                  onChange={e => setFormData({...formData, customCompany: e.target.value})}
                />
              </div>
            )}
            
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                RAM / ROM
              </label>
              <input
                type="text"
                placeholder="e.g. 8GB / 128GB"
                className="w-full h-[42px] rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none focus:border-[#522D60] focus:ring-2 focus:ring-[#522D60]/15 transition-all"
                value={formData.ramRom}
                onChange={e => setFormData({...formData, ramRom: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Base Price (Rs.) <span className="text-rose-500">*</span>
              </label>
              <input
                required
                type="number"
                min="0"
                placeholder="0"
                className="w-full h-[42px] rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-mono font-bold text-slate-900 outline-none focus:border-[#522D60] focus:ring-2 focus:ring-[#522D60]/15 transition-all"
                value={formData.basePrice}
                onChange={e => setFormData({...formData, basePrice: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Quantity <span className="text-rose-500">*</span>
              </label>
              <input
                required
                type="number"
                min="1"
                className="w-full h-[42px] rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-mono font-bold text-slate-900 outline-none focus:border-[#522D60] focus:ring-2 focus:ring-[#522D60]/15 transition-all"
                value={formData.quantity}
                onChange={e => setFormData({...formData, quantity: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Condition <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={formData.condition}
                onChange={e => setFormData({...formData, condition: e.target.value})}
                className="w-full h-[42px] rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none focus:border-[#522D60] focus:ring-2 focus:ring-[#522D60]/15 transition-all"
              >
                <option value="New">New</option>
                <option value="Used">Used</option>
                <option value="Refurbished">Refurbished</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Purchase Date <span className="text-rose-500">*</span>
              </label>
              <input
                required
                type="date"
                className="w-full h-[42px] rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none focus:border-[#522D60] focus:ring-2 focus:ring-[#522D60]/15 transition-all"
                value={formData.purchaseDate}
                onChange={e => setFormData({...formData, purchaseDate: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Register Page No. <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 45"
                className="w-full h-[42px] font-mono font-bold text-sm rounded-xl border border-slate-200 bg-white px-3.5 text-slate-900 outline-none focus:border-[#522D60] focus:ring-2 focus:ring-[#522D60]/15 transition-all"
                value={formData.registerPageNo}
                onChange={e => setFormData({...formData, registerPageNo: e.target.value.replace(/\D/g, '')})}
              />
            </div>
          </div>

          {/* When Supplier Khata is ENABLED in Settings: Show aligned, compact Supplier & Payment Section */}
          {isSupplierKhataEnabled && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-800">
                  Supplier & Khata Payment
                </span>

                <button
                  type="button"
                  onClick={() => setShowInlineAddSupplier((prev) => !prev)}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold bg-[#FAF5FC] hover:bg-[#F3E8FA] text-[#522D60] border border-[#522D60]/20 transition-colors cursor-pointer shrink-0"
                >
                  {showInlineAddSupplier ? 'Cancel' : '+ Add New Supplier'}
                </button>
              </div>

              {/* Inline Quick-Add Supplier Box */}
              {showInlineAddSupplier && (
                <div className="p-3 rounded-xl bg-white border border-[#522D60]/25 shadow-2xs space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Supplier Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Ali Mobile Wholesale"
                        value={newSupplierName}
                        onChange={(e) => setNewSupplierName(e.target.value)}
                        className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 outline-none focus:border-[#522D60]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Phone Number (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 0300-1234567"
                        value={newSupplierPhone}
                        onChange={(e) => setNewSupplierPhone(e.target.value)}
                        className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 outline-none focus:border-[#522D60]"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowInlineAddSupplier(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      disabled={isCreatingSupplier}
                      onClick={handleCreateSupplierInline}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#522D60] hover:bg-[#42244D] text-white shadow-2xs disabled:opacity-50 cursor-pointer"
                    >
                      {isCreatingSupplier ? 'Saving...' : 'Save & Select'}
                    </button>
                  </div>
                </div>
              )}

              {/* Clean 2-Column Row: Col 1 = Select Supplier, Col 2 = Payment Mode */}
              <div className={`grid grid-cols-1 ${!editingId ? 'sm:grid-cols-2' : ''} gap-3`}>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Select Supplier
                  </label>
                  <select
                    value={formData.supplierId}
                    onChange={(e) => {
                      const supId = e.target.value;
                      const found = suppliersList.find((s) => s.id === supId);
                      setFormData({
                        ...formData,
                        supplierId: supId,
                        supplier: found ? found.name : '',
                        purchasePaymentType: supId ? 'SupplierCredit' : 'Cash',
                      });
                    }}
                    className="w-full h-[42px] rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none focus:border-[#522D60]"
                  >
                    <option value="">Walk-in / Cash Seller</option>
                    {suppliersList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}{s.phone ? ` (${s.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {!editingId && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Payment Mode
                    </label>
                    <div className="grid grid-cols-2 gap-2 h-[42px]">
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, purchasePaymentType: 'SupplierCredit' })
                        }
                        className={`rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          formData.purchasePaymentType === 'SupplierCredit'
                            ? 'bg-[#522D60] text-white border-[#522D60] shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Supplier Khata
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, purchasePaymentType: 'Cash' })
                        }
                        className={`rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          formData.purchasePaymentType === 'Cash'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Paid Cash
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {!editingId && formData.purchasePaymentType === 'SupplierCredit' && (
                <p className="text-xs text-[#522D60] font-semibold">
                  {formData.supplierId
                    ? `Rs. ${(
                        (Number(formData.basePrice) || 0) *
                        (Number(formData.quantity) || 1)
                      ).toLocaleString()} will be added to ${formData.supplier}'s Supplier Khata.`
                    : 'Please select a Supplier from the dropdown or click "+ Add New Supplier".'}
                </p>
              )}
            </div>
          )}

          {/* Optional IMEI 1 and IMEI 2 with Barcode / QR Scanner */}
          <div className="p-3.5 sm:p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-[#522D60]" />
                IMEI Numbers (Optional)
              </span>
              <span className="text-[11px] text-slate-400">
                Scan or type IMEI
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">IMEI 1</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={18}
                    placeholder="Enter or scan IMEI 1"
                    className="w-full h-[42px] font-mono text-sm rounded-xl border border-slate-200 bg-white px-3.5 text-slate-900 outline-none focus:border-[#522D60] focus:ring-2 focus:ring-[#522D60]/15"
                    value={formData.imei1}
                    onChange={e => setFormData({...formData, imei1: e.target.value})}
                  />
                  <button
                    type="button"
                    title="Scan IMEI 1 Barcode / QR"
                    onClick={() => { setActiveScanField('imei1'); setScannerOpen(true); }}
                    className="h-[42px] px-3 border border-slate-200 rounded-xl hover:bg-slate-100 text-[#522D60] bg-white transition-all active:scale-95 shrink-0 flex items-center justify-center cursor-pointer"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">IMEI 2</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={18}
                    placeholder="Enter or scan IMEI 2"
                    className="w-full h-[42px] font-mono text-sm rounded-xl border border-slate-200 bg-white px-3.5 text-slate-900 outline-none focus:border-[#522D60] focus:ring-2 focus:ring-[#522D60]/15"
                    value={formData.imei2}
                    onChange={e => setFormData({...formData, imei2: e.target.value})}
                  />
                  <button
                    type="button"
                    title="Scan IMEI 2 Barcode / QR"
                    onClick={() => { setActiveScanField('imei2'); setScannerOpen(true); }}
                    className="h-[42px] px-3 border border-slate-200 rounded-xl hover:bg-slate-100 text-[#522D60] bg-white transition-all active:scale-95 shrink-0 flex items-center justify-center cursor-pointer"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Notes (Optional)</label>
            <textarea
              rows={2}
              placeholder="Any additional notes..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-[#522D60] focus:ring-2 focus:ring-[#522D60]/15"
              value={formData.notes}
              onChange={e => setFormData({...formData, notes: e.target.value})}
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <Button type="button" variant="ghost" disabled={isSubmitting} onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
              {editingId ? 'Save Changes' : 'Add Mobile'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* BARCODE / QR SCANNER MODAL */}
      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
        onScanBoth={(imei1, imei2) => {
          setFormData(prev => ({ ...prev, imei1, imei2 }));
          success(`Both IMEIs scanned: ${imei1} & ${imei2}`);
        }}
        targetField={activeScanField || undefined}
        title={activeScanField === 'imei2' ? 'Scan IMEI 2' : 'Scan IMEI 1'}
      />
    </div>
  );
}

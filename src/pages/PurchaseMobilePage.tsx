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
    registerPageNo: '',
    imei1: '',
    imei2: '',
    notes: ''
  });

  const { success, error } = useToast();
  const { confirm } = useConfirm();

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
    return unsub;
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
        registerPageNo: '',
        imei1: '',
        imei2: '',
        notes: ''
      });
    }
    setIsModalOpen(true);
  };

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

      isSubmittingRef.current = true;
      setIsSubmitting(true);

      const data = {
        shopId: currentShopId,
        userId: user?.uid,
        userEmail: (user?.email || '').toLowerCase(),
        modelName: formData.modelName.trim(),
        company: resolvedCompany,
        ramRom: formData.ramRom.trim(),
        basePrice: Number(formData.basePrice) || 0,
        quantity: Number(formData.quantity) || 1,
        condition: formData.condition,
        purchaseDate: new Date(formData.purchaseDate),
        supplier: formData.supplier.trim(),
        registerPageNo: formData.registerPageNo ? formData.registerPageNo.trim() : '',
        imei1: formData.imei1 ? formData.imei1.trim() : '',
        imei2: formData.imei2 ? formData.imei2.trim() : '',
        notes: formData.notes.trim(),
      };

      if (editingId) {
        await updateDoc(doc(db, 'mobiles', editingId), data);
        success('Mobile updated successfully');
      } else {
        await addDoc(collection(db, 'mobiles'), {
          ...data,
          createdAt: serverTimestamp()
        });
        success('Mobile added successfully');
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
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Company *"
              required
              value={formData.company}
              onChange={e => setFormData({...formData, company: e.target.value})}
              options={COMPANIES}
            />
            {formData.company === 'Other' && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500">Custom Brand Name *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Motorola"
                  className="w-full rounded-xl border border-primary-500/20 bg-white/5 px-4 py-2.5 text-slate-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  value={formData.customCompany}
                  onChange={e => setFormData({...formData, customCompany: e.target.value})}
                />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">Model Name *</label>
              <input
                required
                type="text"
                className="w-full rounded-xl border border-primary-500/20 bg-white/5 px-4 py-2.5 text-slate-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                value={formData.modelName}
                onChange={e => setFormData({...formData, modelName: e.target.value})}
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">RAM/ROM</label>
              <input
                type="text"
                placeholder="e.g. 8GB/128GB"
                className="w-full rounded-xl border border-primary-500/20 bg-white/5 px-4 py-2.5 text-slate-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                value={formData.ramRom}
                onChange={e => setFormData({...formData, ramRom: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">Base Price (Rs.) *</label>
              <input
                required
                type="number"
                min="0"
                className="w-full rounded-xl border border-primary-500/20 bg-white/5 px-4 py-2.5 text-slate-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                value={formData.basePrice}
                onChange={e => setFormData({...formData, basePrice: e.target.value})}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">Quantity *</label>
              <input
                required
                type="number"
                min="1"
                className="w-full rounded-xl border border-primary-500/20 bg-white/5 px-4 py-2.5 text-slate-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                value={formData.quantity}
                onChange={e => setFormData({...formData, quantity: e.target.value})}
              />
            </div>
            <Select
              label="Condition *"
              required
              value={formData.condition}
              onChange={e => setFormData({...formData, condition: e.target.value})}
              options={[
                { value: 'New', label: 'New' },
                { value: 'Used', label: 'Used' },
                { value: 'Refurbished', label: 'Refurbished' },
              ]}
            />
            
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">Purchase Date *</label>
              <input
                required
                type="date"
                className="w-full rounded-xl border border-primary-500/20 bg-white/5 px-4 py-2.5 text-slate-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                value={formData.purchaseDate}
                onChange={e => setFormData({...formData, purchaseDate: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">Supplier</label>
              <input
                type="text"
                placeholder="e.g. Local Market / Supplier Name"
                className="w-full rounded-xl border border-primary-500/20 bg-white/5 px-4 py-2.5 text-slate-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                value={formData.supplier}
                onChange={e => setFormData({...formData, supplier: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>Register Page No.</span>
                <span className="text-[11px] font-normal text-slate-400">Numbers only</span>
              </label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 45"
                className="w-full font-mono font-bold text-base rounded-xl border border-amber-500/30 bg-amber-50/30 px-4 py-2.5 text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-2xs"
                value={formData.registerPageNo}
                onChange={e => setFormData({...formData, registerPageNo: e.target.value.replace(/\D/g, '')})}
              />
            </div>
          </div>

          {/* Optional IMEI 1 and IMEI 2 with Barcode / QR Scanner */}
          <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-amber-600" />
                IMEI Numbers (Optional)
              </span>
              <span className="text-[11px] text-slate-400">
                Optional · Scan QR / Barcode
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">IMEI 1</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={18}
                    placeholder="Enter or scan IMEI 1"
                    className="w-full font-mono text-base tracking-wider rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-2xs"
                    value={formData.imei1}
                    onChange={e => setFormData({...formData, imei1: e.target.value})}
                  />
                  <button
                    type="button"
                    title="Scan IMEI 1 Barcode / QR"
                    onClick={() => { setActiveScanField('imei1'); setScannerOpen(true); }}
                    className="px-3 py-2.5 border border-slate-300 rounded-xl hover:bg-amber-50 hover:border-amber-400 text-amber-700 bg-white transition-all active:scale-95 shrink-0 shadow-2xs flex items-center justify-center"
                  >
                    <QrCode className="w-5 h-5 stroke-[2.2]" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">IMEI 2</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={18}
                    placeholder="Enter or scan IMEI 2"
                    className="w-full font-mono text-base tracking-wider rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-2xs"
                    value={formData.imei2}
                    onChange={e => setFormData({...formData, imei2: e.target.value})}
                  />
                  <button
                    type="button"
                    title="Scan IMEI 2 Barcode / QR"
                    onClick={() => { setActiveScanField('imei2'); setScannerOpen(true); }}
                    className="px-3 py-2.5 border border-slate-300 rounded-xl hover:bg-amber-50 hover:border-amber-400 text-amber-700 bg-white transition-all active:scale-95 shrink-0 shadow-2xs flex items-center justify-center"
                  >
                    <QrCode className="w-5 h-5 stroke-[2.2]" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Notes</label>
            <textarea
              rows={2}
              className="w-full rounded-xl border border-primary-500/20 bg-white/5 px-4 py-2.5 text-slate-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              value={formData.notes}
              onChange={e => setFormData({...formData, notes: e.target.value})}
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
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
      />
    </div>
  );
}

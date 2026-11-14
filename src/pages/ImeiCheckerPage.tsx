import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  doc,
  updateDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { isDocForShop } from '../utils/multiTenantService';
import { parseDateSafe, formatDateSafe } from '../utils/dateUtils';
import { differenceInCalendarDays, addDays, format } from 'date-fns';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { BillPreviewModal } from '../components/ui/BillPreviewModal';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { getBillHtml } from '../utils/printBill';
import { getWhatsAppImeiWarrantyUrl, getWhatsAppSaleBillUrl } from '../config/shopConfig';
import { useToast } from '../contexts/ToastContext';
import {
  QrCode,
  Search,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  Smartphone,
  User,
  Truck,
  FileText,
  MessageCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  X,
  RotateCcw,
  Copy,
  Check,
  Edit2,
} from 'lucide-react';

interface ImeiDossier {
  key: string;
  imei1: string;
  imei2: string;
  modelName: string;
  company: string;
  ramRom: string;
  condition: string;
  registerPageNo: string;
  supplier: string;
  purchaseDate: Date | null;
  basePrice: number;
  inStockQty: number;
  stockDoc: any | null;
  saleDoc: any | null;
  billDoc: any | null;
}

type StatusFilter = 'ALL' | 'ACTIVE_WARRANTY' | 'EXPIRED_WARRANTY' | 'NO_WARRANTY' | 'IN_STOCK';

const WARRANTY_PRESETS = [
  { days: 0, label: 'No Warranty' },
  { days: 3, label: '3 Days Check' },
  { days: 7, label: '7 Days Check' },
  { days: 15, label: '15 Days' },
  { days: 365, label: '1 Year Brand' },
];

export default function ImeiCheckerPage() {
  const { user, shopProfile, currentShopId } = useAuth();
  const { success, error } = useToast();

  const [mobiles, setMobiles] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Controls
  const [queryText, setQueryText] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [showCostAndProfit, setShowCostAndProfit] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [copiedImei, setCopiedImei] = useState<string | null>(null);

  // Quick Edit Warranty Modal
  const [editingDossier, setEditingDossier] = useState<ImeiDossier | null>(null);
  const [selectedWarrantyDays, setSelectedWarrantyDays] = useState<number>(0);
  const [isSavingWarranty, setIsSavingWarranty] = useState(false);

  // Bill Preview Modal
  const [previewBill, setPreviewBill] = useState<any | null>(null);

  useEffect(() => {
    if (!user || !currentShopId) {
      setLoading(false);
      return;
    }

    const unsubMobiles = onSnapshot(
      collection(db, 'mobiles'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((m) => isDocForShop(m, currentShopId));
        setMobiles(list);
        setLoading(false);
      },
      () => setLoading(false)
    );

    const unsubSales = onSnapshot(
      collection(db, 'sales'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((s) => isDocForShop(s, currentShopId));
        setSales(list);
      },
      () => {}
    );

    const unsubBills = onSnapshot(
      collection(db, 'bills'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((b) => isDocForShop(b, currentShopId));
        setBills(list);
      },
      () => {}
    );

    return () => {
      unsubMobiles();
      unsubSales();
      unsubBills();
    };
  }, [user, currentShopId]);

  const getDeviceWarranty = (d: ImeiDossier) => {
    if (!d.saleDoc) {
      return { days: 0, label: 'Not Sold' };
    }
    const s = d.saleDoc;
    const b = d.billDoc;

    let days = 0;
    if (s.warrantyDays !== undefined && s.warrantyDays !== null) {
      days = Number(s.warrantyDays) || 0;
    } else if (b?.warrantyDays !== undefined && b?.warrantyDays !== null) {
      days = Number(b.warrantyDays) || 0;
    }

    let label = s.warrantyLabel || b?.warrantyLabel || '';
    if (!label) {
      label = days === 365 ? '1 Year Brand Warranty' : days > 0 ? `${days} Days Warranty` : 'No Warranty';
    }

    return { days, label };
  };

  const allDossiers = useMemo(() => {
    const map = new Map<string, ImeiDossier>();

    const normalizeImeiKey = (imei1?: string, imei2?: string, fallbackId?: string) => {
      const c1 = (imei1 || '').trim();
      const c2 = (imei2 || '').trim();
      if (c1) return `imei:${c1}`;
      if (c2) return `imei:${c2}`;
      return `id:${fallbackId || Math.random()}`;
    };

    mobiles.forEach((m) => {
      const imei1 = String(m.imei1 || '').trim();
      const imei2 = String(m.imei2 || '').trim();
      if (!imei1 && !imei2 && !m.modelName) return;

      const key = normalizeImeiKey(imei1, imei2, m.id);
      map.set(key, {
        key,
        imei1,
        imei2,
        modelName: m.modelName || 'Mobile Device',
        company: m.company || m.brand || 'Mobile',
        ramRom: m.ramRom || '',
        condition: m.condition || 'New',
        registerPageNo: m.registerPageNo ? String(m.registerPageNo) : '',
        supplier: m.supplier || m.supplierName || '',
        purchaseDate: parseDateSafe(m.purchaseDate || m.createdAt),
        basePrice: Number(m.basePrice) || 0,
        inStockQty: Number(m.quantity) || 0,
        stockDoc: m,
        saleDoc: null,
        billDoc: null,
      });
    });

    const sortedSales = [...sales].sort((a, b) => {
      const da = parseDateSafe(a.date || a.createdAt)?.getTime() || 0;
      const dbTime = parseDateSafe(b.date || b.createdAt)?.getTime() || 0;
      return dbTime - da;
    });

    sortedSales.forEach((s) => {
      const imei1 = String(s.imei1 || '').trim();
      const imei2 = String(s.imei2 || '').trim();

      let matchedEntry: ImeiDossier | undefined;
      if (imei1) {
        matchedEntry = Array.from(map.values()).find(
          (d) => (d.imei1 && d.imei1 === imei1) || (d.imei2 && d.imei2 === imei1)
        );
      }
      if (!matchedEntry && imei2) {
        matchedEntry = Array.from(map.values()).find(
          (d) => (d.imei1 && d.imei1 === imei2) || (d.imei2 && d.imei2 === imei2)
        );
      }
      if (!matchedEntry && s.itemId && !imei1) {
        matchedEntry = Array.from(map.values()).find(
          (d) => d.stockDoc?.id === s.itemId && !d.saleDoc
        );
      }

      const linkedBill = s.billId ? bills.find((b) => b.id === s.billId) : null;

      if (matchedEntry) {
        if (!matchedEntry.saleDoc) {
          matchedEntry.saleDoc = s;
        }
        if (!matchedEntry.billDoc && linkedBill) {
          matchedEntry.billDoc = linkedBill;
        }
        if (!matchedEntry.imei1 && imei1) matchedEntry.imei1 = imei1;
        if (!matchedEntry.imei2 && imei2) matchedEntry.imei2 = imei2;
        if (!matchedEntry.supplier && (s.supplier || s.supplierName)) {
          matchedEntry.supplier = s.supplier || s.supplierName;
        }
      } else {
        const key = normalizeImeiKey(imei1, imei2, `sale_${s.id}`);
        map.set(key, {
          key,
          imei1,
          imei2,
          modelName: s.itemName || s.modelName || 'Mobile Device',
          company: s.company || s.brand || 'Mobile',
          ramRom: s.ramRom || '',
          condition: s.condition || 'New',
          registerPageNo: s.registerPageNo ? String(s.registerPageNo) : '',
          supplier: s.supplier || s.supplierName || '',
          purchaseDate: null,
          basePrice: Number(s.basePrice) || 0,
          inStockQty: 0,
          stockDoc: null,
          saleDoc: s,
          billDoc: linkedBill || null,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const aTime =
        parseDateSafe(a.saleDoc?.date || a.saleDoc?.createdAt || a.purchaseDate)?.getTime() || 0;
      const bTime =
        parseDateSafe(b.saleDoc?.date || b.saleDoc?.createdAt || b.purchaseDate)?.getTime() || 0;
      return bTime - aTime;
    });
  }, [mobiles, sales, bills]);

  const filteredDossiers = useMemo(() => {
    const term = queryText.toLowerCase().trim();

    return allDossiers
      .filter((d) => {
        const isSold = Boolean(d.saleDoc) && d.saleDoc?.status !== 'returned';
        const { days: wDays } = getDeviceWarranty(d);
        const sDate = d.saleDoc
          ? parseDateSafe(d.saleDoc.date || d.saleDoc.createdAt || d.saleDoc.saleDate)
          : null;
        const elapsed = sDate ? Math.max(0, differenceInCalendarDays(new Date(), sDate)) : 0;
        const isWarrantyActive = isSold && wDays > 0 && elapsed <= wDays;
        const isWarrantyExpired = isSold && wDays > 0 && elapsed > wDays;
        const isNoWarranty = isSold && wDays === 0;

        if (statusFilter === 'ACTIVE_WARRANTY' && !isWarrantyActive) return false;
        if (statusFilter === 'EXPIRED_WARRANTY' && !isWarrantyExpired) return false;
        if (statusFilter === 'NO_WARRANTY' && !isNoWarranty) return false;
        if (statusFilter === 'IN_STOCK' && (isSold || d.inStockQty <= 0)) return false;

        if (!term) {
          return Boolean(d.imei1 || d.imei2 || d.saleDoc);
        }

        const custName = (d.saleDoc?.customerName || '').toLowerCase();
        const custPhone = (d.saleDoc?.customerPhone || d.saleDoc?.phone || '').toLowerCase();
        const billNo = (
          d.billDoc?.billNumber ||
          d.saleDoc?.billNumber ||
          d.saleDoc?.id ||
          ''
        ).toLowerCase();
        const supplier = (d.supplier || '').toLowerCase();
        const model = `${d.company} ${d.modelName}`.toLowerCase();

        return (
          (d.imei1 && d.imei1.toLowerCase().includes(term)) ||
          (d.imei2 && d.imei2.toLowerCase().includes(term)) ||
          custName.includes(term) ||
          custPhone.includes(term) ||
          billNo.includes(term) ||
          supplier.includes(term) ||
          model.includes(term)
        );
      })
      .slice(0, term ? 50 : 20);
  }, [allDossiers, queryText, statusFilter]);

  const handleCopyImei = (imei: string) => {
    if (!imei) return;
    navigator.clipboard.writeText(imei);
    setCopiedImei(imei);
    success(`IMEI copied: ${imei}`);
    setTimeout(() => setCopiedImei(null), 2000);
  };

  const handleOpenEditWarranty = (d: ImeiDossier) => {
    const { days } = getDeviceWarranty(d);
    setEditingDossier(d);
    setSelectedWarrantyDays(days);
  };

  const handleSaveWarranty = async () => {
    if (!editingDossier?.saleDoc) return;
    setIsSavingWarranty(true);
    try {
      const label =
        selectedWarrantyDays === 0
          ? 'No Warranty'
          : selectedWarrantyDays === 365
          ? '1 Year Brand Warranty'
          : `${selectedWarrantyDays} Days Check Warranty`;

      await updateDoc(doc(db, 'sales', editingDossier.saleDoc.id), {
        warrantyDays: selectedWarrantyDays,
        warrantyLabel: label,
      });

      if (editingDossier.billDoc?.id) {
        await updateDoc(doc(db, 'bills', editingDossier.billDoc.id), {
          warrantyDays: selectedWarrantyDays,
          warrantyLabel: label,
        });
      }

      success(`Warranty updated to ${label}`);
      setEditingDossier(null);
    } catch (err: any) {
      error(err.message || 'Failed to update warranty');
    } finally {
      setIsSavingWarranty(false);
    }
  };

  const handleViewSaleBill = (d: ImeiDossier) => {
    if (!d.saleDoc) return;
    const s = d.saleDoc;
    const { days: wDays, label: wLabel } = getDeviceWarranty(d);
    setPreviewBill({
      id: s.billId || s.id,
      billNumber:
        d.billDoc?.billNumber ||
        s.billNumber ||
        String(s.id).substring(0, 8).toUpperCase(),
      customerName: s.customerName || 'Walk-in Customer',
      customerPhone: s.customerPhone || s.phone || '',
      itemName: s.itemName || `${d.company} ${d.modelName}`,
      company: d.company,
      imei1: d.imei1 || s.imei1 || '',
      imei2: d.imei2 || s.imei2 || '',
      sellPrice: s.sellPrice,
      paymentMethod: s.paymentMethod || 'Cash',
      warrantyDays: wDays,
      warrantyLabel: wLabel,
      date: s.date || s.createdAt,
      items: [
        {
          modelName: s.itemName || `${d.company} ${d.modelName}`,
          company: d.company,
          ramRom: d.ramRom,
          imei1: d.imei1 || s.imei1 || '',
          imei2: d.imei2 || s.imei2 || '',
          sellPrice: s.sellPrice,
          warrantyDays: wDays,
          warrantyLabel: wLabel,
        },
      ],
    });
  };

  const previewBillHtml = previewBill ? getBillHtml(previewBill, shopProfile) : '';

  const totalTrackedImeis = allDossiers.filter((d) => d.imei1 || d.imei2).length;
  const activeWarrantyCount = allDossiers.filter((d) => {
    if (!d.saleDoc || d.saleDoc.status === 'returned') return false;
    const { days: wDays } = getDeviceWarranty(d);
    if (wDays <= 0) return false;
    const sDate = parseDateSafe(d.saleDoc.date || d.saleDoc.createdAt || d.saleDoc.saleDate);
    if (!sDate) return false;
    const elapsed = Math.max(0, differenceInCalendarDays(new Date(), sDate));
    return elapsed <= wDays;
  }).length;
  const soldDevicesCount = allDossiers.filter(
    (d) => d.saleDoc && d.saleDoc.status !== 'returned'
  ).length;

  return (
    <div className="space-y-5 pb-16">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            IMEI & Warranty Check
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Scan or search any IMEI to verify purchase source, sale bill, and warranty
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCostAndProfit((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              showCostAndProfit
                ? 'bg-amber-50 text-amber-900 border-amber-300'
                : 'bg-slate-900 text-white border-slate-900'
            }`}
          >
            {showCostAndProfit ? (
              <>
                <Eye className="w-3.5 h-3.5 text-amber-600" />
                <span>Cost Visible</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5 text-emerald-400" />
                <span>Cost Hidden</span>
              </>
            )}
          </button>

          <Button
            onClick={() => setScannerOpen(true)}
            className="flex items-center gap-2 bg-[#522D60] hover:bg-[#42244D] text-white font-bold px-3.5 py-2 rounded-xl shadow-xs cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
            <span>Scan IMEI</span>
          </Button>
        </div>
      </div>

      {/* COMPACT RESPONSIVE KPI CARDS */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl p-3.5 sm:p-5 border border-slate-100 shadow-card flex items-center justify-between">
          <div>
            <p className="text-[11px] sm:text-xs font-semibold text-slate-400">
              Total IMEIs
            </p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 tabular-nums mt-0.5">
              {totalTrackedImeis}
            </p>
          </div>
          <div className="hidden sm:flex w-10 h-10 rounded-xl bg-[#FAF5FC] text-[#522D60] items-center justify-center">
            <Smartphone className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-emerald-600 rounded-2xl p-3.5 sm:p-5 text-white shadow-card flex items-center justify-between">
          <div>
            <p className="text-[11px] sm:text-xs font-semibold text-emerald-100">
              Active Warranty
            </p>
            <p className="text-xl sm:text-2xl font-black text-white tabular-nums mt-0.5">
              {activeWarrantyCount}
            </p>
          </div>
          <div className="hidden sm:flex w-10 h-10 rounded-xl bg-white/20 text-white items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-3.5 sm:p-5 border border-slate-100 shadow-card flex items-center justify-between">
          <div>
            <p className="text-[11px] sm:text-xs font-semibold text-slate-400">
              Sold Devices
            </p>
            <p className="text-xl sm:text-2xl font-black text-[#522D60] tabular-nums mt-0.5">
              {soldDevicesCount}
            </p>
          </div>
          <div className="hidden sm:flex w-10 h-10 rounded-xl bg-[#FAF5FC] text-[#522D60] items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* SEARCH & FILTER BAR */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-card space-y-3.5">
        <div className="relative">
          <Search className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Search IMEI, last 4 digits, model, customer, or bill #..."
            className="w-full pl-10 pr-20 py-3 rounded-xl border border-slate-200 focus:border-[#522D60] focus:ring-2 focus:ring-[#522D60]/15 outline-none font-mono text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 transition-all"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {queryText && (
              <button
                type="button"
                onClick={() => setQueryText('')}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="p-2 bg-[#FAF5FC] hover:bg-[#F3E8FA] text-[#522D60] border border-[#522D60]/20 rounded-xl transition-colors cursor-pointer"
              title="Scan Barcode"
            >
              <QrCode className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
          <div className="flex items-center gap-1.5">
            {(
              [
                { id: 'ALL', label: 'All' },
                { id: 'ACTIVE_WARRANTY', label: 'Active Warranty' },
                { id: 'EXPIRED_WARRANTY', label: 'Expired' },
                { id: 'NO_WARRANTY', label: 'No Warranty' },
                { id: 'IN_STOCK', label: 'In Stock' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === tab.id
                    ? 'bg-[#522D60] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <span className="text-xs text-slate-400 whitespace-nowrap hidden sm:inline">
            {filteredDossiers.length} results
          </span>
        </div>
      </div>

      {/* RESULTS LIST */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl p-5 border border-slate-100 animate-pulse space-y-3"
            >
              <div className="h-5 bg-slate-200 rounded w-1/3" />
              <div className="h-20 bg-slate-50 rounded-xl" />
            </div>
          ))}
        </div>
      ) : filteredDossiers.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-slate-100 shadow-card">
          <ShieldAlert className="w-10 h-10 text-slate-300 mx-auto mb-2.5" />
          <h3 className="text-sm font-bold text-slate-800">
            No matching IMEI or device found
          </h3>
          {(queryText || statusFilter !== 'ALL') && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setQueryText('');
                setStatusFilter('ALL');
              }}
              className="mt-3"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Reset Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredDossiers.map((d) => {
            const isSold = Boolean(d.saleDoc);
            const isReturned = d.saleDoc?.status === 'returned';
            const { days: deviceWarrantyDays, label: deviceWarrantyLabel } =
              getDeviceWarranty(d);
            const hasWarrantyPolicy = deviceWarrantyDays > 0;

            const saleDate = d.saleDoc
              ? parseDateSafe(
                  d.saleDoc.date || d.saleDoc.createdAt || d.saleDoc.saleDate
                )
              : null;
            const daysSinceSale = saleDate
              ? Math.max(0, differenceInCalendarDays(new Date(), saleDate))
              : null;
            const warrantyExpiryDate =
              saleDate && hasWarrantyPolicy
                ? addDays(saleDate, deviceWarrantyDays)
                : null;
            const daysRemaining =
              daysSinceSale !== null && hasWarrantyPolicy
                ? deviceWarrantyDays - daysSinceSale
                : null;
            const isWarrantyValid =
              isSold &&
              !isReturned &&
              hasWarrantyPolicy &&
              daysRemaining !== null &&
              daysRemaining >= 0;

            const billNumber =
              d.billDoc?.billNumber ||
              d.saleDoc?.billNumber ||
              (d.saleDoc?.id
                ? String(d.saleDoc.id).substring(0, 8).toUpperCase()
                : '');

            const warrantyBannerText = !isSold
              ? 'In Stock'
              : isReturned
              ? 'Returned — Warranty Void'
              : !hasWarrantyPolicy
              ? 'No Warranty'
              : isWarrantyValid
              ? `${deviceWarrantyLabel} Active (${
                  daysRemaining === 0 ? 'Expires Today' : `${daysRemaining}d left`
                })`
              : `${deviceWarrantyLabel} Expired (${Math.abs(
                  daysRemaining || 0
                )}d ago)`;

            return (
              <div
                key={d.key}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-card overflow-hidden"
              >
                {/* COMPACT STATUS HEADER */}
                <div
                  className={`px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b ${
                    !isSold
                      ? 'bg-slate-50 border-slate-200 text-slate-800'
                      : isReturned
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : !hasWarrantyPolicy
                      ? 'bg-slate-100 border-slate-200 text-slate-700'
                      : isWarrantyValid
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {!isSold ? (
                      <Smartphone className="w-4 h-4 text-slate-600 shrink-0" />
                    ) : !hasWarrantyPolicy ? (
                      <ShieldOff className="w-4 h-4 text-slate-500 shrink-0" />
                    ) : isWarrantyValid ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span className="text-xs font-extrabold">
                      {warrantyBannerText}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-medium">
                    {saleDate && (
                      <span className="tabular-nums">
                        Sold {formatDateSafe(saleDate, 'dd MMM yyyy')}
                        {warrantyExpiryDate &&
                          ` · Ends ${format(warrantyExpiryDate, 'dd MMM')}`}
                      </span>
                    )}
                    {!isSold && (
                      <span className="font-semibold text-slate-600">
                        Stock Qty: {d.inStockQty}
                      </span>
                    )}
                  </div>
                </div>

                {/* BODY */}
                <div className="p-4 space-y-3.5">
                  {/* Model & Copyable IMEI Pills */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#FAF5FC] text-[#522D60] border border-[#522D60]/20">
                        {d.company}
                      </span>
                      <h2 className="text-base font-extrabold text-slate-900">
                        {d.modelName}
                      </h2>
                      {d.ramRom && (
                        <span className="text-xs font-mono text-slate-500">
                          ({d.ramRom})
                        </span>
                      )}
                      <Badge variant={d.condition === 'New' ? 'info' : 'default'}>
                        {d.condition}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {d.imei1 ? (
                        <button
                          type="button"
                          onClick={() => handleCopyImei(d.imei1)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-mono text-xs font-bold tracking-wider tabular-nums cursor-pointer"
                          title="Click to copy IMEI 1"
                        >
                          <span>IMEI 1: {d.imei1}</span>
                          {copiedImei === d.imei1 ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">No IMEI</span>
                      )}
                      {d.imei2 && (
                        <button
                          type="button"
                          onClick={() => handleCopyImei(d.imei2)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-mono text-xs font-semibold tracking-wider tabular-nums cursor-pointer"
                          title="Click to copy IMEI 2"
                        >
                          <span>IMEI 2: {d.imei2}</span>
                          {copiedImei === d.imei2 ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* CLEAN 2-COLUMN DETAILS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Purchase Details */}
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 pb-1.5 border-b border-slate-200/70">
                        <span className="flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-[#522D60]" />
                          Purchase Source
                        </span>
                        <span className="text-[11px] font-medium text-slate-500">
                          {d.purchaseDate
                            ? formatDateSafe(d.purchaseDate, 'dd MMM yyyy')
                            : '—'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-slate-400 block">Supplier</span>
                          <span className="font-bold text-slate-900">
                            {d.supplier || 'Walk-in / Market'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Cost Price</span>
                          <span className="font-bold text-slate-900 tabular-nums">
                            {showCostAndProfit
                              ? `Rs. ${(d.basePrice || 0).toLocaleString()}`
                              : 'Rs. ••••••'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Sale Details */}
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 pb-1.5 border-b border-slate-200/70">
                        <span className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-emerald-600" />
                          Sale Record
                        </span>
                        {billNumber && (
                          <span className="font-mono text-[11px] font-bold text-[#522D60]">
                            Bill #{billNumber}
                          </span>
                        )}
                      </div>

                      {!d.saleDoc ? (
                        <div className="py-2 text-xs text-slate-400">
                          Available in shop inventory.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-slate-400 block">Customer</span>
                            <span className="font-bold text-slate-900">
                              {d.saleDoc.customerName || 'Walk-in Customer'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Sale Price</span>
                            <span className="font-extrabold text-slate-900 tabular-nums">
                              Rs. {(Number(d.saleDoc.sellPrice) || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ACTION BUTTONS FOR SOLD DEVICES */}
                  {d.saleDoc && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleOpenEditWarranty(d)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#FAF5FC] text-[#522D60] hover:bg-[#F3E8FA] border border-[#522D60]/20 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Change Warranty</span>
                      </button>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleViewSaleBill(d)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>View Bill</span>
                        </button>

                        <a
                          href={getWhatsAppImeiWarrantyUrl(
                            d.saleDoc.customerPhone || d.saleDoc.phone || '',
                            d.saleDoc.customerName || 'Customer',
                            `${d.company} ${d.modelName}`,
                            d.imei1 || d.imei2 || 'N/A',
                            formatDateSafe(
                              d.saleDoc.date || d.saleDoc.createdAt,
                              'dd MMM yyyy'
                            ),
                            warrantyBannerText,
                            shopProfile.shopName
                          )}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>WhatsApp Status</span>
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* QUICK EDIT WARRANTY MODAL */}
      <Modal
        isOpen={!!editingDossier}
        onClose={() => setEditingDossier(null)}
        title={`Update Warranty — ${editingDossier?.company || ''} ${editingDossier?.modelName || ''}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Select the warranty period for this device. The customer bill and warranty countdown will update automatically.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {WARRANTY_PRESETS.map((preset) => (
              <button
                key={preset.days}
                type="button"
                onClick={() => setSelectedWarrantyDays(preset.days)}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  selectedWarrantyDays === preset.days
                    ? 'bg-[#522D60] text-white border-[#522D60] shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEditingDossier(null)}
              disabled={isSavingWarranty}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveWarranty}
              isLoading={isSavingWarranty}
              disabled={isSavingWarranty}
              className="bg-[#522D60] hover:bg-[#42244D] text-white font-bold"
            >
              Save Warranty
            </Button>
          </div>
        </div>
      </Modal>

      {/* BILL PREVIEW MODAL */}
      <BillPreviewModal
        isOpen={!!previewBill}
        onClose={() => setPreviewBill(null)}
        htmlContent={previewBillHtml}
        title="Sale Receipt"
        billNumber={previewBill?.billNumber || previewBill?.id}
        billData={previewBill}
        onShareWhatsApp={() => {
          if (!previewBill) return;
          const url = getWhatsAppSaleBillUrl(
            previewBill.customerPhone,
            previewBill.customerName,
            previewBill.itemName,
            previewBill.sellPrice,
            previewBill.paymentMethod,
            previewBill.imei1,
            previewBill.billNumber
          );
          window.open(url, '_blank');
        }}
      />

      {/* BARCODE SCANNER */}
      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(imei) => {
          setQueryText(imei);
          setScannerOpen(false);
          success(`IMEI scanned: ${imei}`);
        }}
        title="Scan IMEI Barcode"
      />
    </div>
  );
}

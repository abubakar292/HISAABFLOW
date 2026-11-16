import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  CreditCard,
  Upload,
  Copy,
  Check,
  LogOut,
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  Building2,
  Smartphone,
  FileCheck2,
  RefreshCw,
  Image as ImageIcon,
  X,
} from 'lucide-react';
import {
  doc,
  collection,
  addDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  DEFAULT_SUBSCRIPTION_SETTINGS,
  SubscriptionSettings,
  SubscriptionRequest,
  evaluateSubscriptionAccess,
} from '../utils/multiTenantService';

function formatPkr(amount: number): string {
  return new Intl.NumberFormat('en-PK', {
    maximumFractionDigits: 0,
  }).format(Math.round(amount || 0));
}

async function compressPaymentScreenshot(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format. Please select a valid PNG or JPG screenshot.'));
      img.onload = () => {
        const maxDim = 900;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(event.target?.result || ''));
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.72);
        resolve(compressedDataUrl);
      };
      img.src = String(event.target?.result || '');
    };
    reader.readAsDataURL(file);
  });
}

export default function SubscriptionPage() {
  const { user, shopProfile, updateProfileData, logout, isMasterAdmin } = useAuth();
  const { success, toast } = useToast();

  const [settings, setSettings] = useState<SubscriptionSettings>(DEFAULT_SUBSCRIPTION_SETTINGS);
  const [step, setStep] = useState<'plan' | 'checkout'>('plan');
  const [startingTrial, setStartingTrial] = useState(false);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Checkout form state
  const [paymentMethod, setPaymentMethod] = useState<'Easypaisa' | 'JazzCash' | 'Bank Transfer'>('Easypaisa');
  const [senderAccountName, setSenderAccountName] = useState('');
  const [senderAccountNumber, setSenderAccountNumber] = useState('');
  const [transactionIdLast6, setTransactionIdLast6] = useState('');
  const [screenshotDataUrl, setScreenshotDataUrl] = useState('');
  const [screenshotFileName, setScreenshotFileName] = useState('');
  const [compressingImage, setCompressingImage] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Latest pending request state
  const [latestRequest, setLatestRequest] = useState<SubscriptionRequest | null>(null);
  const [overrideResubmit, setOverrideResubmit] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'system', 'subscription_settings'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<SubscriptionSettings>;
          setSettings({
            ...DEFAULT_SUBSCRIPTION_SETTINGS,
            ...data,
            monthlyPricePkr: Number(data.monthlyPricePkr) > 0 ? Number(data.monthlyPricePkr) : 1999,
          });
        }
      },
      () => {}
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(
      collection(db, 'subscriptionRequests'),
      (snap) => {
        const myRequests: SubscriptionRequest[] = [];
        snap.forEach((d) => {
          const data = d.data() as SubscriptionRequest;
          if (
            data.ownerUid === user.uid ||
            (user.email && data.ownerEmail?.toLowerCase() === user.email.toLowerCase())
          ) {
            myRequests.push({ ...data, id: d.id });
          }
        });
        myRequests.sort(
          (a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime()
        );
        setLatestRequest(myRequests[0] || null);
      },
      () => {}
    );
    return () => unsub();
  }, [user?.uid, user?.email]);

  const accessEval = evaluateSubscriptionAccess(shopProfile, isMasterAdmin);
  const canStartFreeTrial = !shopProfile.trialUsed && shopProfile.subscriptionStatus === 'unselected';
  const isPendingApproval =
    shopProfile.subscriptionStatus === 'pending_approval' && !overrideResubmit;

  const handleCopy = (value: string, label: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopiedField(label);
    success(`${label} copied`);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleStartFreeTrial = async () => {
    if (!user || startingTrial) return;
    setStartingTrial(true);
    try {
      const now = new Date();
      const endsAt = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
      await updateProfileData({
        subscriptionStatus: 'trial',
        trialUsed: true,
        trialStartedAt: now.toISOString(),
        trialEndsAt: endsAt.toISOString(),
      });
      success('2-Day Free Trial activated!');
    } catch {
      toast('Could not activate free trial. Please try again.', 'error');
    } finally {
      setStartingTrial(false);
    }
  };

  const handleScreenshotChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormErrors((prev) => ({
        ...prev,
        screenshot: 'Please upload a valid image file (JPG or PNG).',
      }));
      return;
    }
    setCompressingImage(true);
    setFormErrors((prev) => ({ ...prev, screenshot: '' }));
    try {
      const compressed = await compressPaymentScreenshot(file);
      setScreenshotDataUrl(compressed);
      setScreenshotFileName(file.name);
    } catch (err: any) {
      setFormErrors((prev) => ({
        ...prev,
        screenshot: err.message || 'Could not process image.',
      }));
    } finally {
      setCompressingImage(false);
    }
  };

  const validateCheckoutForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!senderAccountName.trim() || senderAccountName.trim().length < 2) {
      errors.senderAccountName = 'Enter sender account name';
    }
    if (!senderAccountNumber.trim() || senderAccountNumber.trim().length < 6) {
      errors.senderAccountNumber = 'Enter sender mobile or account number';
    }
    const cleanTid = transactionIdLast6.trim();
    if (!/^[A-Za-z0-9]{6}$/.test(cleanTid)) {
      errors.transactionIdLast6 = 'Enter the last 6 digits of Transaction ID (TID)';
    }
    if (!screenshotDataUrl) {
      errors.screenshot = 'Attach payment screenshot';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitPaymentProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || submittingProof) return;
    if (!validateCheckoutForm()) return;

    setSubmittingProof(true);
    try {
      const nowIso = new Date().toISOString();
      const requestPayload: Omit<SubscriptionRequest, 'id'> = {
        shopId: shopProfile.shopId || `shop_${user.uid.slice(0, 8)}`,
        ownerUid: user.uid,
        ownerEmail: (user.email || shopProfile.ownerEmail || '').toLowerCase().trim(),
        shopName: shopProfile.shopName || 'Mobile Center',
        ownerName: shopProfile.ownerName || user.displayName || 'Shop Owner',
        amountPkr: settings.monthlyPricePkr || 1999,
        paymentMethod,
        senderAccountName: senderAccountName.trim(),
        senderAccountNumber: senderAccountNumber.trim(),
        transactionIdLast6: transactionIdLast6.trim().toUpperCase(),
        screenshotDataUrl,
        status: 'pending',
        submittedAt: nowIso,
      };

      const docRef = await addDoc(collection(db, 'subscriptionRequests'), requestPayload);

      await updateProfileData({
        subscriptionStatus: 'pending_approval',
        lastPaymentRequestId: docRef.id,
        subscriptionPlanPrice: settings.monthlyPricePkr || 1999,
        rejectionReason: '',
      });

      setOverrideResubmit(false);
      success('Payment proof submitted for approval!');
    } catch (err: any) {
      toast(err.message || 'Could not submit payment proof.', 'error');
    } finally {
      setSubmittingProof(false);
    }
  };

  const planFeatures = [
    'Mobiles Stock & Purchase Management',
    'Quick Sale, POS Billing & Print Invoices',
    'Customer & Supplier Khata Ledgers',
    'Daily Sales, Expenses & Profit Reports',
    'IMEI & Warranty Verification',
    'Automatic Cloud Backup & Sync',
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-900 flex flex-col">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-200/80 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/logo.png"
              alt="HisaabFlow"
              className="w-9 h-9 rounded-xl object-contain shrink-0"
            />
            <div className="min-w-0">
              <span
                className="font-extrabold text-gray-900 text-base tracking-tight block truncate"
                style={{ fontFamily: 'Sora, sans-serif' }}
              >
                HISAABFLOW
              </span>
              <p className="text-xs text-gray-500 truncate">
                {shopProfile.shopName || 'Mobile Shop'} ({user?.email})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200/80 transition-colors cursor-pointer min-h-[38px]"
          >
            <LogOut className="w-3.5 h-3.5 text-gray-500" />
            <span>Sign out</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8">
        <div className="w-full max-w-2xl">
          {/* Expiry / Rejection Alerts */}
          {(accessEval.expiredReason === 'trial_ended' ||
            accessEval.expiredReason === 'subscription_ended') &&
            !isPendingApproval && (
              <div className="mb-4 p-3.5 rounded-2xl bg-[#FAF5FC] border border-[#522D60]/20 flex items-center gap-3">
                <Clock className="w-4 h-4 text-[#522D60] shrink-0" />
                <p className="text-xs font-semibold text-[#522D60]">
                  {accessEval.expiredReason === 'trial_ended'
                    ? 'Your 2-day free trial has ended. Subscribe below to continue.'
                    : 'Your monthly subscription has ended. Renew below to continue.'}
                </p>
              </div>
            )}

          {shopProfile.rejectionReason && !isPendingApproval && (
            <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="text-xs font-semibold text-rose-700">{shopProfile.rejectionReason}</p>
            </div>
          )}

          {/* VIEW 1: PAYMENT UNDER REVIEW */}
          {isPendingApproval ? (
            <div className="bg-white border border-gray-200/80 rounded-2xl p-6 sm:p-7 shadow-card space-y-5">
              <div className="flex items-center gap-3.5 pb-4 border-b border-gray-100">
                <div className="w-11 h-11 rounded-xl bg-[#FAF5FC] border border-[#522D60]/20 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-[#522D60]" />
                </div>
                <div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[#FAF5FC] text-[#522D60] border border-[#522D60]/20">
                    Pending Approval
                  </span>
                  <h1
                    className="text-lg sm:text-xl font-black text-gray-900 mt-1"
                    style={{ fontFamily: 'Sora, sans-serif' }}
                  >
                    Payment Proof Submitted
                  </h1>
                </div>
              </div>

              {latestRequest && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50 border border-gray-200/70 rounded-xl p-4">
                  <div className="sm:col-span-2 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-gray-200/60">
                      <span className="text-gray-500">Shop</span>
                      <span className="font-bold text-gray-900">{latestRequest.shopName}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-gray-200/60">
                      <span className="text-gray-500">Amount</span>
                      <span
                        className="font-black text-[#522D60] tabular-nums"
                        style={{ fontFamily: 'Sora, sans-serif' }}
                      >
                        PKR {formatPkr(latestRequest.amountPkr)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-gray-200/60">
                      <span className="text-gray-500">Method</span>
                      <span className="font-bold text-gray-900">{latestRequest.paymentMethod}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-gray-200/60">
                      <span className="text-gray-500">Sender</span>
                      <span className="font-bold text-gray-900">
                        {latestRequest.senderAccountName} ({latestRequest.senderAccountNumber})
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-gray-500">TID (Last 6 Digits)</span>
                      <span className="px-2 py-0.5 rounded bg-[#FAF5FC] text-[#522D60] border border-[#522D60]/20 font-mono font-bold tabular-nums">
                        #{latestRequest.transactionIdLast6}
                      </span>
                    </div>
                  </div>

                  {latestRequest.screenshotDataUrl && (
                    <div className="flex flex-col items-center justify-center bg-white rounded-lg p-2 border border-gray-200">
                      <img
                        src={latestRequest.screenshotDataUrl}
                        alt="Receipt"
                        className="max-h-32 w-auto rounded object-contain"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                  <RefreshCw className="w-3.5 h-3.5 text-[#522D60] animate-spin" />
                  <span>Waiting for Admin approval...</span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setOverrideResubmit(true);
                    setStep('checkout');
                  }}
                  className="text-xs font-bold text-[#522D60] hover:underline cursor-pointer"
                >
                  Submit new payment proof
                </button>
              </div>
            </div>
          ) : step === 'plan' ? (
            /* VIEW 2: STEP 1 — CLEAN WHITE SUBSCRIPTION CARD */
            <div className="bg-white border border-gray-200/80 rounded-2xl p-6 sm:p-8 shadow-card space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-100">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FAF5FC] border border-[#522D60]/20 text-[#522D60] text-xs font-bold mb-2">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>HisaabFlow Monthly Plan</span>
                  </span>
                  <h1
                    className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight"
                    style={{ fontFamily: 'Sora, sans-serif' }}
                  >
                    {shopProfile.shopName || 'Mobile Shop'}
                  </h1>
                </div>

                {/* Price Box */}
                <div className="bg-[#FAF5FC] border border-[#522D60]/20 rounded-2xl px-5 py-3.5 text-left sm:text-right shrink-0">
                  <span className="text-[11px] font-bold text-gray-500 block">Monthly Subscription</span>
                  <div className="flex items-baseline sm:justify-end gap-1 mt-0.5">
                    <span className="text-xs font-bold text-[#522D60]">PKR</span>
                    <span
                      className="text-2xl sm:text-3xl font-black text-[#522D60] tabular-nums tracking-tight"
                      style={{ fontFamily: 'Sora, sans-serif' }}
                    >
                      {formatPkr(settings.monthlyPricePkr)}
                    </span>
                    <span className="text-xs text-gray-500 font-semibold">/ month</span>
                  </div>
                </div>
              </div>

              {/* Concise Features List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {planFeatures.map((feat, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-200/60"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#522D60] shrink-0" />
                    <span className="text-xs font-bold text-gray-800">{feat}</span>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2.5">
                <button
                  type="button"
                  onClick={() => setStep('checkout')}
                  className="w-full min-h-[46px] py-3 px-6 rounded-xl bg-[#522D60] hover:bg-[#42244E] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-[#522D60]/20 transition-all cursor-pointer"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>
                    Continue to Subscription (PKR {formatPkr(settings.monthlyPricePkr)})
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                {canStartFreeTrial && (
                  <button
                    type="button"
                    onClick={handleStartFreeTrial}
                    disabled={startingTrial}
                    className="w-full min-h-[44px] py-2.5 px-5 rounded-xl bg-[#FAF5FC] hover:bg-purple-100/70 text-[#522D60] font-bold text-xs sm:text-sm border border-[#522D60]/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
                  >
                    {startingTrial ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-[#522D60]" />
                    ) : (
                      <Clock className="w-4 h-4 text-[#522D60]" />
                    )}
                    <span>
                      {startingTrial ? 'Starting Trial...' : 'Start 2-Day Free Trial'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* VIEW 3: STEP 2 — CLEAN WHITE PAYMENT CHECKOUT CARD */
            <div className="bg-white border border-gray-200/80 rounded-2xl p-6 sm:p-7 shadow-card space-y-5">
              <div className="flex items-center justify-between gap-3 pb-4 border-b border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    if (shopProfile.subscriptionStatus === 'pending_approval') {
                      setOverrideResubmit(false);
                    } else {
                      setStep('plan');
                    }
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200/80 px-3 py-2 rounded-xl transition-colors cursor-pointer min-h-[38px]"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>

                <div className="text-right">
                  <span className="text-[11px] font-semibold text-gray-400 block">Monthly Plan</span>
                  <span
                    className="text-lg font-black text-[#522D60] tabular-nums"
                    style={{ fontFamily: 'Sora, sans-serif' }}
                  >
                    PKR {formatPkr(settings.monthlyPricePkr)}
                  </span>
                </div>
              </div>

              {/* Payment Method Tabs */}
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {(['Easypaisa', 'JazzCash', 'Bank Transfer'] as const).map((method) => {
                    const isSelected = paymentMethod === method;
                    return (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method)}
                        className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#522D60] border-[#522D60] text-white shadow-sm'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {method === 'Bank Transfer' ? (
                          <Building2 className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <Smartphone className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span className="truncate">{method}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Receiving Account Box */}
                <div className="p-4 rounded-xl bg-[#FAF5FC] border border-[#522D60]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {paymentMethod === 'Easypaisa' && (
                    <>
                      <div>
                        <span className="text-[11px] font-bold text-[#522D60] block">
                          Easypaisa • {settings.easypaisaTitle || 'HisaabFlow'}
                        </span>
                        <p
                          className="text-base sm:text-lg font-black text-gray-900 font-mono tabular-nums mt-0.5"
                          style={{ fontFamily: 'Sora, sans-serif' }}
                        >
                          {settings.easypaisaNumber || '0300-0000000'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(settings.easypaisaNumber || '0300-0000000', 'Easypaisa number')
                        }
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-gray-50 text-xs font-bold text-[#522D60] border border-[#522D60]/25 transition-colors cursor-pointer min-h-[38px] shrink-0"
                      >
                        {copiedField === 'Easypaisa number' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-[#522D60]" />
                        )}
                        <span>{copiedField === 'Easypaisa number' ? 'Copied' : 'Copy Number'}</span>
                      </button>
                    </>
                  )}

                  {paymentMethod === 'JazzCash' && (
                    <>
                      <div>
                        <span className="text-[11px] font-bold text-[#522D60] block">
                          JazzCash • {settings.jazzcashTitle || 'HisaabFlow'}
                        </span>
                        <p
                          className="text-base sm:text-lg font-black text-gray-900 font-mono tabular-nums mt-0.5"
                          style={{ fontFamily: 'Sora, sans-serif' }}
                        >
                          {settings.jazzcashNumber || '0300-0000000'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(settings.jazzcashNumber || '0300-0000000', 'JazzCash number')
                        }
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-gray-50 text-xs font-bold text-[#522D60] border border-[#522D60]/25 transition-colors cursor-pointer min-h-[38px] shrink-0"
                      >
                        {copiedField === 'JazzCash number' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-[#522D60]" />
                        )}
                        <span>{copiedField === 'JazzCash number' ? 'Copied' : 'Copy Number'}</span>
                      </button>
                    </>
                  )}

                  {paymentMethod === 'Bank Transfer' && (
                    <>
                      <div>
                        <span className="text-[11px] font-bold text-[#522D60] block">
                          {settings.bankName || 'Bank'} • {settings.bankAccountTitle || 'HisaabFlow'}
                        </span>
                        <p
                          className="text-sm sm:text-base font-black text-gray-900 font-mono tabular-nums mt-0.5 break-all"
                          style={{ fontFamily: 'Sora, sans-serif' }}
                        >
                          {settings.bankAccountNumber || 'PK00MEZN0000000000000000'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            settings.bankAccountNumber || 'PK00MEZN0000000000000000',
                            'Account number'
                          )
                        }
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-gray-50 text-xs font-bold text-[#522D60] border border-[#522D60]/25 transition-colors cursor-pointer min-h-[38px] shrink-0"
                      >
                        {copiedField === 'Account number' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-[#522D60]" />
                        )}
                        <span>{copiedField === 'Account number' ? 'Copied' : 'Copy Account'}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Payment Verification Form */}
              <form onSubmit={handleSubmitPaymentProof} className="space-y-4 pt-2 border-t border-gray-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Sender Account Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={senderAccountName}
                      onChange={(e) => {
                        setSenderAccountName(e.target.value);
                        if (formErrors.senderAccountName) {
                          setFormErrors((prev) => ({ ...prev, senderAccountName: '' }));
                        }
                      }}
                      placeholder="e.g. Muhammad Bilal"
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-900 focus:bg-white focus:outline-none focus:border-[#522D60]"
                    />
                    {formErrors.senderAccountName && (
                      <p className="text-[11px] text-rose-600 mt-1">{formErrors.senderAccountName}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Sender Mobile / Account No. <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={senderAccountNumber}
                      onChange={(e) => {
                        setSenderAccountNumber(e.target.value);
                        if (formErrors.senderAccountNumber) {
                          setFormErrors((prev) => ({ ...prev, senderAccountNumber: '' }));
                        }
                      }}
                      placeholder="e.g. 0301-1234567"
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-900 font-mono tabular-nums focus:bg-white focus:outline-none focus:border-[#522D60]"
                    />
                    {formErrors.senderAccountNumber && (
                      <p className="text-[11px] text-rose-600 mt-1">{formErrors.senderAccountNumber}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Last 6 Digits of TID <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={transactionIdLast6}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 6);
                        setTransactionIdLast6(clean);
                        if (formErrors.transactionIdLast6) {
                          setFormErrors((prev) => ({ ...prev, transactionIdLast6: '' }));
                        }
                      }}
                      placeholder="e.g. 482910"
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm font-bold text-[#522D60] font-mono tracking-widest tabular-nums placeholder:font-normal placeholder:tracking-normal focus:bg-white focus:outline-none focus:border-[#522D60]"
                    />
                    {formErrors.transactionIdLast6 && (
                      <p className="text-[11px] text-rose-600 mt-1">{formErrors.transactionIdLast6}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Payment Screenshot <span className="text-rose-500">*</span>
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleScreenshotChange}
                      className="hidden"
                    />

                    {!screenshotDataUrl ? (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={compressingImage}
                        className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-dashed border-[#522D60]/40 bg-[#FAF5FC]/60 hover:bg-[#FAF5FC] flex items-center justify-center gap-2 text-xs font-bold text-[#522D60] transition-colors cursor-pointer"
                      >
                        {compressingImage ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Uploading...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            <span>Upload Receipt Screenshot</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="px-3 py-1.5 rounded-xl bg-[#FAF5FC] border border-[#522D60]/25 flex items-center justify-between gap-2 min-h-[42px]">
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={screenshotDataUrl}
                            alt="Receipt"
                            className="w-7 h-7 rounded object-cover border border-gray-200 shrink-0"
                          />
                          <span className="text-xs font-bold text-[#522D60] truncate">
                            {screenshotFileName || 'Screenshot attached'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setScreenshotDataUrl('');
                            setScreenshotFileName('');
                          }}
                          aria-label="Remove screenshot"
                          className="p-1 rounded-lg text-gray-400 hover:text-rose-600 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    {formErrors.screenshot && (
                      <p className="text-[11px] text-rose-600 mt-1">{formErrors.screenshot}</p>
                    )}
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submittingProof || compressingImage}
                    className="w-full min-h-[46px] py-3 px-6 rounded-xl bg-[#522D60] hover:bg-[#42244E] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-[#522D60]/20 transition-all cursor-pointer disabled:opacity-60"
                  >
                    {submittingProof ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <FileCheck2 className="w-4 h-4" />
                        <span>Submit Payment for Approval</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Printer, Share2, X, Bluetooth } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { SHOP_CONFIG, getWhatsAppSaleBillUrl } from '../../config/shopConfig';
import { BluetoothPrinterModal } from './BluetoothPrinterModal';
import { printInNewWindow } from '../../utils/printUtils';

interface BillPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  htmlContent: string;
  title?: string;
  billNumber?: string;
  billData?: any;
  onShareWhatsApp?: () => void;
}

export function BillPreviewModal({
  isOpen,
  onClose,
  htmlContent,
  title = 'Receipt Preview',
  billNumber,
  billData,
  onShareWhatsApp,
}: BillPreviewModalProps) {
  const { shopProfile } = useAuth();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const { success, error } = useToast();
  const [showBluetoothModal, setShowBluetoothModal] = useState(false);
  const [iframeHeight, setIframeHeight] = useState<number>(460);

  // Sync content and measure natural height
  const syncIframe = () => {
    if (!iframeRef.current || !htmlContent) return;
    try {
      const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(htmlContent);
        doc.close();

        const updateHeight = () => {
          try {
            const body = doc.body;
            const html = doc.documentElement;
            if (body && html) {
              const h = Math.max(
                body.scrollHeight,
                body.offsetHeight,
                html.scrollHeight,
                html.offsetHeight
              );
              if (h > 100) {
                setIframeHeight(h + 12);
              }
            }
          } catch (e) {
            // Ignore cross-origin error if any
          }
        };

        updateHeight();
        setTimeout(updateHeight, 80);
        setTimeout(updateHeight, 250);
      }
    } catch (e) {
      // Fallback
    }
  };

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(syncIframe, 40);
      return () => clearTimeout(timer);
    }
  }, [isOpen, htmlContent]);

  if (!isOpen) return null;

  const handlePrint = () => {
    try {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
        return;
      }
    } catch (e) {
      console.warn('Direct iframe print error, using fallback:', e);
    }
    const docTitle = `${title} ${billNumber ? `#${billNumber}` : ''}`.trim();
    const ok = printInNewWindow(htmlContent, docTitle, iframeRef.current);
    if (!ok) {
      error('Could not open print dialog. Please ensure popups are allowed.');
    }
  };

  const handleShare = async () => {
    if (onShareWhatsApp && (billData?.customerPhone || billData?.phone)) {
      onShareWhatsApp();
      return;
    }

    const currentShop = shopProfile?.shopName || billData?.shopName || SHOP_CONFIG.name;
    const customerName = billData?.customerName || 'Walk-in Customer';
    const customerPhone = billData?.customerPhone || billData?.phone || '';
    const firstItem = billData?.items?.[0];
    const itemName =
      firstItem?.modelName ||
      firstItem?.itemName ||
      billData?.itemName ||
      billData?.modelName ||
      'Mobile Purchase';
    const totalAmount =
      billData?.totalSellPrice ||
      billData?.totalSellAmount ||
      billData?.sellPrice ||
      firstItem?.sellPrice ||
      0;
    const paymentMethod = billData?.paymentMethod || 'Cash';
    const imei = firstItem?.imei1 || billData?.imei1 || '';
    const resolvedBillNum =
      billNumber ||
      billData?.billNumber ||
      (billData?.id ? String(billData.id).substring(0, 8).toUpperCase() : '');

    // If customer phone is available, open WhatsApp directly with pre-filled receipt
    if (customerPhone) {
      const url = getWhatsAppSaleBillUrl(
        customerPhone,
        customerName,
        itemName,
        Number(totalAmount) || 0,
        paymentMethod,
        imei,
        resolvedBillNum
      );
      window.open(url, '_blank');
      return;
    }

    // Build clean shareable receipt text for native mobile share sheet or WhatsApp picker
    const receiptText = [
      `*${currentShop} - Sale Receipt*`,
      resolvedBillNum ? `Invoice: #${resolvedBillNum}` : '',
      `Customer: ${customerName}`,
      `Item: ${itemName}`,
      imei ? `IMEI: ${imei}` : '',
      `Total Amount: Rs. ${(Number(totalAmount) || 0).toLocaleString()}`,
      `Payment: ${paymentMethod}`,
      `Thank you for your business!`,
    ]
      .filter(Boolean)
      .join('\n');

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `${currentShop} - Receipt ${resolvedBillNum ? `#${resolvedBillNum}` : ''}`,
          text: receiptText,
        });
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    // Fallback: open WhatsApp contact selector with full receipt message
    const waUrl = getWhatsAppSaleBillUrl(
      '',
      customerName,
      itemName,
      Number(totalAmount) || 0,
      paymentMethod,
      imei,
      resolvedBillNum
    );
    window.open(waUrl, '_blank');
    success('Opening WhatsApp to share receipt');
  };

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[env(safe-area-inset-top,0px)]"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 16 }}
            transition={{ duration: 0.18 }}
            className="bg-white w-full max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh] sm:max-h-[88vh] border border-slate-200"
          >
            {/* Top Brand Header */}
            <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-[#522D60] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src="/logo.png"
                  alt="HisaabFlow"
                  className="w-5 h-5 rounded-md object-contain bg-white/10 p-0.5 shrink-0"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-extrabold truncate text-white leading-tight">
                    {title} {billNumber ? `(#${billNumber})` : ''}
                  </h3>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors active:scale-95 cursor-pointer"
                aria-label="Close Preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Responsive Action Toolbar */}
            <div className="px-3 py-2.5 sm:px-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <span className="text-xs text-slate-500 font-semibold hidden md:inline">
                Ready for print & share
              </span>

              <div className="grid grid-cols-3 sm:flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
                {/* Share Button (Always available!) */}
                <button
                  type="button"
                  onClick={handleShare}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer min-h-[38px]"
                  title="Share Receipt via WhatsApp or Mobile Share"
                >
                  <Share2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Share</span>
                </button>

                {/* Bluetooth Thermal Mini Printer */}
                {billData ? (
                  <button
                    type="button"
                    onClick={() => setShowBluetoothModal(true)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer min-h-[38px]"
                    title="Print to Bluetooth thermal mini printer (58mm/80mm)"
                  >
                    <Bluetooth className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Bluetooth</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex items-center justify-center px-3 py-2 sm:py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 transition-all active:scale-95 cursor-pointer min-h-[38px]"
                  >
                    Close
                  </button>
                )}

                {/* System Print */}
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-1.5 rounded-xl bg-[#522D60] hover:bg-[#42244D] text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer min-h-[38px]"
                  title="Print Document"
                >
                  <Printer className="w-3.5 h-3.5 stroke-[2.2] shrink-0" />
                  <span className="truncate">Print</span>
                </button>

                {/* Desktop Close Button */}
                {billData && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="hidden sm:inline-flex items-center justify-center px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 transition-all active:scale-95 cursor-pointer min-h-[38px]"
                  >
                    Close
                  </button>
                )}
              </div>
            </div>

            {/* Natural, Fully Responsive Document Stage */}
            <div className="flex-1 overflow-y-auto bg-slate-100/90 p-2 sm:p-5 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] flex justify-center items-start">
              <div className="w-full max-w-2xl bg-white rounded-xl shadow-xs border border-slate-200/80 overflow-hidden">
                <iframe
                  ref={iframeRef}
                  srcDoc={htmlContent}
                  title="Print Preview"
                  className="w-full border-0 bg-white block"
                  style={{
                    height: `${iframeHeight}px`,
                    minHeight: '340px',
                    transition: 'height 0.18s ease',
                  }}
                  onLoad={syncIframe}
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* Bluetooth Mini Printer Modal */}
      {billData && (
        <BluetoothPrinterModal
          isOpen={showBluetoothModal}
          onClose={() => setShowBluetoothModal(false)}
          billData={billData}
        />
      )}
    </>
  );
}

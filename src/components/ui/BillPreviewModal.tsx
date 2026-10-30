import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Printer, Share2, X, Bluetooth } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { SHOP_CONFIG } from '../../config/shopConfig';
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
  const [iframeHeight, setIframeHeight] = useState<number>(650);

  // Sync content and measure natural height
  const syncIframe = () => {
    if (!iframeRef.current || !htmlContent) return;
    try {
      const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(htmlContent);
        doc.close();

        // Automatically expand iframe height to fit full document without internal scrollbars
        const updateHeight = () => {
          try {
            const body = doc.body;
            const html = doc.documentElement;
            if (body && html) {
              const h = Math.max(
                body.scrollHeight,
                body.offsetHeight,
                html.clientHeight,
                html.scrollHeight,
                html.offsetHeight
              );
              if (h > 100) {
                setIframeHeight(h + 20);
              }
            }
          } catch (e) {
            // Ignore cross-origin error if any
          }
        };

        // Update immediately and after images/fonts settle
        updateHeight();
        setTimeout(updateHeight, 100);
        setTimeout(updateHeight, 300);
      }
    } catch (e) {
      // Fallback
    }
  };

  useEffect(() => {
    if (isOpen) {
      // Delay slightly for modal mounting animation
      const timer = setTimeout(syncIframe, 50);
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
    if (onShareWhatsApp) {
      onShareWhatsApp();
      return;
    }
    const currentShop = shopProfile?.shopName || SHOP_CONFIG.name;
    if (navigator.share) {
      try {
        await navigator.share({
          title: title || 'Sales Receipt',
          text: `Sales Receipt #${billNumber || ''} from ${currentShop}`,
          url: window.location.href,
        });
        success('Shared successfully');
      } catch (err) {
        // User cancelled share
      }
    } else {
      success('Receipt link ready to share');
    }
  };

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 pt-[max(0.5rem,env(safe-area-inset-top,0px))] pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.16 }}
            className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col overflow-hidden h-[94vh] max-h-[900px] border border-slate-200"
          >
            {/* Top Brand Header */}
            <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-[#522D60] text-white flex items-center justify-between shrink-0 shadow-sm">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src="/logo.png"
                  alt="HisaabFlow"
                  className="w-5 h-5 rounded-md object-contain bg-white/10 p-0.5 shrink-0"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <h3 className="text-sm sm:text-base font-extrabold truncate text-white">
                  {title} {billNumber ? `(#${billNumber})` : ''}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors active:scale-95 cursor-pointer"
                aria-label="Close Preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Action Toolbar */}
            <div className="px-3 sm:px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0 flex-wrap">
              <span className="text-xs text-slate-500 font-semibold hidden sm:inline">
                Print Preview • Ready for print & share
              </span>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap w-full sm:w-auto justify-end">
                {/* Bluetooth Thermal Mini Printer */}
                {billData && (
                  <button
                    type="button"
                    onClick={() => setShowBluetoothModal(true)}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
                    title="Print to Bluetooth thermal mini printer (58mm/80mm)"
                  >
                    <Bluetooth className="w-3.5 h-3.5" />
                    <span>Bluetooth Printer</span>
                  </button>
                )}

                {/* WhatsApp Share */}
                {onShareWhatsApp && (
                  <button
                    type="button"
                    onClick={onShareWhatsApp}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>
                )}

                {/* System Print */}
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#522D60] hover:bg-[#42244D] text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
                  title="Print Document"
                >
                  <Printer className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Print</span>
                </button>

                {/* Close */}
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 transition-all active:scale-95 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Natural, Fully Responsive Document Stage */}
            <div className="flex-1 overflow-y-auto bg-slate-100/90 p-2 sm:p-5 flex justify-center items-start">
              <div className="w-full max-w-2xl bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
                <iframe
                  ref={iframeRef}
                  srcDoc={htmlContent}
                  title="Print Preview"
                  className="w-full border-0 bg-white block"
                  style={{
                    height: `${iframeHeight}px`,
                    minHeight: '480px',
                    transition: 'height 0.2s ease',
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

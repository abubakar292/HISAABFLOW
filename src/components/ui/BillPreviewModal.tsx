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
  onShareWhatsApp
}: BillPreviewModalProps) {
  const { shopProfile } = useAuth();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const { success, error } = useToast();
  const [showBluetoothModal, setShowBluetoothModal] = useState(false);

  useEffect(() => {
    if (isOpen && iframeRef.current && htmlContent) {
      try {
        const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(htmlContent);
          doc.close();
        }
      } catch (e) {
        // Fallback to srcDoc if contentDocument write is restricted
      }
    }
  }, [isOpen, htmlContent]);

  if (!isOpen) return null;

  const handlePrint = () => {
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
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 pt-[max(0.5rem,env(safe-area-inset-top,0px))] pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[calc(100vh-1rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] border border-gray-200"
          >
            {/* Header */}
            <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-[#522D60] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-300 shrink-0" />
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
            <div className="px-3 sm:px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-2 shrink-0 flex-wrap">
              <span className="text-[11px] text-gray-500 font-medium hidden sm:inline">
                Preview before printing or sharing
              </span>
              <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto justify-end flex-wrap">
                {/* Bluetooth Thermal Mini Printer Button */}
                {billData && (
                  <button
                    type="button"
                    onClick={() => setShowBluetoothModal(true)}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
                    title="Print directly to Bluetooth 58mm/80mm thermal mini printer"
                  >
                    <Bluetooth className="w-3.5 h-3.5" />
                    Bluetooth Printer
                  </button>
                )}

                {onShareWhatsApp && (
                  <button
                    type="button"
                    onClick={onShareWhatsApp}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    WhatsApp
                  </button>
                )}

                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#522D60] hover:bg-[#42244D] text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
                  title="System / Wi-Fi Print"
                >
                  <Printer className="w-3.5 h-3.5 stroke-[2.5]" />
                  System Print
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center px-3 py-1.5 rounded-xl bg-white hover:bg-gray-100 text-gray-700 text-xs font-bold border border-gray-200 transition-all active:scale-95"
                >
                  Close
                </button>
              </div>
            </div>

            {/* In-App Render Container (Safe for iOS standalone PWA) */}
            <div className="flex-1 overflow-auto bg-gray-100 p-2 sm:p-4 min-h-[300px]">
              <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden h-full min-h-[380px]">
                <iframe
                  ref={iframeRef}
                  srcDoc={htmlContent}
                  title="Bill Preview"
                  className="w-full h-full min-h-[420px] border-0 bg-white"
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

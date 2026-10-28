import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bluetooth, 
  Printer, 
  X, 
  Check, 
  AlertCircle, 
  Copy, 
  Share2, 
  ExternalLink, 
  Smartphone, 
  Zap, 
  Info 
} from 'lucide-react';
import { 
  isBluetoothSupported, 
  isIosDevice, 
  connectBluetoothPrinter, 
  generateEscPosReceipt, 
  printToBluetoothDevice, 
  generatePlainTextReceipt, 
  getRawBtDeepLink 
} from '../../utils/bluetoothPrinter';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { SHOP_CONFIG } from '../../config/shopConfig';

interface BluetoothPrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
  billData: any;
}

export function BluetoothPrinterModal({
  isOpen,
  onClose,
  billData,
}: BluetoothPrinterModalProps) {
  const { shopProfile } = useAuth();
  const { success, error: toastError } = useToast();
  const [isPrinting, setIsPrinting] = useState(false);
  const [printStatus, setPrintStatus] = useState<string>('');
  const [copied, setCopied] = useState(false);

  if (!isOpen || !billData) return null;

  const currentShopName = shopProfile?.shopName || SHOP_CONFIG.name;
  const hasWebBluetooth = isBluetoothSupported();
  const isIos = isIosDevice();
  const plainReceipt = generatePlainTextReceipt(billData, currentShopName);

  // 1-Click Direct Web Bluetooth Print
  const handleDirectBluetoothPrint = async () => {
    try {
      setIsPrinting(true);
      setPrintStatus('Opening Bluetooth scanner... Please select your mini printer.');

      const deviceObj = await connectBluetoothPrinter();

      setPrintStatus(`Connected to ${deviceObj.device.name || 'Printer'}! Generating ESC/POS receipt...`);

      const receiptBytes = generateEscPosReceipt(billData, currentShopName);

      setPrintStatus('Sending receipt to thermal printer...');
      await printToBluetoothDevice(deviceObj, receiptBytes);

      setPrintStatus('Receipt printed successfully! 🎉');
      success(`Receipt sent to ${deviceObj.device.name || 'Bluetooth Printer'}!`);
      setTimeout(() => {
        setIsPrinting(false);
        setPrintStatus('');
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Bluetooth printing error:', err);
      setIsPrinting(false);
      setPrintStatus('');
      if (err.name === 'NotFoundError') {
        // User cancelled picker
        return;
      }
      toastError(err.message || 'Bluetooth printing failed.');
    }
  };

  // Copy plain thermal receipt text
  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(plainReceipt);
      setCopied(true);
      success('Thermal receipt text copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      toastError('Could not copy to clipboard.');
    }
  };

  // Share receipt text to installed Bluetooth printer apps or WhatsApp
  const handleShareReceipt = async () => {
    const billNum = billData.billNumber || billData.id || 'Receipt';
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${SHOP_CONFIG.name} Receipt #${billNum}`,
          text: plainReceipt,
        });
        success('Shared receipt!');
      } catch (e) {
        // user cancelled
      }
    } else {
      handleCopyText();
    }
  };

  // Open RawBT thermal printer app deep link
  const handleOpenRawBt = () => {
    const rawBtUrl = getRawBtDeepLink(billData);
    window.location.href = rawBtUrl;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[calc(100vh-1.5rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] border border-gray-200"
        >
          {/* Header */}
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-obsidian-dark text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0">
                <Bluetooth className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-extrabold text-white truncate">
                  Bluetooth Thermal Printer (58mm/80mm)
                </h3>
                <p className="text-[11px] text-gray-400 truncate">
                  {SHOP_CONFIG.name} • Direct ESC/POS Print
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors active:scale-95"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Content */}
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3.5 text-slate-800">
            
            {/* Why Wi-Fi only explanation banner */}
            <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 flex gap-2.5 items-start">
              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 leading-relaxed">
                <strong className="font-bold block text-amber-950 mb-0.5">
                  Why standard print only shows Wi-Fi printers:
                </strong>
                Web browsers (especially Safari on iPhone) only search for <strong>Wi-Fi (AirPrint)</strong> printers in the standard dialog. Mini Bluetooth receipt printers use <strong>ESC/POS commands over Bluetooth</strong> instead of Wi-Fi. Use the options below to print directly!
              </div>
            </div>

            {/* Direct Web Bluetooth Action (If supported) */}
            {hasWebBluetooth ? (
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                    <Zap className="w-3.5 h-3.5 text-blue-600 fill-blue-600" />
                    Direct Web Bluetooth Available
                  </div>
                  <span className="text-[10px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full">
                    Recommended
                  </span>
                </div>
                <p className="text-xs text-blue-800">
                  Connect directly to your 58mm / 80mm mini printer (POS-58, MPT-II, GOOJPRT, Xprinter, etc.) and print instantly:
                </p>
                <button
                  type="button"
                  onClick={handleDirectBluetoothPrint}
                  disabled={isPrinting}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-70"
                >
                  {isPrinting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Bluetooth className="w-4 h-4" />
                  )}
                  {isPrinting ? 'Connecting & Printing...' : 'Connect & Print via Bluetooth'}
                </button>
                {printStatus && (
                  <p className="text-[11px] text-blue-900 font-medium text-center animate-pulse pt-1">
                    {printStatus}
                  </p>
                )}
              </div>
            ) : (
              /* For iOS / Safari or browsers without Web Bluetooth */
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Smartphone className="w-4 h-4 text-slate-700" />
                  {isIos ? 'iPhone / iOS Bluetooth Printing Methods' : 'Bluetooth Printing Options'}
                </div>
                <p className="text-[11px] text-slate-600 leading-normal">
                  Apple Safari does not allow web pages to access Bluetooth directly. You can print to your mini printer using any of these easy methods:
                </p>

                {/* iPhone Tip: Bluefy */}
                {isIos && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-xs text-emerald-950 space-y-1">
                    <div className="font-bold text-emerald-900 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
                      1-Tap Solution for iPhone (Bluefy Browser):
                    </div>
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      Download <strong>"Bluefy - Web BLE Browser"</strong> (free on Apple App Store). When you open this app in Bluefy, Bluetooth mini printing works with 1 click directly!
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Universal Instant Actions: Share & RawBT */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                Instant Bluetooth Print Tools
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Share to Printer App */}
                <button
                  type="button"
                  onClick={handleShareReceipt}
                  className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-xs active:scale-95"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Share to Printer App
                </button>

                {/* Print via RawBT */}
                <button
                  type="button"
                  onClick={handleOpenRawBt}
                  className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-obsidian hover:bg-obsidian-light text-white font-bold text-xs transition-all shadow-xs active:scale-95"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Open in RawBT App
                </button>
              </div>

              {/* Copy plain receipt */}
              <button
                type="button"
                onClick={handleCopyText}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs transition-all active:scale-95 border border-gray-200"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied Receipt Text!' : 'Copy 58mm Receipt Text'}
              </button>
            </div>

            {/* Live Monospace Receipt Preview */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  58mm Receipt Output Preview
                </span>
                <span className="text-[10px] text-gray-400">32-Column Monospace</span>
              </div>
              <pre className="bg-gray-900 text-gray-100 p-3 rounded-xl text-[10.5px] font-mono whitespace-pre overflow-x-auto border border-gray-800 max-h-48 leading-relaxed selection:bg-amber-500 selection:text-black">
                {plainReceipt}
              </pre>
            </div>

          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between shrink-0">
            <span className="text-[11px] text-gray-500">
              Compatible with all 58mm & 80mm ESC/POS printers
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-bold transition-all active:scale-95"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

import React, { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { Smartphone, Download, Share2, PlusSquare, MoreVertical, CheckCircle2, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import { SHOP_CONFIG } from '../config/shopConfig';

interface InstallPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InstallPromptModal({ isOpen, onClose }: InstallPromptModalProps) {
  const [deviceType, setDeviceType] = useState<'android' | 'ios' | 'other'>('android');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Detect OS
    const userAgent = navigator.userAgent || navigator.vendor;
    if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
      setDeviceType('ios');
    } else if (/android/i.test(userAgent)) {
      setDeviceType('android');
    } else {
      setDeviceType('android'); // Default to android/chrome guide
    }

    // Check if running in standalone mode (already installed)
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
      setIsInstalled(true);
    }

    // Listen for native beforeinstallprompt (Chrome / Android / Edge)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleNativeInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
        onClose();
      }
      setDeferredPrompt(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Install AMZ App on Phone" size="md">
      <div className="space-y-5">
        {/* Header Banner */}
        <div className="bg-[#522D60] text-white p-4 rounded-2xl border border-[#522D60] flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-white p-1 border border-white/20 flex items-center justify-center shrink-0 shadow-md">
            <img src={SHOP_CONFIG.logoUrl} alt={SHOP_CONFIG.shortName} className="w-full h-full object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-white text-base tracking-tight truncate">
                {SHOP_CONFIG.name}
              </h3>
              <span className="text-[10px] bg-white text-[#522D60] font-black px-1.5 py-0.5 rounded uppercase">
                PWA App
              </span>
            </div>
            <p className="text-xs text-purple-200 truncate">
              Install like a native Android / iPhone App (No Play Store required)
            </p>
          </div>
        </div>

        {/* If native install is ready (Android Chrome) */}
        {deferredPrompt && !isInstalled && (
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-center space-y-3">
            <p className="text-sm font-bold text-emerald-900">
              One-Click Automatic Installation Available!
            </p>
            <button
              onClick={handleNativeInstall}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
            >
              <Download className="w-5 h-5" />
              Tap Here to Install AMZ App Now
            </button>
          </div>
        )}

        {/* Device Switcher Tabs */}
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setDeviceType('android')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              deviceType === 'android'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <span>🤖 Android (Samsung, Vivo, etc.)</span>
          </button>
          <button
            onClick={() => setDeviceType('ios')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              deviceType === 'ios'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <span>🍎 iPhone (Apple iOS)</span>
          </button>
        </div>

        {/* Step-by-Step Instructions */}
        {deviceType === 'android' ? (
          <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200/70 text-xs sm:text-sm text-gray-700">
            <h4 className="font-bold text-gray-900 flex items-center gap-2 text-sm">
              <Smartphone className="w-4 h-4 text-emerald-600" />
              Android Phone Steps (Google Chrome / Brave):
            </h4>
            
            <div className="flex items-start gap-3 pt-2">
              <span className="w-6 h-6 rounded-full bg-amber-500 text-obsidian-dark font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                1
              </span>
              <div>
                <strong className="text-gray-900 block font-semibold">Open in Google Chrome</strong>
                <span>Open your shop link on the client's phone in Google Chrome.</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-amber-500 text-obsidian-dark font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                2
              </span>
              <div>
                <strong className="text-gray-900 block font-semibold flex items-center gap-1">
                  Tap 3 Dots Menu <MoreVertical className="w-3.5 h-3.5 text-gray-700 inline" />
                </strong>
                <span>Tap the three vertical dots located in top-right corner of Chrome.</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-amber-500 text-obsidian-dark font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                3
              </span>
              <div>
                <strong className="text-gray-900 block font-semibold flex items-center gap-1">
                  Tap "Install App" or "Add to Home screen"
                </strong>
                <span>Tap the option labeled <em>"Install App"</em> (or <em>"Add to Home Screen"</em>).</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-amber-500 text-obsidian-dark font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                4
              </span>
              <div>
                <strong className="text-gray-900 block font-semibold">Confirm "Install"</strong>
                <span>A popup with AMZ logo will appear. Click <strong>Install</strong>. The AMZ App icon will appear on their home screen like any normal app!</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200/70 text-xs sm:text-sm text-gray-700">
            <h4 className="font-bold text-gray-900 flex items-center gap-2 text-sm">
              <Smartphone className="w-4 h-4 text-blue-600" />
              iPhone Steps (Apple Safari):
            </h4>
            
            <div className="flex items-start gap-3 pt-2">
              <span className="w-6 h-6 rounded-full bg-amber-500 text-obsidian-dark font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                1
              </span>
              <div>
                <strong className="text-gray-900 block font-semibold">Open in Safari</strong>
                <span>Make sure the link is opened in the official <strong>Safari</strong> browser on iPhone.</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-amber-500 text-obsidian-dark font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                2
              </span>
              <div>
                <strong className="text-gray-900 block font-semibold flex items-center gap-1">
                  Tap the Share Button <Share2 className="w-3.5 h-3.5 text-blue-600 inline" />
                </strong>
                <span>Tap the blue Share square icon with an up-arrow at the bottom bar of Safari.</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-amber-500 text-obsidian-dark font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                3
              </span>
              <div>
                <strong className="text-gray-900 block font-semibold flex items-center gap-1">
                  Scroll and tap "Add to Home Screen" <PlusSquare className="w-3.5 h-3.5 text-gray-700 inline" />
                </strong>
                <span>Scroll down slightly and tap <strong>"Add to Home Screen"</strong>.</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-amber-500 text-obsidian-dark font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                4
              </span>
              <div>
                <strong className="text-gray-900 block font-semibold">Tap "Add"</strong>
                <span>Tap <strong>Add</strong> in the top-right corner. The AMZ App icon will now be saved on your client's iPhone home screen!</span>
              </div>
            </div>
          </div>
        )}

        {/* Benefits badge */}
        <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl flex items-center gap-3 text-xs text-amber-950 font-medium">
          <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
          <span>
            Once installed, it opens in full-screen standalone mode with no browser URL bars, works fast, and saves shop login!
          </span>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-gray-900 text-white font-bold text-xs sm:text-sm hover:bg-black transition-colors"
        >
          Got It! Close Guide
        </button>
      </div>
    </Modal>
  );
}

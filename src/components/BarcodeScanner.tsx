import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { 
  Zap, 
  ZapOff, 
  Camera, 
  Scan, 
  CheckCircle2, 
  AlertCircle,
  QrCode
} from 'lucide-react';
import { playScanSound } from '../utils/soundEffects';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (imei: string) => void;
  onScanBoth?: (imei1: string, imei2: string) => void;
  targetField?: 'imei1' | 'imei2' | string;
  title?: string;
}

// Extract all valid 14-16 digit IMEIs found in the scanned text (for dual-IMEI box QR/barcodes)
export function extractAllImeis(rawText: string): string[] {
  if (!rawText) return [];
  const text = rawText.trim();
  const results: string[] = [];

  const addIfValid = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 15);
    if (clean.length >= 14 && !results.includes(clean)) {
      results.push(clean);
    }
  };

  // 1. Explicit IMEI 1 & IMEI 2 labels (common on Samsung, Tecno, Infinix, Xiaomi)
  const imei1Match = text.match(/IMEI\s*1\D*(\d{14,16})/i);
  const imei2Match = text.match(/IMEI\s*2\D*(\d{14,16})/i);
  if (imei1Match && imei1Match[1]) addIfValid(imei1Match[1]);
  if (imei2Match && imei2Match[1]) addIfValid(imei2Match[1]);

  // 2. All 14-16 digit sequences in the string
  const digitSequences = text.match(/\b\d{14,16}\b/g);
  if (digitSequences) {
    digitSequences.forEach(seq => addIfValid(seq));
  }

  // 3. Delimited tokens (slashes, newlines, commas)
  if (results.length === 0) {
    const tokens = text.split(/[\r\n;,/|\s]+/);
    for (const tok of tokens) {
      const digits = tok.replace(/\D/g, '');
      if (digits.length >= 14 && digits.length <= 16) {
        addIfValid(digits);
      }
    }
  }

  return results;
}

// Clean and extract valid 14-16 digit IMEI or serial from raw barcode text
export function extractImeiFromBarcode(rawText: string, preferIndex: 0 | 1 = 0): string {
  const all = extractAllImeis(rawText);
  if (all.length > 0) {
    if (preferIndex === 1 && all.length > 1) {
      return all[1];
    }
    return all[0];
  }

  // Fallback for alphanumeric serials or plain digit sequence
  const clean = (rawText || '').trim();
  const digitsOnly = clean.replace(/\D/g, '');
  if (digitsOnly.length >= 14) {
    return digitsOnly.slice(0, 15);
  }
  if (clean.length >= 8 && clean.length <= 20) {
    return clean;
  }
  return digitsOnly || clean;
}

export function BarcodeScanner({ 
  isOpen, 
  onClose, 
  onScan, 
  onScanBoth,
  targetField,
  title
}: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStartedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const containerId = 'box-barcode-scanner-viewport';

  // Scanning mode: 'barcode' (narrow precision laser slit) or 'qr' (square micro-QR focus)
  const [scanMode, setScanMode] = useState<'barcode' | 'qr'>('barcode');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [hasHardwareZoom, setHasHardwareZoom] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  const [scanSuccessAnim, setScanSuccessAnim] = useState<boolean>(false);
  const [detectedMultipleImeis, setDetectedMultipleImeis] = useState<string[] | null>(null);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current && isStartedRef.current) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.debug('Error stopping scanner:', err);
      }
      isStartedRef.current = false;
    }
  }, []);

  const finishWithImei = useCallback((imei: string) => {
    setScanSuccessAnim(true);
    playScanSound();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([60, 30, 60]);
    }
    stopScanner();
    setTimeout(() => {
      onScan(imei);
      onClose();
    }, 240);
  }, [onScan, onClose, stopScanner]);

  const handleSuccessfulScan = useCallback((decodedText: string) => {
    const imeis = extractAllImeis(decodedText);

    // If both IMEIs are detected in a single QR/DataMatrix code
    if (imeis.length >= 2) {
      if (targetField === 'imei1') {
        finishWithImei(imeis[0]);
        return;
      }
      if (targetField === 'imei2') {
        finishWithImei(imeis[1] || imeis[0]);
        return;
      }

      // If no specific field targeted, allow user to pick or fill both
      setDetectedMultipleImeis(imeis);
      playScanSound();
      stopScanner();
      return;
    }

    if (imeis.length === 1) {
      finishWithImei(imeis[0]);
      return;
    }

    // Fallback
    const fallback = extractImeiFromBarcode(decodedText);
    if (fallback && fallback.length >= 8) {
      finishWithImei(fallback);
    }
  }, [targetField, finishWithImei, stopScanner]);

  // Apply optical/sensor hardware zoom
  const applyZoom = useCallback(async (level: number) => {
    setZoomLevel(level);
    if (!scannerRef.current || !isStartedRef.current) return;
    try {
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ zoom: level } as any]
      });
    } catch (e) {
      console.debug('Hardware zoom unavailable:', e);
    }
  }, []);

  // Toggle camera flashlight
  const toggleTorch = useCallback(async () => {
    const nextTorch = !torchOn;
    setTorchOn(nextTorch);
    if (!scannerRef.current || !isStartedRef.current) return;
    try {
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch } as any]
      });
    } catch (e) {
      console.debug('Failed to toggle torch:', e);
    }
  }, [torchOn]);

  useEffect(() => {
    if (!isOpen) {
      setCameraError(null);
      setScanSuccessAnim(false);
      setTorchOn(false);
      setZoomLevel(1);
      setDetectedMultipleImeis(null);
      return;
    }

    let isMounted = true;

    const startScanner = async () => {
      try {
        const formatsToSupport = [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.AZTEC,
        ];

        const scanner = new Html5Qrcode(containerId, {
          formatsToSupport,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true, // Native accelerated detection
          },
          verbose: false,
        });

        scannerRef.current = scanner;

        // Html5Qrcode strictly requires cameraIdOrConfig to have exactly 1 key
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 26,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              if (scanMode === 'barcode') {
                // Slim 56px laser slit: strictly isolates single 1D barcode even if two barcodes are 3mm apart!
                const width = Math.min(Math.floor(viewfinderWidth * 0.92), 440);
                return { width: Math.max(width, 260), height: 56 };
              } else {
                // Micro square target for tiny 2D QR / Data Matrix
                const side = Math.min(Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.62), 190);
                return { width: Math.max(side, 150), height: Math.max(side, 150) };
              }
            },
            aspectRatio: 1.777778,
            disableFlip: false,
          },
          (decodedText) => {
            if (isMounted) {
              handleSuccessfulScan(decodedText);
            }
          },
          () => {} // Frame miss
        );

        isStartedRef.current = true;

        // Apply high resolution & continuous autofocus constraints once stream is active
        try {
          await scanner.applyVideoConstraints({
            width: { min: 1280, ideal: 1920 },
            height: { min: 720, ideal: 1080 },
            // @ts-ignore
            focusMode: 'continuous',
          });
        } catch (e) {
          console.debug('Additional video constraints notice:', e);
        }

        // Check track capabilities for hardware zoom and torch
        try {
          const trackCaps = scanner.getRunningTrackCapabilities();
          if (trackCaps) {
            if ('zoom' in trackCaps) {
              setHasHardwareZoom(true);
            }
            if ('torch' in trackCaps) {
              setHasTorch(true);
            }
          }
        } catch (e) {
          console.debug('Capabilities inspection:', e);
        }

      } catch (err: any) {
        console.error('Scanner init error:', err);
        if (isMounted) {
          setCameraError(err.message || 'Unable to access camera. Please allow camera permissions.');
        }
      }
    };

    const timer = setTimeout(startScanner, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen, scanMode, handleSuccessfulScan, stopScanner]);

  // Handle high-resolution still photo capture for extreme micro-codes
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setCameraError(null);

    try {
      let decoder = scannerRef.current;
      if (!decoder) {
        decoder = new Html5Qrcode(containerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.DATA_MATRIX,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
          verbose: false,
        });
      }

      const result = await decoder.scanFileV2(file, false);
      if (result && result.decodedText) {
        handleSuccessfulScan(result.decodedText);
      } else {
        setCameraError('No barcode detected in photo. Please ensure barcode is well-lit and sharp.');
      }
    } catch {
      setCameraError('Could not decode barcode from photo. Aim camera directly at the code.');
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const modalTitle = title || (targetField === 'imei2' ? 'Scan IMEI 2' : 'Scan IMEI 1');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} size="md">
      <div className="space-y-3">
        {/* Sleek Mode Switcher */}
        <div className="flex items-center justify-between bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setScanMode('barcode')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              scanMode === 'barcode'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Scan className="w-3.5 h-3.5 text-[#522D60]" />
            <span>Barcode (Aim Line)</span>
          </button>

          <button
            type="button"
            onClick={() => setScanMode('qr')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              scanMode === 'qr'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <QrCode className="w-3.5 h-3.5 text-[#522D60]" />
            <span>Tiny QR Code</span>
          </button>
        </div>

        {/* Viewport Viewfinder */}
        <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner flex flex-col items-center justify-center min-h-[290px] sm:min-h-[340px]">
          {/* Video element target */}
          <div 
            id={containerId} 
            className="w-full h-full flex items-center justify-center [&>video]:object-cover [&>video]:w-full [&>video]:h-full"
            style={{
              transform: !hasHardwareZoom && zoomLevel > 1 ? `scale(${zoomLevel})` : 'none',
              transformOrigin: 'center center',
              transition: 'transform 0.15s ease-out'
            }}
          />

          {/* High-Precision Targeting Overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-4">
            {scanMode === 'barcode' ? (
              /* Precision Barcode Laser Slit - Designed specifically to separate close barcodes */
              <div className="relative w-full max-w-[340px] h-[64px] border-y border-amber-400/80 bg-amber-400/[0.04] flex items-center justify-center">
                {/* Sharp Center Neon Laser Line */}
                <div className="absolute left-0 right-0 h-0.5 bg-red-500 shadow-[0_0_10px_#ef4444] animate-pulse" />
                
                {/* Corner markers */}
                <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-amber-400" />
                <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-amber-400" />
                <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-amber-400" />
                <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-amber-400" />
                
                {/* Minimal label */}
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-semibold tracking-wider uppercase text-amber-300 drop-shadow-md">
                  Aim Red Line at Barcode
                </span>
              </div>
            ) : (
              /* Precision Micro-QR Reticle */
              <div className="relative w-44 h-44 border border-white/30 rounded-xl flex items-center justify-center">
                {/* 4 Corner Crosshairs */}
                <div className="absolute -top-1 -left-1 w-5 h-5 border-t-3 border-l-3 border-amber-400 rounded-tl-sm" />
                <div className="absolute -top-1 -right-1 w-5 h-5 border-t-3 border-r-3 border-amber-400 rounded-tr-sm" />
                <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-3 border-l-3 border-amber-400 rounded-bl-sm" />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-3 border-r-3 border-amber-400 rounded-br-sm" />

                {/* Center crosshair dot */}
                <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />

                <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-semibold tracking-wider uppercase text-amber-300 drop-shadow-md">
                  Align Micro QR in Box
                </span>
              </div>
            )}
          </div>

          {/* Floating Controls: Flashlight & Quick 2x Zoom */}
          <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
            <button
              type="button"
              onClick={() => applyZoom(zoomLevel > 1.5 ? 1 : 2)}
              className="px-2.5 py-1 rounded-full text-xs font-bold backdrop-blur-md bg-black/60 text-white/95 border border-white/20 hover:bg-black/80 transition-all cursor-pointer shadow-md"
              title="Toggle Zoom"
            >
              {zoomLevel > 1.5 ? '2x' : '1x'}
            </button>

            {hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`p-2 rounded-full backdrop-blur-md transition-all shadow-md cursor-pointer ${
                  torchOn 
                    ? 'bg-amber-400 text-slate-950' 
                    : 'bg-black/60 text-white border border-white/20 hover:bg-black/80'
                }`}
                title="Toggle Flashlight"
              >
                {torchOn ? <Zap className="w-4 h-4 fill-current" /> : <ZapOff className="w-4 h-4" />}
              </button>
            )}
          </div>

          {/* Success Flash */}
          {scanSuccessAnim && (
            <div className="absolute inset-0 bg-emerald-500/30 backdrop-blur-xs flex items-center justify-center z-30 transition-opacity duration-200">
              <div className="p-3 bg-emerald-600 text-white rounded-full shadow-2xl animate-bounce">
                <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
              </div>
            </div>
          )}

          {/* Multiple IMEIs Detected Selector Sheet */}
          {detectedMultipleImeis && detectedMultipleImeis.length >= 2 && (
            <div className="absolute inset-x-3 bottom-3 bg-slate-900/95 backdrop-blur-md border border-white/20 p-3.5 rounded-2xl text-white z-40 shadow-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  2 IMEIs Found on Box
                </span>
                <span className="text-[10px] text-slate-400">Select which to use</span>
              </div>

              <div className="flex flex-col gap-1.5">
                {onScanBoth && (
                  <button
                    type="button"
                    onClick={() => {
                      playScanSound();
                      onScanBoth(detectedMultipleImeis[0], detectedMultipleImeis[1]);
                      onClose();
                    }}
                    className="w-full py-2 px-3 bg-[#522D60] hover:bg-[#68397a] text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center cursor-pointer"
                  >
                    Fill Both (IMEI 1 & IMEI 2)
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => finishWithImei(detectedMultipleImeis[0])}
                  className="w-full py-2 px-3 bg-white/10 hover:bg-white/20 text-white font-mono text-xs rounded-xl transition-all flex items-center justify-between cursor-pointer"
                >
                  <span className="font-sans text-[11px] text-slate-300">Use for IMEI 1:</span>
                  <span className="font-bold text-emerald-400">{detectedMultipleImeis[0]}</span>
                </button>
                <button
                  type="button"
                  onClick={() => finishWithImei(detectedMultipleImeis[1])}
                  className="w-full py-2 px-3 bg-white/10 hover:bg-white/20 text-white font-mono text-xs rounded-xl transition-all flex items-center justify-between cursor-pointer"
                >
                  <span className="font-sans text-[11px] text-slate-300">Use for IMEI 2:</span>
                  <span className="font-bold text-emerald-400">{detectedMultipleImeis[1]}</span>
                </button>
              </div>
            </div>
          )}

          {/* Camera Error Message */}
          {cameraError && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
              <AlertCircle className="w-9 h-9 text-amber-400 mb-2" />
              <p className="text-xs text-slate-200 font-medium mb-3 max-w-xs">{cameraError}</p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setCameraError(null);
                  fileInputRef.current?.click();
                }}
              >
                <Camera className="w-4 h-4 mr-1.5" />
                Upload Photo Instead
              </Button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-2 pt-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoUpload}
          />

          <Button
            type="button"
            variant="secondary"
            className="flex-1 text-xs border-slate-300 font-semibold text-slate-700 cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessingFile}
          >
            <Camera className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
            {isProcessingFile ? 'Reading Photo...' : 'Upload Box Photo'}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="text-xs text-slate-600 hover:bg-slate-100 cursor-pointer"
            onClick={() => {
              stopScanner();
              onClose();
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default BarcodeScanner;

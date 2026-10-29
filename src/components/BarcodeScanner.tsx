import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { 
  Zap, 
  ZapOff, 
  ZoomIn, 
  Camera, 
  Upload, 
  Scan, 
  Sparkles, 
  AlertCircle,
  CheckCircle2,
  Maximize2
} from 'lucide-react';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (imei: string) => void;
  title?: string;
}

// POS audio beep synthesizer (Web Audio API)
function playScanChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.08);
    
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch (e) {
    // Audio context may require prior interaction
  }
}

// Clean and extract valid 14-16 digit IMEI or serial from raw barcode text
export function extractImeiFromBarcode(rawText: string): string {
  if (!rawText) return '';
  const clean = rawText.trim();

  // Pattern 1: Explicit labels like "IMEI1: 357450680394216", "IMEI:357450...", "IMEI-1=..."
  const labelMatch = clean.match(/IMEI(?:1|2)?\s*[:=\-\s]\s*(\d{14,16})/i);
  if (labelMatch && labelMatch[1]) {
    return labelMatch[1].slice(0, 15);
  }

  // Pattern 2: Multi-line QR on box with IMEI lines
  const lines = clean.split(/[\r\n;,]+/);
  for (const line of lines) {
    const trimmed = line.trim();
    const lineImei = trimmed.match(/(\d{14,16})/);
    if (lineImei && lineImei[1]) {
      return lineImei[1].slice(0, 15);
    }
  }

  // Pattern 3: Standalone 14 to 16 digit sequence
  const sequenceMatch = clean.match(/\b(\d{14,16})\b/);
  if (sequenceMatch && sequenceMatch[1]) {
    return sequenceMatch[1].slice(0, 15);
  }

  // Pattern 4: Strip all non-digits
  const digitsOnly = clean.replace(/\D/g, '');
  if (digitsOnly.length >= 14) {
    return digitsOnly.slice(0, 15);
  }

  // Pattern 5: Alphanumeric serial or short barcode (at least 8 chars)
  if (clean.length >= 8 && clean.length <= 20) {
    return clean;
  }

  return digitsOnly || clean;
}

export function BarcodeScanner({ 
  isOpen, 
  onClose, 
  onScan, 
  title = "Scan Mobile Box IMEI / Barcode" 
}: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStartedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const containerId = 'box-barcode-scanner-viewport';

  // Camera capabilities & hardware control state
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [maxZoom, setMaxZoom] = useState<number>(4);
  const [hasHardwareZoom, setHasHardwareZoom] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  const [scanSuccessAnim, setScanSuccessAnim] = useState<boolean>(false);

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

  const handleSuccessfulScan = useCallback((decodedText: string) => {
    const imei = extractImeiFromBarcode(decodedText);
    if (imei && imei.length >= 8) {
      setScanSuccessAnim(true);
      playScanChime();
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([70, 40, 70]);
      }
      stopScanner();
      setTimeout(() => {
        onScan(imei);
        onClose();
      }, 300);
    }
  }, [onScan, onClose, stopScanner]);

  // Apply optical or digital zoom to camera track
  const applyZoom = useCallback(async (level: number) => {
    setZoomLevel(level);
    if (!scannerRef.current || !isStartedRef.current) return;

    try {
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ zoom: level } as any]
      });
    } catch (e) {
      console.debug('Failed to apply hardware zoom:', e);
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
      return;
    }

    let isMounted = true;

    const startScanner = async () => {
      try {
        // Formats most commonly used on smartphone boxes (Samsung, Infinix, Tecno, Apple, Xiaomi, Realme)
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
        ];

        const scanner = new Html5Qrcode(containerId, {
          formatsToSupport,
          experimentalFeatures: {
            // Native BarcodeDetector is 10x-50x faster and reads tiny 0.2mm barcodes easily
            useBarCodeDetectorIfSupported: true,
          },
          verbose: false,
        });

        scannerRef.current = scanner;

        // Camera constraints optimized for small box barcodes:
        // Request 1080p / high resolution so tiny barcode stripes don't blur into pixels
        const cameraConstraints: MediaTrackConstraints = {
          facingMode: { ideal: 'environment' },
          width: { min: 1280, ideal: 1920 },
          height: { min: 720, ideal: 1080 },
          // @ts-ignore - non-standard continuous autofocus constraint supported by modern mobile browsers
          focusMode: 'continuous',
        };

        await scanner.start(
          cameraConstraints,
          {
            fps: 24, // High framerate for instant detection
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              // Wide rectangular scanning window matched to horizontal 1D barcodes on mobile boxes
              const width = Math.min(Math.floor(viewfinderWidth * 0.94), 480);
              const height = Math.min(Math.floor(viewfinderHeight * 0.6), 220);
              return { width: Math.max(width, 280), height: Math.max(height, 140) };
            },
            aspectRatio: 1.777778, // 16:9 widescreen
            disableFlip: false,
          },
          (decodedText) => {
            if (isMounted) {
              handleSuccessfulScan(decodedText);
            }
          },
          () => {} // Frame decode miss - continue silently
        );

        isStartedRef.current = true;

        // Inspect track capabilities for hardware Zoom and Torch (Flashlight)
        try {
          const trackCaps = scanner.getRunningTrackCapabilities();
          if (trackCaps) {
            if ('zoom' in trackCaps) {
              const zoomCap = (trackCaps as any).zoom;
              setMaxZoom(Math.min(zoomCap.max || 4, 6));
              setHasHardwareZoom(true);
            }
            if ('torch' in trackCaps) {
              setHasTorch(true);
            }
          }
        } catch (e) {
          console.debug('Track capabilities not available:', e);
        }

      } catch (err: any) {
        console.error('Scanner init error:', err);
        if (isMounted) {
          setCameraError(err.message || 'Unable to access camera. Please allow camera permissions.');
        }
      }
    };

    const timer = setTimeout(startScanner, 120);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen, handleSuccessfulScan, stopScanner]);

  // Handle high-resolution still photo snapshot/upload for micro-barcodes
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setCameraError(null);

    try {
      // Create a temporary decoder instance if the live scanner is busy
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

      // scanFileV2 processes the full-resolution uncompressed photo from phone camera
      const result = await decoder.scanFileV2(file, false);
      if (result && result.decodedText) {
        handleSuccessfulScan(result.decodedText);
      } else {
        setCameraError('No clear barcode detected in photo. Please ensure barcode is well-lit and in focus.');
      }
    } catch (err: any) {
      setCameraError('Could not decode barcode from image. Hold camera steady or try 2x / 3x Zoom.');
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      <div className="space-y-4">
        {/* Scanner Viewport with Laser & Targeting Grid */}
        <div className="relative rounded-2xl overflow-hidden bg-slate-950 border-2 border-slate-800 shadow-inner flex flex-col items-center justify-center min-h-[300px] sm:min-h-[360px]">
          
          {/* HTML5-Qrcode mounting target */}
          <div 
            id={containerId} 
            className="w-full h-full flex items-center justify-center [&>video]:object-cover [&>video]:w-full [&>video]:h-full"
            style={{
              // Fallback digital magnification if hardware zoom constraint is unavailable
              transform: !hasHardwareZoom && zoomLevel > 1 ? `scale(${zoomLevel})` : 'none',
              transformOrigin: 'center center',
              transition: 'transform 0.2s ease-out'
            }}
          />

          {/* Precision Crosshair / Box Alignment Overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
            <div className="relative w-full max-w-[340px] h-36 sm:h-44 border border-white/20 rounded-xl flex items-center justify-center">
              
              {/* Animated Red Laser Scan Line */}
              <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_12px_#ef4444] animate-[pulse_1.5s_ease-in-out_infinite]" />

              {/* 4 High-Precision Corner Brackets */}
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-3 border-l-3 border-amber-400 rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-3 border-r-3 border-amber-400 rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-3 border-l-3 border-amber-400 rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-3 border-r-3 border-amber-400 rounded-br-lg" />

              {/* Target Guidance Badge */}
              <div className="absolute -bottom-9 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/75 backdrop-blur-md rounded-full border border-white/10 text-[11px] font-medium text-white/90 whitespace-nowrap shadow-lg flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-amber-400" />
                Align box barcode inside frame
              </div>
            </div>
          </div>

          {/* Flashlight (Torch) Floating Toggle */}
          {hasTorch && (
            <button
              type="button"
              onClick={toggleTorch}
              className={`absolute top-3 right-3 z-20 p-2.5 rounded-full backdrop-blur-md transition-all shadow-lg ${
                torchOn 
                  ? 'bg-amber-400 text-slate-950 shadow-amber-400/50' 
                  : 'bg-black/60 text-white/90 border border-white/20 hover:bg-black/80'
              }`}
              title={torchOn ? 'Turn Off Flashlight' : 'Turn On Flashlight for Clear Barcode'}
            >
              {torchOn ? <Zap className="w-5 h-5 fill-current" /> : <ZapOff className="w-5 h-5" />}
            </button>
          )}

          {/* Success Flash Overlay */}
          {scanSuccessAnim && (
            <div className="absolute inset-0 bg-emerald-500/30 backdrop-blur-xs flex items-center justify-center z-30 transition-opacity duration-200">
              <div className="p-3 bg-emerald-600 text-white rounded-full shadow-2xl animate-bounce">
                <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
              </div>
            </div>
          )}

          {/* Error / Permission Guidance Overlay */}
          {cameraError && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
              <AlertCircle className="w-10 h-10 text-amber-400 mb-2" />
              <p className="text-sm text-slate-200 font-medium mb-4 max-w-xs">{cameraError}</p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setCameraError(null);
                  if (fileInputRef.current) fileInputRef.current.click();
                }}
              >
                <Camera className="w-4 h-4 mr-1.5" />
                Take Photo Instead
              </Button>
            </div>
          )}
        </div>

        {/* Micro-Barcode Zoom Enhancer Bar */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
              <ZoomIn className="w-3.5 h-3.5 text-[#522D60]" />
              Box Barcode Zoom (For Small Barcodes)
            </span>
            <span className="text-xs font-mono font-bold text-[#522D60] bg-purple-100 px-2 py-0.5 rounded-md">
              {zoomLevel.toFixed(1)}x
            </span>
          </div>

          {/* Quick Zoom Buttons (1x, 2x, 2.5x, 3x) */}
          <div className="grid grid-cols-4 gap-2">
            {[1, 1.8, 2.5, 3.2].map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => applyZoom(lvl)}
                className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                  Math.abs(zoomLevel - lvl) < 0.2
                    ? 'bg-[#522D60] text-white border-[#522D60] shadow-xs scale-102'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                {lvl === 1 ? '1x Standard' : `${lvl}x Zoom`}
              </button>
            ))}
          </div>

          <p className="text-[11px] text-slate-500 leading-tight">
            💡 <strong>Tip for small barcodes:</strong> Hold camera 15cm away (so it stays in focus) and tap <strong>2x</strong> or <strong>2.5x Zoom</strong>.
          </p>
        </div>

        {/* Alternative Actions: High-Res Photo Snap & Manual Input */}
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          {/* Hidden File Input for high-res macro camera capture */}
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
            className="flex-1 border-slate-300 font-semibold text-slate-700"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessingFile}
          >
            <Camera className="w-4 h-4 mr-1.5 text-amber-600" />
            {isProcessingFile ? 'Reading Photo...' : 'Snap Clear Photo of Box'}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="text-slate-600 hover:bg-slate-100"
            onClick={() => {
              stopScanner();
              onClose();
            }}
          >
            Cancel — Type Manually
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default BarcodeScanner;

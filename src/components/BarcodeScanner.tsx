import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { 
  Zap, 
  ZapOff, 
  Camera, 
  CheckCircle2, 
  AlertCircle,
  Upload,
  RefreshCw,
  ScanLine
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

// Extract all valid 14-16 digit IMEIs found in the scanned text
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

  // 1. Explicit IMEI 1 & IMEI 2 labels
  const imei1Match = text.match(/IMEI\s*1\D*(\d{14,16})/i);
  const imei2Match = text.match(/IMEI\s*2\D*(\d{14,16})/i);
  if (imei1Match && imei1Match[1]) addIfValid(imei1Match[1]);
  if (imei2Match && imei2Match[1]) addIfValid(imei2Match[1]);

  // 2. All 14-16 digit numbers in the text
  const digitSequences = text.match(/\b\d{14,16}\b/g);
  if (digitSequences) {
    digitSequences.forEach(seq => addIfValid(seq));
  }

  // 3. Delimited tokens
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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const html5DecoderRef = useRef<Html5Qrcode | null>(null);

  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanStatusMessage, setScanStatusMessage] = useState<string | null>(null);
  const [scanSuccessAnim, setScanSuccessAnim] = useState<boolean>(false);
  const [detectedMultipleImeis, setDetectedMultipleImeis] = useState<string[] | null>(null);

  // Stop camera media stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    setCameraActive(false);
    setTorchOn(false);
  }, []);

  const finishWithImei = useCallback((imei: string) => {
    setScanSuccessAnim(true);
    playScanSound();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([60, 30, 60]);
    }
    stopCamera();
    setTimeout(() => {
      onScan(imei);
      onClose();
    }, 250);
  }, [onScan, onClose, stopCamera]);

  // Start live camera stream
  const startCamera = useCallback(async () => {
    setCameraError(null);
    setScanStatusMessage(null);
    setDetectedMultipleImeis(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access not supported on this device/browser');
      }

      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }

      // Request maximum sharpness (1080p environment camera)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          // @ts-ignore
          focusMode: 'continuous'
        },
        audio: false
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
      }

      // Check for torch capability
      const track = stream.getVideoTracks()[0];
      if (track && track.getCapabilities) {
        const caps = track.getCapabilities() as any;
        if (caps && caps.torch) {
          setHasTorch(true);
        }
      }

    } catch (err: any) {
      console.error('Camera start error:', err);
      setCameraError(err.message || 'Unable to start camera. Please ensure camera permissions are allowed.');
    }
  }, []);

  // Toggle camera flashlight
  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextTorch = !torchOn;
      await track.applyConstraints({
        advanced: [{ torch: nextTorch } as any]
      });
      setTorchOn(nextTorch);
    } catch (e) {
      console.debug('Failed to toggle torch:', e);
    }
  }, [torchOn]);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      setDetectedMultipleImeis(null);
      setScanSuccessAnim(false);
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // Helper: Try decoding a Canvas or ImageBitmap using native BarcodeDetector API
  const decodeWithNativeBarcodeDetector = async (source: HTMLCanvasElement | ImageBitmap): Promise<Array<{ text: string; y: number }>> => {
    if (typeof window === 'undefined' || !('BarcodeDetector' in window)) {
      return [];
    }

    try {
      const detector = new (window as any).BarcodeDetector({
        formats: [
          'code_128',
          'code_39',
          'ean_13',
          'qr_code',
          'data_matrix',
          'upc_a',
          'upc_e',
          'itf',
          'aztec'
        ]
      });

      const barcodes = await detector.detect(source);
      if (!barcodes || barcodes.length === 0) return [];

      // Map detected barcodes with their vertical Y position
      return barcodes.map((b: any) => ({
        text: (b.rawValue || '').trim(),
        y: b.boundingBox ? (b.boundingBox.y ?? b.boundingBox.top ?? 0) : 0
      })).filter((item: any) => Boolean(item.text));
    } catch (e) {
      console.debug('Native BarcodeDetector pass failed:', e);
      return [];
    }
  };

  // Helper: Try decoding with Html5Qrcode engine
  const decodeWithHtml5Qrcode = async (canvas: HTMLCanvasElement): Promise<string | null> => {
    return new Promise((resolve) => {
      canvas.toBlob(async (blob) => {
        if (!blob) return resolve(null);
        try {
          const file = new File([blob], 'snapshot.jpg', { type: 'image/jpeg' });
          let decoder = html5DecoderRef.current;
          if (!decoder) {
            decoder = new Html5Qrcode('barcode-scanner-hidden-engine', {
              formatsToSupport: [
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODE_39,
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.DATA_MATRIX,
                Html5QrcodeSupportedFormats.QR_CODE,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E,
                Html5QrcodeSupportedFormats.ITF,
                Html5QrcodeSupportedFormats.CODE_93,
              ],
              experimentalFeatures: { useBarCodeDetectorIfSupported: true },
              verbose: false
            });
            html5DecoderRef.current = decoder;
          }

          const res = await decoder.scanFileV2(file, false);
          if (res && res.decodedText) {
            resolve(res.decodedText.trim());
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      }, 'image/jpeg', 0.95);
    });
  };

  // Main capture action triggered by clicking the camera button
  const handleCaptureAndFetch = async () => {
    if (!videoRef.current || isScanning) return;

    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setScanStatusMessage('Camera is initializing. Please hold steady...');
      return;
    }

    setIsScanning(true);
    setScanStatusMessage(null);

    try {
      // 1. Create full-resolution snapshot canvas
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Could not access canvas context');

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // --- Pass 1: Native BarcodeDetector on full frame ---
      // (This can detect both IMEI 1 & IMEI 2 simultaneously and distinguishes top vs bottom barcode)
      const nativeDetections = await decodeWithNativeBarcodeDetector(canvas);

      if (nativeDetections.length > 0) {
        // Sort detected barcodes by Y coordinate (top barcode is IMEI 1, bottom is IMEI 2)
        nativeDetections.sort((a, b) => a.y - b.y);
        
        // Extract IMEIs from detected barcodes
        const foundImeis: string[] = [];
        nativeDetections.forEach(det => {
          const extracted = extractImeiFromBarcode(det.text);
          if (extracted && extracted.length >= 8 && !foundImeis.includes(extracted)) {
            foundImeis.push(extracted);
          }
        });

        if (foundImeis.length >= 2) {
          // If two barcodes were detected on the box (top & bottom):
          if (targetField === 'imei1') {
            finishWithImei(foundImeis[0]); // Top barcode is IMEI 1
            return;
          }
          if (targetField === 'imei2') {
            finishWithImei(foundImeis[1]); // Bottom barcode is IMEI 2
            return;
          }

          setDetectedMultipleImeis(foundImeis);
          playScanSound();
          return;
        }

        if (foundImeis.length === 1) {
          finishWithImei(foundImeis[0]);
          return;
        }
      }

      // --- Pass 2: High-contrast center crop (laser reticle area) ---
      // Cropping isolates the targeted barcode so adjacent barcodes cannot interfere
      const cropW = Math.floor(canvas.width * 0.85);
      const cropH = Math.floor(canvas.height * 0.35); // Narrow vertical window
      const cropX = Math.floor((canvas.width - cropW) / 2);
      const cropY = Math.floor((canvas.height - cropH) / 2);

      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = cropW;
      croppedCanvas.height = cropH;
      const cropCtx = croppedCanvas.getContext('2d');
      if (cropCtx) {
        cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        
        // Try native detector on cropped center
        const croppedNative = await decodeWithNativeBarcodeDetector(croppedCanvas);
        if (croppedNative.length > 0) {
          const imei = extractImeiFromBarcode(croppedNative[0].text);
          if (imei && imei.length >= 8) {
            finishWithImei(imei);
            return;
          }
        }

        // Try Html5Qrcode on cropped center
        const croppedResult = await decodeWithHtml5Qrcode(croppedCanvas);
        if (croppedResult) {
          const multi = extractAllImeis(croppedResult);
          if (multi.length >= 2) {
            if (targetField === 'imei1') {
              finishWithImei(multi[0]);
              return;
            }
            if (targetField === 'imei2') {
              finishWithImei(multi[1]);
              return;
            }
            setDetectedMultipleImeis(multi);
            playScanSound();
            return;
          }
          const imei = extractImeiFromBarcode(croppedResult);
          if (imei && imei.length >= 8) {
            finishWithImei(imei);
            return;
          }
        }
      }

      // --- Pass 3: Html5Qrcode on full frame ---
      const fullResult = await decodeWithHtml5Qrcode(canvas);
      if (fullResult) {
        const multi = extractAllImeis(fullResult);
        if (multi.length >= 2) {
          if (targetField === 'imei1') {
            finishWithImei(multi[0]);
            return;
          }
          if (targetField === 'imei2') {
            finishWithImei(multi[1]);
            return;
          }
          setDetectedMultipleImeis(multi);
          playScanSound();
          return;
        }
        const imei = extractImeiFromBarcode(fullResult);
        if (imei && imei.length >= 8) {
          finishWithImei(imei);
          return;
        }
      }

      // If nothing detected
      setScanStatusMessage('No clear barcode or QR detected. Hold camera steady directly over the barcode and tap again.');

    } catch (err: any) {
      console.error('Scan error:', err);
      setScanStatusMessage('Scanning error. Please ensure barcode is well-lit and tap again.');
    } finally {
      setIsScanning(false);
    }
  };

  // Handle image upload from file or gallery
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScanStatusMessage(null);

    try {
      let decoder = html5DecoderRef.current;
      if (!decoder) {
        decoder = new Html5Qrcode('barcode-scanner-hidden-engine', {
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
        html5DecoderRef.current = decoder;
      }

      const result = await decoder.scanFileV2(file, false);
      if (result && result.decodedText) {
        const multi = extractAllImeis(result.decodedText);
        if (multi.length >= 2) {
          if (targetField === 'imei1') {
            finishWithImei(multi[0]);
            return;
          }
          if (targetField === 'imei2') {
            finishWithImei(multi[1]);
            return;
          }
          setDetectedMultipleImeis(multi);
          playScanSound();
          return;
        }

        const imei = extractImeiFromBarcode(result.decodedText);
        if (imei && imei.length >= 8) {
          finishWithImei(imei);
          return;
        }
      }
      setScanStatusMessage('No barcode detected in the uploaded photo. Ensure the image is clear and sharp.');
    } catch {
      setScanStatusMessage('Could not decode barcode from image. Please try again.');
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const modalTitle = title || (targetField === 'imei2' ? 'Scan IMEI 2' : 'Scan IMEI 1');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} size="md">
      <div className="space-y-3.5">
        
        {/* Hidden element required for Html5Qrcode engine */}
        <div id="barcode-scanner-hidden-engine" className="hidden" />

        {/* Viewfinder Area */}
        <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner flex flex-col items-center justify-center min-h-[300px] sm:min-h-[360px]">
          
          {/* Live Video Element */}
          <video
            ref={videoRef}
            playsInline
            autoPlay
            muted
            className="w-full h-full object-cover min-h-[300px] sm:min-h-[360px]"
          />

          {/* Aiming Reticle (Aim-and-Shoot Guide) */}
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
            <div className="relative w-full max-w-[320px] h-[90px] sm:h-[100px] border-2 border-amber-400/90 rounded-xl bg-black/20 backdrop-blur-[0.5px] flex items-center justify-center shadow-[0_0_20px_rgba(251,191,36,0.2)]">
              {/* Center neon laser line */}
              <div className="absolute left-2 right-2 h-0.5 bg-red-500 shadow-[0_0_12px_#ef4444]" />
              
              {/* Corner brackets */}
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-3 border-l-3 border-amber-400 rounded-tl-sm" />
              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-3 border-r-3 border-amber-400 rounded-tr-sm" />
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-3 border-l-3 border-amber-400 rounded-bl-sm" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-3 border-r-3 border-amber-400 rounded-br-sm" />

              <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[11px] font-bold tracking-wide text-white drop-shadow-md whitespace-nowrap bg-black/60 px-2.5 py-0.5 rounded-full border border-white/10">
                Point red line at barcode, then tap button
              </span>
            </div>
          </div>

          {/* Flashlight Toggle */}
          {hasTorch && (
            <button
              type="button"
              onClick={toggleTorch}
              className={`absolute top-3 right-3 z-20 p-2.5 rounded-full backdrop-blur-md transition-all shadow-md cursor-pointer ${
                torchOn 
                  ? 'bg-amber-400 text-slate-950 shadow-amber-400/50' 
                  : 'bg-black/60 text-white border border-white/20 hover:bg-black/80'
              }`}
              title="Toggle Flashlight"
            >
              {torchOn ? <Zap className="w-4 h-4 fill-current" /> : <ZapOff className="w-4 h-4" />}
            </button>
          )}

          {/* Scanning In-Progress Shutter Overlay */}
          {isScanning && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center z-30 space-y-2">
              <RefreshCw className="w-8 h-8 text-white animate-spin" />
              <p className="text-xs font-bold text-white tracking-wide">Fetching IMEI...</p>
            </div>
          )}

          {/* Success Flash Animation */}
          {scanSuccessAnim && (
            <div className="absolute inset-0 bg-emerald-500/40 backdrop-blur-xs flex items-center justify-center z-30 transition-opacity duration-200">
              <div className="p-3 bg-emerald-600 text-white rounded-full shadow-2xl animate-bounce">
                <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
              </div>
            </div>
          )}

          {/* Dual IMEI Choice Overlay */}
          {detectedMultipleImeis && detectedMultipleImeis.length >= 2 && (
            <div className="absolute inset-x-3 bottom-3 bg-slate-900/95 backdrop-blur-md border border-white/20 p-3.5 rounded-2xl text-white z-40 shadow-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  2 IMEIs Found on Box
                </span>
                <span className="text-[10px] text-slate-400">Tap to select</span>
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
                  <span className="font-sans text-[11px] text-slate-300">IMEI 1 (Top):</span>
                  <span className="font-bold text-emerald-400">{detectedMultipleImeis[0]}</span>
                </button>
                <button
                  type="button"
                  onClick={() => finishWithImei(detectedMultipleImeis[1])}
                  className="w-full py-2 px-3 bg-white/10 hover:bg-white/20 text-white font-mono text-xs rounded-xl transition-all flex items-center justify-between cursor-pointer"
                >
                  <span className="font-sans text-[11px] text-slate-300">IMEI 2 (Bottom):</span>
                  <span className="font-bold text-emerald-400">{detectedMultipleImeis[1]}</span>
                </button>
              </div>
            </div>
          )}

          {/* Camera Error Message */}
          {cameraError && (
            <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
              <AlertCircle className="w-10 h-10 text-amber-400 mb-2" />
              <p className="text-xs text-slate-200 font-medium mb-3 max-w-xs">{cameraError}</p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-1.5" />
                Upload Box Photo Instead
              </Button>
            </div>
          )}
        </div>

        {/* Scan Status Toast if frame did not catch code */}
        {scanStatusMessage && (
          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2 animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="flex-1">{scanStatusMessage}</p>
          </div>
        )}

        {/* ── MAIN SHUTTER BUTTON (TAP TO FETCH IMEI) ── */}
        <div className="flex flex-col items-center justify-center pt-1 pb-1">
          <button
            type="button"
            onClick={handleCaptureAndFetch}
            disabled={isScanning || !cameraActive}
            className="group relative flex items-center justify-center gap-2.5 px-6 py-3 rounded-2xl bg-[#522D60] hover:bg-[#432350] text-white font-bold text-sm shadow-lg shadow-[#522D60]/25 transition-all active:scale-95 disabled:opacity-50 cursor-pointer w-full sm:w-auto min-w-[220px]"
          >
            <div className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center group-hover:scale-110 transition-transform">
              <div className="w-2.5 h-2.5 rounded-full bg-white" />
            </div>
            <span>{isScanning ? 'Fetching IMEI...' : 'Capture & Fetch IMEI'}</span>
          </button>
          <p className="text-[11px] text-slate-400 mt-1.5">
            Hold camera steady over barcode and tap button to scan
          </p>
        </div>

        {/* Secondary Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoUpload}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs font-semibold text-slate-600 hover:text-[#522D60] flex items-center gap-1.5 transition-colors cursor-pointer py-1"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Box Photo</span>
          </button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-slate-500 hover:text-slate-800"
            onClick={() => {
              stopCamera();
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

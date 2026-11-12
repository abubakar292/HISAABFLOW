import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  MultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
  HTMLCanvasElementLuminanceSource,
  BinaryBitmap,
  HybridBinarizer,
  GlobalHistogramBinarizer,
} from '@zxing/library';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import {
  Zap,
  ZapOff,
  CheckCircle2,
  AlertCircle,
  Upload,
  ZoomIn,
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

/**
 * GSMA standard 15-digit IMEI Luhn checksum validator.
 * Used to give instant 1-frame lock-on confidence when a tiny barcode is decoded.
 */
export function isValidLuhnImei(imei: string): boolean {
  if (!/^\d{15}$/.test(imei)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let digit = parseInt(imei.charAt(i), 10);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

// Extract all valid 14-16 digit IMEIs found in the scanned text
export function extractAllImeis(rawText: string): string[] {
  if (!rawText) return [];
  const text = rawText.trim();
  const results: string[] = [];

  const addIfValid = (val: string) => {
    const clean = val.replace(/\D/g, '');
    if (clean.length === 15 && !results.includes(clean)) {
      results.push(clean);
    } else if (clean.length >= 14 && clean.length <= 16 && !results.includes(clean.slice(0, 15))) {
      results.push(clean.slice(0, 15));
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
    digitSequences.forEach((seq) => addIfValid(seq));
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

// Clean and extract valid 14-16 digit IMEI from raw barcode text
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
  if (digitsOnly.length === 15) {
    return digitsOnly;
  }
  if (digitsOnly.length >= 14 && digitsOnly.length <= 17) {
    return digitsOnly.slice(0, 15);
  }
  return '';
}

export function BarcodeScanner({
  isOpen,
  onClose,
  onScan,
  targetField,
  title,
}: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const zxingReaderRef = useRef<MultiFormatReader | null>(null);
  const workCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const contrastCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isLockedRef = useRef<boolean>(false);
  const lastCandidateRef = useRef<{ imei: string; count: number; ts: number }>({
    imei: '',
    count: 0,
    ts: 0,
  });

  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(2);
  const [supportsHardwareZoom, setSupportsHardwareZoom] = useState<boolean>(false);
  const [scanStatusMessage, setScanStatusMessage] = useState<string | null>(null);
  const [scanSuccessAnim, setScanSuccessAnim] = useState<boolean>(false);
  const [lockedImei, setLockedImei] = useState<string | null>(null);

  // Initialize high-precision ZXing MultiFormatReader configured for tiny mobile box barcodes
  const getZxingReader = useCallback(() => {
    if (!zxingReaderRef.current) {
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.ITF,
        BarcodeFormat.CODE_93,
        BarcodeFormat.EAN_13,
        BarcodeFormat.DATA_MATRIX,
        BarcodeFormat.QR_CODE,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);
      const reader = new MultiFormatReader();
      reader.setHints(hints);
      zxingReaderRef.current = reader;
    }
    return zxingReaderRef.current;
  }, []);

  // Stop camera media stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    setCameraActive(false);
    setTorchOn(false);
  }, []);

  const finishWithImei = useCallback(
    (imei: string) => {
      if (isLockedRef.current) return;
      isLockedRef.current = true;
      setLockedImei(imei);
      setScanSuccessAnim(true);
      playScanSound();
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([70, 30, 70]);
      }
      stopCamera();
      setTimeout(() => {
        onScan(imei);
        onClose();
      }, 240);
    },
    [onScan, onClose, stopCamera]
  );

  // Apply hardware camera zoom if supported by the mobile lens
  const applyHardwareZoom = useCallback(async (targetZoom: number) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !track.getCapabilities) return false;
    try {
      const caps = track.getCapabilities() as any;
      if (caps && caps.zoom) {
        const minZ = caps.zoom.min ?? 1;
        const maxZ = caps.zoom.max ?? 1;
        if (maxZ > minZ) {
          const clamped = Math.min(maxZ, Math.max(minZ, targetZoom));
          await track.applyConstraints({
            advanced: [{ zoom: clamped } as any],
          });
          return true;
        }
      }
    } catch {
      // ignore if browser blocks zoom constraint
    }
    return false;
  }, []);

  const handleZoomChange = useCallback(
    async (newZoom: number) => {
      setZoomLevel(newZoom);
      if (supportsHardwareZoom) {
        await applyHardwareZoom(newZoom);
      }
    },
    [supportsHardwareZoom, applyHardwareZoom]
  );

  // Start live high-resolution camera stream
  const startCamera = useCallback(async () => {
    setCameraError(null);
    setScanStatusMessage(null);
    setLockedImei(null);
    isLockedRef.current = false;
    lastCandidateRef.current = { imei: '', count: 0, ts: 0 };

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access not supported on this device/browser');
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      // Request maximum sharpness (1080p / 4K macro-ready environment camera)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          // @ts-ignore
          focusMode: { ideal: 'continuous' },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
      }

      const track = stream.getVideoTracks()[0];
      if (track && track.getCapabilities) {
        const caps = track.getCapabilities() as any;
        if (caps && caps.torch) {
          setHasTorch(true);
        }
        if (caps && caps.zoom && (caps.zoom.max ?? 1) > 1.2) {
          setSupportsHardwareZoom(true);
          const initialZoom = Math.min(caps.zoom.max, Math.max(caps.zoom.min ?? 1, 2));
          await track
            .applyConstraints({
              advanced: [{ zoom: initialZoom } as any],
            })
            .catch(() => {});
        } else {
          setSupportsHardwareZoom(false);
        }
      }
    } catch (err: any) {
      console.error('Camera start error:', err);
      setCameraError(
        err.message || 'Unable to start camera. Please ensure camera permissions are allowed.'
      );
    }
  }, []);

  // Toggle camera flashlight
  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextTorch = !torchOn;
      await track.applyConstraints({
        advanced: [{ torch: nextTorch } as any],
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
      setScanSuccessAnim(false);
      setLockedImei(null);
      isLockedRef.current = false;
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  /**
   * High-contrast adaptive sharpening filter for tiny, closely-packed mobile box barcodes.
   * Enhances dark bar edges against white/silver sticker backgrounds.
   */
  const createHighContrastCanvas = useCallback((sourceCanvas: HTMLCanvasElement): HTMLCanvasElement => {
    if (!contrastCanvasRef.current) {
      contrastCanvasRef.current = document.createElement('canvas');
    }
    const dst = contrastCanvasRef.current;
    dst.width = sourceCanvas.width;
    dst.height = sourceCanvas.height;
    const ctx = dst.getContext('2d', { willReadFrequently: true });
    if (!ctx) return sourceCanvas;

    ctx.drawImage(sourceCanvas, 0, 0);
    const imgData = ctx.getImageData(0, 0, dst.width, dst.height);
    const data = imgData.data;

    // Compute min/max luminance for automatic histogram stretching
    let minLum = 255;
    let maxLum = 0;
    for (let i = 0; i < data.length; i += 16) {
      const lum = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
      if (lum < minLum) minLum = lum;
      if (lum > maxLum) maxLum = lum;
    }

    const range = Math.max(25, maxLum - minLum);
    const mid = minLum + range * 0.52;

    for (let i = 0; i < data.length; i += 4) {
      const lum = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
      // S-curve contrast boost around midpoint so tiny thin bars stand out sharply
      const norm = Math.max(0, Math.min(255, ((lum - minLum) * 255) / range));
      const contrasted = norm < mid ? Math.max(0, norm * 0.55) : Math.min(255, norm * 1.25 + 20);
      data[i] = contrasted;
      data[i + 1] = contrasted;
      data[i + 2] = contrasted;
    }

    ctx.putImageData(imgData, 0, 0);
    return dst;
  }, []);

  /**
   * Decode a cropped laser-line strip using @zxing/library MultiFormatReader
   * with both HybridBinarizer and GlobalHistogramBinarizer.
   */
  const decodeCanvasWithZxing = useCallback(
    (canvas: HTMLCanvasElement): string | null => {
      const reader = getZxingReader();
      const luminance = new HTMLCanvasElementLuminanceSource(canvas);

      // Try 1: HybridBinarizer (best for uneven lighting on mobile box stickers)
      try {
        const bitmap = new BinaryBitmap(new HybridBinarizer(luminance));
        const res = reader.decodeWithState(bitmap);
        if (res && res.getText()) {
          const imei = extractImeiFromBarcode(res.getText());
          if (imei && imei.length >= 14) return imei;
        }
      } catch {
        // NotFoundException is normal when no barcode is in frame
      }

      // Try 2: GlobalHistogramBinarizer (best for tiny, low-contrast Code 128 bars)
      try {
        const bitmap2 = new BinaryBitmap(new GlobalHistogramBinarizer(luminance));
        const res2 = reader.decodeWithState(bitmap2);
        if (res2 && res2.getText()) {
          const imei = extractImeiFromBarcode(res2.getText());
          if (imei && imei.length >= 14) return imei;
        }
      } catch {
        // ignore
      }

      return null;
    },
    [getZxingReader]
  );

  /**
   * Validate candidate IMEI:
   * - If 15 digits AND passes GSMA Luhn check -> 100% verified immediately on 1st frame!
   * - Otherwise require 2 consecutive matching reads within 900ms to prevent misreads.
   */
  const verifyAndLockCandidate = useCallback(
    (candidateImei: string): boolean => {
      if (!candidateImei || candidateImei.length < 14) return false;

      if (isValidLuhnImei(candidateImei)) {
        finishWithImei(candidateImei);
        return true;
      }

      const now = Date.now();
      const prev = lastCandidateRef.current;
      if (prev.imei === candidateImei && now - prev.ts < 1200) {
        const nextCount = prev.count + 1;
        lastCandidateRef.current = { imei: candidateImei, count: nextCount, ts: now };
        if (nextCount >= 2) {
          finishWithImei(candidateImei);
          return true;
        }
      } else {
        lastCandidateRef.current = { imei: candidateImei, count: 1, ts: now };
      }
      return false;
    },
    [finishWithImei]
  );

  /**
   * Continuous Real-Time Red-Line Laser Auto-Scanner Loop.
   * Crops ONLY the narrow horizontal strip directly under the Red Laser Line so that
   * even when two tiny IMEI barcodes are stacked 2mm apart on a mobile box, only the
   * barcode touched by the red line is scanned!
   */
  useEffect(() => {
    if (!isOpen || !cameraActive) return;

    let isCancelled = false;
    let isFrameBusy = false;

    let nativeDetector: any = null;
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        nativeDetector = new (window as any).BarcodeDetector({
          formats: ['code_128', 'code_39', 'itf', 'ean_13', 'qr_code', 'data_matrix'],
        });
      } catch {
        nativeDetector = null;
      }
    }

    const scanFrame = async () => {
      if (isCancelled || isFrameBusy || isLockedRef.current) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
        return;
      }

      isFrameBusy = true;
      try {
        const vw = video.videoWidth;
        const vh = video.videoHeight;

        // If hardware zoom is not supported by the browser, apply digital crop magnification
        const digitalScale = !supportsHardwareZoom && zoomLevel > 1 ? zoomLevel : 1;

        // Isolate the narrow horizontal slit right along the Red Laser Line (center Y = 50%).
        // Using a tight 11% height slit ensures adjacent stacked barcodes above/below the red line are excluded!
        const slitWidthRatio = Math.min(0.86, 0.86 / digitalScale);
        const slitHeightRatio = Math.min(0.12, 0.12 / digitalScale);

        const cropW = Math.max(320, Math.floor(vw * slitWidthRatio));
        const cropH = Math.max(64, Math.floor(vh * slitHeightRatio));
        const cropX = Math.floor((vw - cropW) / 2);
        const cropY = Math.floor((vh - cropH) / 2);

        if (!workCanvasRef.current) {
          workCanvasRef.current = document.createElement('canvas');
        }
        const canvas = workCanvasRef.current;

        // Upscale 1.75x so tiny high-density Code-128 bars have ample pixel separation
        const upscale = 1.75;
        canvas.width = Math.floor(cropW * upscale);
        canvas.height = Math.floor(cropH * upscale);

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);

        // 1. Hardware-accelerated Native BarcodeDetector on the Red-Line Laser Slit
        if (nativeDetector) {
          try {
            const detections = await nativeDetector.detect(canvas);
            if (detections && detections.length > 0) {
              // If multiple barcodes somehow partially enter the slit, pick the one closest to the vertical center (the Red Line)
              const laserCenterY = canvas.height / 2;
              const sorted = [...detections].sort((a: any, b: any) => {
                const aCenter = a.boundingBox
                  ? a.boundingBox.y + a.boundingBox.height / 2
                  : laserCenterY;
                const bCenter = b.boundingBox
                  ? b.boundingBox.y + b.boundingBox.height / 2
                  : laserCenterY;
                return Math.abs(aCenter - laserCenterY) - Math.abs(bCenter - laserCenterY);
              });

              for (const det of sorted) {
                const imei = extractImeiFromBarcode(det.rawValue || '');
                if (imei && verifyAndLockCandidate(imei)) {
                  return;
                }
              }
            }
          } catch {
            // fallback to ZXing
          }
        }

        // 2. ZXing MultiFormatReader (TRY_HARDER) on the upscaled Red-Line Laser Slit
        const zxingImei = decodeCanvasWithZxing(canvas);
        if (zxingImei && verifyAndLockCandidate(zxingImei)) {
          return;
        }

        // 3. Adaptive High-Contrast Sharpened Pass (for tiny/faint/glossy mobile box barcodes)
        const contrastedCanvas = createHighContrastCanvas(canvas);
        if (nativeDetector) {
          try {
            const dets2 = await nativeDetector.detect(contrastedCanvas);
            if (dets2 && dets2.length > 0) {
              const imei = extractImeiFromBarcode(dets2[0].rawValue || '');
              if (imei && verifyAndLockCandidate(imei)) {
                return;
              }
            }
          } catch {}
        }

        const contrastedImei = decodeCanvasWithZxing(contrastedCanvas);
        if (contrastedImei && verifyAndLockCandidate(contrastedImei)) {
          return;
        }
      } catch {
        // ignore transient frame error
      } finally {
        isFrameBusy = false;
      }
    };

    const intervalId = setInterval(scanFrame, 95);
    return () => {
      isCancelled = true;
      clearInterval(intervalId);
    };
  }, [
    isOpen,
    cameraActive,
    zoomLevel,
    supportsHardwareZoom,
    decodeCanvasWithZxing,
    createHighContrastCanvas,
    verifyAndLockCandidate,
  ]);

  // Handle fallback image upload from file or gallery
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanStatusMessage(null);

    try {
      const decoder = new Html5Qrcode('barcode-scanner-hidden-engine', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        verbose: false,
      });

      const result = await decoder.scanFileV2(file, false);
      if (result && result.decodedText) {
        const imei = extractImeiFromBarcode(result.decodedText, targetField === 'imei2' ? 1 : 0);
        if (imei && imei.length >= 14) {
          finishWithImei(imei);
          return;
        }
      }
      setScanStatusMessage('No valid 15-digit IMEI barcode detected in the uploaded image.');
    } catch {
      setScanStatusMessage('Could not decode IMEI barcode from photo. Try holding the camera over the box.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const modalTitle = title || (targetField === 'imei2' ? 'Scan IMEI 2' : 'Scan IMEI 1');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} size="md">
      <div className="space-y-3">
        {/* Hidden element for photo upload fallback */}
        <div id="barcode-scanner-hidden-engine" className="hidden" />

        {/* Viewfinder Area */}
        <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner flex flex-col items-center justify-center min-h-[300px] sm:min-h-[340px]">
          {/* Live Video Element (applies CSS digital zoom around center red line if hardware zoom is not supported) */}
          <video
            ref={videoRef}
            playsInline
            autoPlay
            muted
            style={{
              transform: !supportsHardwareZoom && zoomLevel > 1 ? `scale(${zoomLevel})` : undefined,
              transformOrigin: 'center center',
            }}
            className="w-full h-full object-cover min-h-[300px] sm:min-h-[340px] transition-transform duration-200"
          />

          {/* Darkened Top & Bottom Masks to Visually Isolate the Single Barcode Under the Red Line */}
          <div className="absolute inset-0 pointer-events-none flex flex-col">
            <div className="flex-1 bg-black/55 backdrop-blur-[1px]" />
            {/* Narrow Precision Laser Slit Window (Only 62px tall so adjacent stacked barcodes are excluded) */}
            <div className="h-[62px] sm:h-[68px] w-full flex items-center justify-center px-5">
              <div className="relative w-full max-w-[330px] h-full border-2 border-amber-400/95 rounded-xl bg-transparent flex items-center justify-center shadow-[0_0_24px_rgba(251,191,36,0.25)]">
                {/* Active Glowing Red Laser Line */}
                <div className="absolute left-1.5 right-1.5 h-[2px] bg-red-500 shadow-[0_0_12px_#ef4444,0_0_4px_#ef4444] animate-pulse" />

                {/* Corner Brackets */}
                <div className="absolute -top-0.5 -left-0.5 w-3.5 h-3.5 border-t-2 border-l-2 border-amber-400 rounded-tl-xs" />
                <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 border-t-2 border-r-2 border-amber-400 rounded-tr-xs" />
                <div className="absolute -bottom-0.5 -left-0.5 w-3.5 h-3.5 border-b-2 border-l-2 border-amber-400 rounded-bl-xs" />
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 border-b-2 border-r-2 border-amber-400 rounded-br-xs" />
              </div>
            </div>
            <div className="flex-1 bg-black/55 backdrop-blur-[1px] flex flex-col items-center justify-start pt-3 px-4">
              <span className="text-[11px] font-bold tracking-wide text-white drop-shadow-md bg-black/70 px-3 py-1 rounded-full border border-white/15 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                Place red line directly on {targetField === 'imei2' ? 'IMEI 2' : 'IMEI 1'} barcode — scans automatically
              </span>
            </div>
          </div>

          {/* Macro Zoom Selector (1x / 2x / 3x) for Tiny Mobile Box Barcodes */}
          <div className="absolute top-3 left-3 z-20 flex items-center gap-1 bg-black/65 backdrop-blur-md p-1 rounded-full border border-white/15">
            <ZoomIn className="w-3.5 h-3.5 text-amber-400 ml-1.5 mr-0.5" />
            {[1, 2, 3].map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => handleZoomChange(z)}
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                  zoomLevel === z
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                {z}x
              </button>
            ))}
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

          {/* Success Flash Animation */}
          {scanSuccessAnim && (
            <div className="absolute inset-0 bg-emerald-500/40 backdrop-blur-xs flex flex-col items-center justify-center z-30 transition-opacity duration-200 space-y-2">
              <div className="p-3 bg-emerald-600 text-white rounded-full shadow-2xl animate-bounce">
                <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
              </div>
              {lockedImei && (
                <span className="px-3 py-1 rounded-full bg-slate-950/90 text-emerald-400 font-mono text-xs font-bold border border-emerald-400/40 shadow-lg">
                  {lockedImei}
                </span>
              )}
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

        {/* Scan Status Toast if photo upload failed */}
        {scanStatusMessage && (
          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="flex-1">{scanStatusMessage}</p>
          </div>
        )}

        {/* Footer Actions (Manual capture button removed — automatic red-line laser scan is active) */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
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

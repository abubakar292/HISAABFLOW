import React, { useRef, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (imei: string) => void;
}

export function BarcodeScanner({ isOpen, onClose, onScan }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStartedRef = useRef(false);
  const containerId = 'qr-scanner-container';

  useEffect(() => {
    if (!isOpen) return;

    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode(containerId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' }, // back camera
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decodedText) => {
            // Extract IMEI from barcode (first 15 digits)
            const imei = decodedText.replace(/\D/g, '').slice(0, 15);
            if (imei.length >= 10) {
              onScan(imei);
              if (isStartedRef.current) {
                try {
                  scanner.stop().catch(() => {});
                } catch (e) {}
                isStartedRef.current = false;
              }
              onClose();
            }
          },
          undefined
        );
        isStartedRef.current = true;
      } catch (err) {
        console.error('Scanner error:', err);
      }
    };

    // Slight delay to ensure DOM is ready inside Modal
    const timer = setTimeout(startScanner, 100);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current && isStartedRef.current) {
        try {
          scannerRef.current.stop().catch(() => {});
        } catch (e) {}
        isStartedRef.current = false;
      }
    };
  }, [isOpen, onClose, onScan]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Scan IMEI Barcode">
      <div id={containerId} className="w-full min-h-[300px] bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center">
        {/* html5-qrcode will render here */}
      </div>
      <p className="text-center text-sm text-slate-500 mt-4">
        Point camera at barcode/QR code on the phone box
      </p>
      <Button variant="secondary" className="w-full mt-4" onClick={onClose}>
        Cancel — Type Manually
      </Button>
    </Modal>
  );
}

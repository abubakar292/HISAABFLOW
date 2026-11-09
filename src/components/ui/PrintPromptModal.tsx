import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Printer, Eye, Share2, Bluetooth } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { BillPreviewModal } from './BillPreviewModal';
import { BluetoothPrinterModal } from './BluetoothPrinterModal';
import { getBillHtml } from '../../utils/printBill';
import { getWhatsAppSaleBillUrl } from '../../config/shopConfig';
import { useAuth } from '../../contexts/AuthContext';
import { playSaleSound } from '../../utils/soundEffects';

interface PrintPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  billData: any;
  profit: number;
}

export function PrintPromptModal({ isOpen, onClose, billData, profit }: PrintPromptModalProps) {
  const { shopProfile } = useAuth();
  const [showPreview, setShowPreview] = useState(false);
  const [showBluetooth, setShowBluetooth] = useState(false);

  useEffect(() => {
    if (isOpen) {
      playSaleSound();
    }
  }, [isOpen]);

  const handleOpenPreview = () => {
    setShowPreview(true);
  };

  const handleOpenBluetooth = () => {
    setShowBluetooth(true);
  };

  const handleCloseAll = () => {
    setShowPreview(false);
    setShowBluetooth(false);
    onClose();
  };

  const billHtml = billData ? getBillHtml(billData, shopProfile) : '';

  const handleWhatsAppShare = () => {
    if (!billData) return;
    const phone = billData.customerPhone || billData.phone || '';
    const name = billData.customerName || 'Walk-in Customer';
    const firstItem = billData.items && billData.items[0];
    const item = firstItem?.modelName || firstItem?.itemName || billData.itemName || billData.modelName || 'Mobile Purchase';
    const amount = billData.totalSellPrice || billData.totalSellAmount || billData.sellPrice || firstItem?.sellPrice || 0;
    const method = billData.paymentMethod || 'Cash';
    const imei = firstItem?.imei1 || billData.imei1 || '';
    const billNum = billData.billNumber || (billData.id ? String(billData.id).substring(0, 8).toUpperCase() : '');
    const url = getWhatsAppSaleBillUrl(phone, name, item, Number(amount) || 0, method, imei, billNum);
    window.open(url, '_blank');
  };

  return (
    <>
      <Modal isOpen={isOpen && !showPreview && !showBluetooth} onClose={onClose} title="Success" size="sm">
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400 }}
            className="w-16 h-16 bg-accent-emerald/10 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <Check className="w-8 h-8 text-accent-emerald" />
          </motion.div>
          
          <h3 className="font-bold text-lg mb-1 text-slate-800">Sale Completed</h3>
          <p className="text-slate-500 text-sm mb-2">
            Profit: <span className="text-accent-emerald font-bold">Rs. {profit.toLocaleString()}</span>
          </p>
          
          <div className="flex flex-col gap-2 mt-5">
            {/* Bluetooth Mini Printer direct button */}
            <Button
              variant="primary"
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold shadow-xs"
              onClick={handleOpenBluetooth}
            >
              <Bluetooth className="w-4 h-4" />
              Bluetooth Mini Printer
            </Button>

            {/* Standard Preview & System Print */}
            <Button
              variant="secondary"
              className="w-full flex items-center justify-center gap-2 bg-[#522D60] hover:bg-[#42244D] text-white font-extrabold border-none shadow-sm cursor-pointer"
              onClick={handleOpenPreview}
            >
              <Eye className="w-4 h-4 stroke-[2.5]" />
              Preview & System Print
            </Button>
            
            <Button
              variant="secondary"
              className="w-full flex items-center justify-center gap-2 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200 cursor-pointer"
              onClick={handleWhatsAppShare}
            >
              <Share2 className="w-4 h-4" />
              Share Receipt
            </Button>

            <Button variant="ghost" className="w-full text-slate-500" onClick={onClose}>
              Done / Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* IN-APP PREVIEW MODAL */}
      <BillPreviewModal
        isOpen={showPreview}
        onClose={handleCloseAll}
        htmlContent={billHtml}
        title="Sale Receipt"
        billNumber={billData?.billNumber || billData?.id}
        billData={billData}
        onShareWhatsApp={handleWhatsAppShare}
      />

      {/* DIRECT BLUETOOTH THERMAL PRINTER MODAL */}
      <BluetoothPrinterModal
        isOpen={showBluetooth}
        onClose={handleCloseAll}
        billData={billData}
      />
    </>
  );
}

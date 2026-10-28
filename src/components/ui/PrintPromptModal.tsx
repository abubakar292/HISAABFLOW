import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Printer, Eye, Share2, Bluetooth } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { BillPreviewModal } from './BillPreviewModal';
import { BluetoothPrinterModal } from './BluetoothPrinterModal';
import { getBillHtml } from '../../utils/printBill';
import { getWhatsAppSaleBillUrl } from '../../config/shopConfig';
import { useAuth } from '../../contexts/AuthContext';

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
    const name = billData.customerName || 'Customer';
    const amount = billData.totalSellPrice || billData.sellPrice || 0;
    const billNum = billData.billNumber || billData.id || '';
    const item = (billData.items && billData.items[0]?.modelName) || billData.itemName || billData.modelName || 'Mobile';
    const url = getWhatsAppSaleBillUrl(phone, name, amount, billNum, item);
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
          
          <h3 className="font-bold text-lg mb-1 text-slate-800">Sale Completed! 🎉</h3>
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
            
            {billData?.customerPhone && (
              <Button
                variant="secondary"
                className="w-full flex items-center justify-center gap-2 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200"
                onClick={handleWhatsAppShare}
              >
                <Share2 className="w-4 h-4" />
                Share on WhatsApp
              </Button>
            )}

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
        onShareWhatsApp={billData?.customerPhone ? handleWhatsAppShare : undefined}
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

import { format } from 'date-fns';
import { formatDateSafe } from './dateUtils';
import { printInNewWindow } from './printUtils';
import { SHOP_CONFIG } from '../config/shopConfig';

export function generateBillNumber(sequence?: number, prefix = 'MZ'): string {
  const year = new Date().getFullYear();
  if (sequence !== undefined && sequence > 0) {
    return `${prefix}-${year}-${String(sequence).padStart(4, '0')}`;
  }
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${year}-${randomPart}`;
}

export function getBillHtml(billData: any, shopInfo?: any): string {
  const isMultiple = billData.items && billData.items.length > 0;
  
  const currentShopName = shopInfo?.shopName || billData?.shopName || SHOP_CONFIG.name;
  const currentSubTitle = shopInfo?.subTitle || SHOP_CONFIG.subTitle;
  const currentAddress = shopInfo?.address || SHOP_CONFIG.address;
  const currentPhone = shopInfo?.phone || SHOP_CONFIG.phone;
  const currentReceiptNote = shopInfo?.receiptNote || 'Warranty claim requires original bill slip. Thank you for your business!';
  const logoUrl = shopInfo?.logoUrl;

  const itemsHtml = isMultiple 
    ? billData.items.map((item: any, i: number) => `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 8px 6px; text-align: center; color: #94a3b8; font-size: 11px;">${i + 1}</td>
        <td style="padding: 8px 6px;">
          <div style="font-weight: 700; color: #0f172a; font-size: 13px;">${item.company || ''} ${item.modelName || item.itemName || ''}</div>
          ${item.ramRom ? `<div style="font-size: 10.5px; color: #64748b;">Specs: ${item.ramRom}</div>` : ''}
        </td>
        <td style="padding: 8px 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11.5px; color: #334155;">
          ${item.imei1 || (item.imei2 ? '' : '-')}
          ${item.imei2 ? `<div style="font-size: 10px; color: #64748b;">IMEI 2: ${item.imei2}</div>` : ''}
        </td>
        <td style="padding: 8px 6px; text-align: right; font-weight: 800; color: #0f172a; font-size: 13px;">Rs. ${(item.sellPrice || 0).toLocaleString()}</td>
      </tr>
    `).join('')
    : `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 8px 6px; text-align: center; color: #94a3b8; font-size: 11px;">1</td>
        <td style="padding: 8px 6px;">
          <div style="font-weight: 700; color: #0f172a; font-size: 13px;">${billData.company || ''} ${billData.itemName || billData.modelName || ''}</div>
          ${billData.ramRom ? `<div style="font-size: 10.5px; color: #64748b;">Specs: ${billData.ramRom}</div>` : ''}
        </td>
        <td style="padding: 8px 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11.5px; color: #334155;">
          ${billData.imei1 || (billData.imei2 ? '' : '-')}
          ${billData.imei2 ? `<div style="font-size: 10px; color: #64748b;">IMEI 2: ${billData.imei2}</div>` : ''}
        </td>
        <td style="padding: 8px 6px; text-align: right; font-weight: 800; color: #0f172a; font-size: 13px;">Rs. ${(billData.sellPrice || billData.totalSellPrice || 0).toLocaleString()}</td>
      </tr>
    `;

  let calculatedTotal = 0;
  if (billData.totalSellPrice !== undefined && billData.totalSellPrice !== null && Number(billData.totalSellPrice) > 0) {
    calculatedTotal = Number(billData.totalSellPrice);
  } else if (billData.totalSellAmount !== undefined && billData.totalSellAmount !== null && Number(billData.totalSellAmount) > 0) {
    calculatedTotal = Number(billData.totalSellAmount);
  } else if (billData.sellPrice !== undefined && billData.sellPrice !== null && Number(billData.sellPrice) > 0) {
    calculatedTotal = Number(billData.sellPrice);
  } else if (billData.items && billData.items.length > 0) {
    calculatedTotal = billData.items.reduce((sum: number, it: any) => sum + (Number(it.sellPrice) || 0), 0);
  }

  const invoiceNum = billData.billNumber || (billData.id ? String(billData.id).substring(0, 8).toUpperCase() : 'INV-0001');

  const logoMarkup = logoUrl 
    ? `<img src="${logoUrl}" alt="${currentShopName}" class="header-logo" />`
    : `<img src="/logo.png" alt="${currentShopName}" class="header-logo" onerror="this.style.display='none'" />`;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>Invoice #${invoiceNum} - ${currentShopName}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #0f172a;
          background: #ffffff;
          padding: 12px;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .bill-container {
          width: 100%;
          max-width: 680px;
          margin: 0 auto;
          background: #ffffff;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
        }
        .header {
          background: #522D60;
          color: #ffffff;
          padding: 14px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .header-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .header-logo {
          max-width: 50px;
          max-height: 40px;
          object-fit: contain;
          border-radius: 6px;
          background: #ffffff;
          padding: 2px;
        }
        .header-info h1 {
          font-size: 17px;
          font-weight: 800;
          letter-spacing: -0.2px;
          margin: 0;
          color: #ffffff;
          line-height: 1.2;
        }
        .header-info p {
          font-size: 11px;
          color: #e9d5ff;
          font-weight: 500;
          margin-top: 2px;
        }
        .header-badge {
          text-align: right;
        }
        .invoice-pill {
          display: inline-block;
          background: rgba(255,255,255,0.18);
          color: #ffffff;
          font-weight: 800;
          font-size: 10.5px;
          padding: 3px 10px;
          border-radius: 20px;
          letter-spacing: 0.5px;
        }
        .invoice-date {
          font-size: 10px;
          color: #e9d5ff;
          margin-top: 3px;
        }
        .meta-strip {
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          padding: 10px 18px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 10px;
          font-size: 11.5px;
        }
        .meta-strip p {
          margin: 2px 0;
          color: #475569;
        }
        .meta-strip strong {
          color: #0f172a;
          font-weight: 700;
        }
        .table-wrap {
          padding: 10px 18px;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .items-table {
          width: 100%;
          min-width: 380px;
          border-collapse: collapse;
          font-size: 12px;
        }
        .items-table th {
          background: #f1f5f9;
          padding: 7px 8px;
          text-align: left;
          font-size: 10.5px;
          font-weight: 700;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-radius: 4px;
        }
        .summary-card {
          margin: 0 20px 14px 20px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .summary-title {
          font-size: 11.5px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .summary-total {
          font-size: 20px;
          font-weight: 900;
          color: #522D60;
          letter-spacing: -0.5px;
        }
        .footer {
          padding: 12px 20px 16px 20px;
          border-top: 1px dashed #e2e8f0;
          text-align: center;
          color: #64748b;
          font-size: 10.5px;
          line-height: 1.5;
        }
        .footer strong {
          color: #334155;
        }
        @media print {
          @page { margin: 6mm; size: auto; }
          body { padding: 0 !important; background: #fff !important; }
          .bill-container {
            border: none !important;
            box-shadow: none !important;
            max-width: 100% !important;
            border-radius: 0 !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="bill-container">
        <!-- Top Header -->
        <div class="header">
          <div class="header-brand">
            ${logoMarkup}
            <div class="header-info">
              <h1>${currentShopName}</h1>
              <p>${currentSubTitle ? `${currentSubTitle} • ` : ''}Tel: ${currentPhone}</p>
            </div>
          </div>
          <div class="header-badge">
            <span class="invoice-pill">INVOICE #${invoiceNum}</span>
            <div class="invoice-date">${formatDateSafe(billData.date || new Date(), 'dd MMM yyyy, hh:mm a')}</div>
          </div>
        </div>

        <!-- Meta Customer Details -->
        <div class="meta-strip">
          <div>
            <p><strong>Customer:</strong> ${billData.customerName || 'Walk-in Customer'}</p>
            <p><strong>Contact:</strong> ${billData.customerPhone || 'N/A'}</p>
          </div>
          <div style="text-align: right;">
            <p><strong>Payment:</strong> ${billData.paymentMethod || 'Cash'}</p>
            <p><strong>Cashier / Store:</strong> ${currentShopName}</p>
          </div>
        </div>

        <!-- Items Table -->
        <div class="table-wrap">
          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 32px; text-align: center;">#</th>
                <th>Item / Model</th>
                <th>IMEI Number</th>
                <th style="text-align: right; width: 110px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
        </div>

        <!-- Grand Net Payable -->
        <div class="summary-card">
          <div class="summary-title">Net Payable Amount</div>
          <div class="summary-total">Rs. ${calculatedTotal.toLocaleString()}</div>
        </div>

        <!-- Footer terms -->
        <div class="footer">
          <strong>${currentReceiptNote}</strong><br/>
          <span>${currentShopName} • ${currentAddress} • Helpline: ${currentPhone}</span>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function printBillHtml(billData: any, shopInfo?: any) {
  const html = getBillHtml(billData, shopInfo);
  printInNewWindow(html, `Bill_${billData.billNumber || billData.id}`);
}
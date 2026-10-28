import { format } from 'date-fns';
import { formatDateSafe } from './dateUtils';
import { printInNewWindow } from './printUtils';
import { SHOP_CONFIG } from '../config/shopConfig';
import { getBrandGradient } from './brandIdentity';

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
  const currentShortName = shopInfo?.shortName || 'MZ';
  const currentSubTitle = shopInfo?.subTitle || SHOP_CONFIG.subTitle;
  const currentAddress = shopInfo?.address || SHOP_CONFIG.address;
  const currentPhone = shopInfo?.phone || SHOP_CONFIG.phone;
  const currentReceiptNote = shopInfo?.receiptNote || 'Warranty claim requires original bill slip. Thank you for your business!';
  const logoUrl = shopInfo?.logoUrl;
  const palette = getBrandGradient(currentShopName || currentShortName);

  const itemsHtml = isMultiple 
    ? billData.items.map((item: any, i: number) => `
      <tr>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">${i + 1}</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0;">
          <strong>${item.company || ''} ${item.modelName || item.itemName || ''}</strong><br/>
          <span style="font-size: 11px; color: #64748b;">${item.ramRom || ''}</span>
        </td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-size: 12px;">
          ${item.imei1 || (item.imei2 ? '' : '-')}
          ${item.imei2 ? `<br/><span style="font-size: 11px; color: #64748b;">IMEI2: ${item.imei2}</span>` : ''}
        </td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700;">Rs. ${(item.sellPrice || 0).toLocaleString()}</td>
      </tr>
    `).join('')
    : `
      <tr>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">1</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0;">
          <strong>${billData.company || ''} ${billData.itemName || billData.modelName || ''}</strong>
        </td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-size: 12px;">
          ${billData.imei1 || (billData.imei2 ? '' : '-')}
          ${billData.imei2 ? `<br/><span style="font-size: 11px; color: #64748b;">IMEI2: ${billData.imei2}</span>` : ''}
        </td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700;">Rs. ${(billData.sellPrice || billData.totalSellPrice || 0).toLocaleString()}</td>
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

  const totalHtml = `Rs. ${calculatedTotal.toLocaleString()}`;

  const logoMarkup = logoUrl 
    ? `<img src="${logoUrl}" alt="${currentShopName}" class="header-logo" />`
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Bill #${billData.billNumber || billData.id} - ${currentShopName}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Plus Jakarta Sans", sans-serif; margin: 0; padding: 12px; color: #0f172a; background: #fff; }
        .bill-container { max-width: 800px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background: #fff; }
        .header { background: #522D60; color: white; padding: 22px 20px; text-align: center; }
        .header-inner { display: flex; align-items: center; justify-content: center; gap: 16px; }
        .header-logo { width: 50px; height: 50px; border-radius: 12px; object-fit: contain; background: #fff; padding: 4px; }
        .title-band { background: #f8fafc; color: #522D60; text-align: center; padding: 8px; font-weight: 800; letter-spacing: 2px; font-size: 11px; border-bottom: 1px solid #e2e8f0; text-transform: uppercase; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 16px; border-bottom: 2px solid #e2e8f0; font-size: 13px; }
        .info-col p { margin: 4px 0; }
        .items-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
        .items-table th { background: #f8fafc; padding: 10px 8px; text-align: left; border-bottom: 2px solid #cbd5e1; color: #522D60; font-weight: 700; font-size: 11px; text-transform: uppercase; }
        .total-row { display: flex; justify-content: space-between; padding: 16px; font-size: 18px; font-weight: 900; background: #f8fafc; border-top: 2px solid #522D60; border-bottom: 1px solid #e2e8f0; color: #522D60; }
        .footer { text-align: center; padding: 16px; color: #64748b; font-size: 11px; line-height: 1.6; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 0; }
          .bill-container { border: none; }
        }
      </style>
    </head>
    <body>
      <div class="bill-container">
        <div class="header">
          <div class="header-inner">
            ${logoMarkup}
            <div style="text-align: center;">
              <h1 style="margin:0; font-size: 22px; font-weight: 900; letter-spacing: 0.5px;">${currentShopName}</h1>
              <p style="margin:4px 0 0 0; color: rgba(255,255,255,0.85); font-weight: 600; font-size: 11px; letter-spacing: 1px; text-transform: uppercase;">${currentSubTitle} • Tel: ${currentPhone}</p>
            </div>
          </div>
        </div>
        <div class="title-band">SALES INVOICE #${billData.billNumber || (billData.id ? billData.id.substring(0,8).toUpperCase() : '')}</div>
        
        <div class="info-grid">
          <div class="info-col">
            <p><strong>Customer:</strong> ${billData.customerName || 'Walk-in Customer'}</p>
            <p><strong>Phone:</strong> ${billData.customerPhone || 'N/A'}</p>
            <p><strong>Payment Method:</strong> ${billData.paymentMethod || 'Cash'}</p>
          </div>
          <div class="info-col" style="text-align: right;">
            <p><strong>Date:</strong> ${formatDateSafe(billData.date || new Date(), 'dd/MM/yyyy')}</p>
            <p><strong>Time:</strong> ${formatDateSafe(billData.date || new Date(), 'hh:mm a')}</p>
            <p><strong>Invoice #:</strong> ${billData.billNumber || (billData.id ? billData.id.substring(0,8).toUpperCase() : '')}</p>
          </div>
        </div>
        <div style="padding: 16px;">
          <table class="items-table">
            <thead>
              <tr>
                <th style="text-align: center; width: 40px;">#</th>
                <th>Item Description</th>
                <th>IMEI Number</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
        </div>
        <div class="total-row">
          <span>NET PAYABLE:</span>
          <span>${totalHtml}</span>
        </div>
        <div class="footer">
          <strong>${currentReceiptNote}</strong><br/>
          <span>${currentShopName} • ${currentAddress} • Contact: ${currentPhone}</span>
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
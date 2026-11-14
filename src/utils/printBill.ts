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

  const hasAnyImei = isMultiple
    ? billData.items.some((item: any) => Boolean(item.imei1 || item.imei2))
    : Boolean(billData.imei1 || billData.imei2);

  const itemsHtml = isMultiple 
    ? billData.items.map((item: any, i: number) => {
        const rawModel = item.modelName || item.itemName || '';
        const comp = item.company || '';
        const displayTitle = rawModel.toLowerCase().startsWith(comp.toLowerCase())
          ? rawModel
          : `${comp} ${rawModel}`.trim();
        const itemWarranty = shopInfo?.enableImeiCheck
          ? (item.warrantyLabel || billData.warrantyLabel || '')
          : '';
        return `
      <tr class="item-row">
        <td class="col-index">${i + 1}</td>
        <td class="col-item">
          <div class="item-title">${displayTitle}</div>
          <div class="item-sub">
            ${item.ramRom ? `<span>Specs: ${item.ramRom}</span>` : ''}
            ${item.condition ? `<span>${item.ramRom ? ' • ' : ''}${item.condition}</span>` : ''}
            ${itemWarranty ? `<span>${(item.ramRom || item.condition) ? ' • ' : ''}<strong>Warranty: ${itemWarranty}</strong></span>` : ''}
          </div>
          ${hasAnyImei && (item.imei1 || item.imei2) ? `
            <div class="mobile-imei-inline">
              IMEI: ${item.imei1 || ''}${item.imei2 ? ` / ${item.imei2}` : ''}
            </div>
          ` : ''}
        </td>
        ${hasAnyImei ? `
        <td class="col-imei">
          ${item.imei1 || (item.imei2 ? '' : '-')}
          ${item.imei2 ? `<div class="imei-secondary">IMEI 2: ${item.imei2}</div>` : ''}
        </td>
        ` : ''}
        <td class="col-amount">Rs. ${(Number(item.sellPrice) || 0).toLocaleString()}</td>
      </tr>
    `;
      }).join('')
    : (() => {
        const rawModel = billData.itemName || billData.modelName || '';
        const comp = billData.company || '';
        const displayTitle = rawModel.toLowerCase().startsWith(comp.toLowerCase())
          ? rawModel
          : `${comp} ${rawModel}`.trim();
        const singleWarranty = shopInfo?.enableImeiCheck ? (billData.warrantyLabel || '') : '';
        return `
      <tr class="item-row">
        <td class="col-index">1</td>
        <td class="col-item">
          <div class="item-title">${displayTitle}</div>
          <div class="item-sub">
            ${billData.ramRom ? `<span>Specs: ${billData.ramRom}</span>` : ''}
            ${billData.condition ? `<span>${billData.ramRom ? ' • ' : ''}${billData.condition}</span>` : ''}
            ${singleWarranty ? `<span>${(billData.ramRom || billData.condition) ? ' • ' : ''}<strong>Warranty: ${singleWarranty}</strong></span>` : ''}
          </div>
          ${hasAnyImei && (billData.imei1 || billData.imei2) ? `
            <div class="mobile-imei-inline">
              IMEI: ${billData.imei1 || ''}${billData.imei2 ? ` / ${billData.imei2}` : ''}
            </div>
          ` : ''}
        </td>
        ${hasAnyImei ? `
        <td class="col-imei">
          ${billData.imei1 || (billData.imei2 ? '' : '-')}
          ${billData.imei2 ? `<div class="imei-secondary">IMEI 2: ${billData.imei2}</div>` : ''}
        </td>
        ` : ''}
        <td class="col-amount">Rs. ${(Number(billData.sellPrice || billData.totalSellPrice) || 0).toLocaleString()}</td>
      </tr>
    `;
      })();

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
          padding: 10px;
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
        }
        .header {
          background: #522D60;
          color: #ffffff;
          padding: 14px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
        }
        .header-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          flex: 1;
        }
        .header-logo {
          width: 40px;
          height: 40px;
          object-fit: contain;
          border-radius: 8px;
          background: #ffffff;
          padding: 2px;
          flex-shrink: 0;
        }
        .header-info {
          min-width: 0;
        }
        .header-info h1 {
          font-size: 16px;
          font-weight: 800;
          letter-spacing: -0.2px;
          margin: 0;
          color: #ffffff;
          line-height: 1.25;
        }
        .header-info p {
          font-size: 11px;
          color: #e9d5ff;
          font-weight: 500;
          margin-top: 2px;
        }
        .header-badge {
          text-align: right;
          flex-shrink: 0;
        }
        .invoice-pill {
          display: inline-block;
          background: rgba(255,255,255,0.18);
          color: #ffffff;
          font-weight: 800;
          font-size: 10.5px;
          padding: 3px 10px;
          border-radius: 20px;
          letter-spacing: 0.4px;
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
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          font-size: 11.5px;
        }
        .meta-strip p {
          margin: 2px 0;
          color: #475569;
          word-break: break-word;
        }
        .meta-strip strong {
          color: #0f172a;
          font-weight: 700;
        }
        .meta-right {
          text-align: right;
        }
        .table-wrap {
          padding: 10px 16px;
          width: 100%;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        .items-table th {
          background: #f1f5f9;
          padding: 8px 8px;
          text-align: left;
          font-size: 10.5px;
          font-weight: 700;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }
        .item-row {
          border-bottom: 1px solid #f1f5f9;
        }
        .col-index {
          padding: 9px 6px;
          text-align: center;
          color: #94a3b8;
          font-size: 11px;
          width: 28px;
        }
        .col-item {
          padding: 9px 6px;
        }
        .item-title {
          font-weight: 700;
          color: #0f172a;
          font-size: 13px;
          line-height: 1.3;
        }
        .item-sub {
          font-size: 10.5px;
          color: #64748b;
          margin-top: 2px;
        }
        .mobile-imei-inline {
          display: none;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 10px;
          color: #475569;
          margin-top: 3px;
        }
        .col-imei {
          padding: 9px 6px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 11.5px;
          color: #334155;
        }
        .imei-secondary {
          font-size: 10px;
          color: #64748b;
        }
        .col-amount {
          padding: 9px 6px;
          text-align: right;
          font-weight: 800;
          color: #0f172a;
          font-size: 13px;
          white-space: nowrap;
        }
        .summary-card {
          margin: 4px 16px 14px 16px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .summary-title {
          font-size: 11px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .summary-total {
          font-size: 19px;
          font-weight: 900;
          color: #522D60;
          letter-spacing: -0.4px;
          white-space: nowrap;
        }
        .footer {
          padding: 12px 16px 16px 16px;
          border-top: 1px dashed #e2e8f0;
          text-align: center;
          color: #64748b;
          font-size: 10.5px;
          line-height: 1.5;
        }
        .footer strong {
          color: #334155;
        }

        /* Mobile Preview Refinements */
        @media (max-width: 480px) {
          body {
            padding: 4px;
          }
          .header {
            padding: 12px;
          }
          .header-logo {
            width: 34px;
            height: 34px;
          }
          .header-info h1 {
            font-size: 14px;
          }
          .header-info p {
            font-size: 10px;
          }
          .header-badge {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-top: 1px solid rgba(255, 255, 255, 0.15);
            padding-top: 8px;
            margin-top: 4px;
            text-align: left;
          }
          .invoice-date {
            margin-top: 0;
          }
          .meta-strip {
            padding: 8px 12px;
            font-size: 10.5px;
            gap: 6px;
          }
          .table-wrap {
            padding: 6px 10px;
          }
          .col-imei, .th-imei {
            display: none;
          }
          .mobile-imei-inline {
            display: block;
          }
          .item-title {
            font-size: 12px;
          }
          .col-amount {
            font-size: 12px;
          }
          .summary-card {
            margin: 4px 10px 10px 10px;
            padding: 10px 12px;
          }
          .summary-title {
            font-size: 10px;
          }
          .summary-total {
            font-size: 16px;
          }
          .footer {
            padding: 10px 12px 12px 12px;
            font-size: 9.5px;
          }
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
          .col-imei, .th-imei {
            display: table-cell !important;
          }
          .mobile-imei-inline {
            display: none !important;
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
          <div class="meta-right">
            <p><strong>Payment:</strong> ${billData.paymentMethod || 'Cash'}</p>
            ${shopInfo?.enableImeiCheck ? `<p><strong>Warranty:</strong> ${billData.warrantyLabel || billData.items?.[0]?.warrantyLabel || 'No Warranty'}</p>` : ''}
          </div>
        </div>

        <!-- Items Table -->
        <div class="table-wrap">
          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 28px; text-align: center;">#</th>
                <th>Item / Model</th>
                ${hasAnyImei ? `<th class="th-imei">IMEI Number</th>` : ''}
                <th style="text-align: right; width: 100px;">Amount</th>
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
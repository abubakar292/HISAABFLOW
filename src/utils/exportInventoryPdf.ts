import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

interface StockItem {
  id?: string;
  modelName: string;
  company: string;
  ramRom?: string;
  quantity: number;
  basePrice: number;
  totalValue: number;
}

interface ShopProfileInfo {
  shopName?: string;
  shortName?: string;
  subTitle?: string;
  address?: string;
  phone?: string;
}

/**
 * Directly generates and downloads a clean, vector PDF for Inventory Valuation.
 * 100% offline, synchronous, crisp typography, beautiful #522D60 branding.
 * Zero canvas rendering glitches, zero popup blocks.
 */
export function exportInventoryValuationPdf(
  stock: StockItem[],
  totalUnits: number,
  totalValue: number,
  shopInfo?: ShopProfileInfo
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2; // 182mm

  const shopName = shopInfo?.shopName || 'HisaabFlow POS';
  const subtitle = shopInfo?.subTitle ? `${shopInfo.subTitle} • ` : '';
  const phone = shopInfo?.phone ? `Tel: ${shopInfo.phone}` : '';
  const headerSubtitle = `${subtitle}${phone}`.trim();
  const address = shopInfo?.address || 'Mobile Market';

  const today = new Date();
  const dateStr = format(today, 'dd MMM yyyy, hh:mm a');

  // 1. Top Brand Banner (#522D60)
  doc.setFillColor(82, 45, 96); // #522D60
  doc.roundedRect(marginX, 12, contentWidth, 22, 3, 3, 'F');

  // Banner Text: Shop Name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(shopName.toUpperCase(), marginX + 6, 21);

  // Banner Text: Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(233, 213, 255); // light purple
  doc.text(headerSubtitle || 'Mobile Inventory & Cloud POS', marginX + 6, 28);

  // Banner Text: Right Badge
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(marginX + contentWidth - 56, 17, 50, 11, 2, 2, 'F');
  doc.setTextColor(82, 45, 96);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('VALUATION REPORT', marginX + contentWidth - 31, 23, { align: 'center' });
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(format(today, 'dd MMM yyyy'), marginX + contentWidth - 31, 26.5, { align: 'center' });

  // 2. Summary KPI Strip (y: 38)
  doc.setFillColor(248, 250, 252); // #f8fafc
  doc.setDrawColor(226, 232, 240); // #e2e8f0
  doc.roundedRect(marginX, 38, contentWidth, 14, 2, 2, 'FD');

  const colWidth = contentWidth / 3;

  // KPI 1: Generated Date
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('REPORT GENERATED', marginX + 6, 43);
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(dateStr, marginX + 6, 48.5);

  // KPI 2: Total Units
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL STOCK UNITS', marginX + colWidth + colWidth / 2, 43, { align: 'center' });
  doc.setFontSize(9.5);
  doc.setTextColor(82, 45, 96);
  doc.text(`${totalUnits.toLocaleString()} Units`, marginX + colWidth + colWidth / 2, 48.5, { align: 'center' });

  // KPI 3: Total Valuation
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('INVENTORY VALUATION', marginX + contentWidth - 6, 43, { align: 'right' });
  doc.setFontSize(10);
  doc.setTextColor(5, 150, 105); // emerald
  doc.text(`Rs. ${totalValue.toLocaleString()}`, marginX + contentWidth - 6, 48.5, { align: 'right' });

  // 3. Stock Items Table
  const tableHeaders = [['#', 'Model Description', 'Brand', 'Specs', 'Qty', 'Base Price', 'Total Value']];
  const tableRows = stock.map((item, idx) => [
    String(idx + 1),
    item.modelName || 'Mobile',
    item.company || '',
    item.ramRom || '-',
    String(item.quantity || 0),
    `Rs. ${(item.basePrice || 0).toLocaleString()}`,
    `Rs. ${(item.totalValue || 0).toLocaleString()}`,
  ]);

  // Grand Total Foot Row
  const footRow = [
    [
      '',
      'GRAND TOTAL',
      '',
      '',
      `${totalUnits.toLocaleString()}`,
      '-',
      `Rs. ${totalValue.toLocaleString()}`,
    ],
  ];

  const autoTableFn: any = (autoTable as any).default || autoTable;

  autoTableFn(doc, {
    startY: 56,
    head: tableHeaders,
    body: tableRows,
    foot: footRow,
    margin: { left: marginX, right: marginX, bottom: 18 },
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      textColor: [15, 23, 42],
      cellPadding: 2.4,
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [82, 45, 96],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
    },
    footStyles: {
      fillColor: [253, 251, 255],
      textColor: [82, 45, 96],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
      lineWidth: 0.3,
      lineColor: [82, 45, 96],
    },
    alternateRowStyles: {
      fillColor: [250, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center', textColor: [148, 163, 184] },
      1: { cellWidth: 50, fontStyle: 'bold' },
      2: { cellWidth: 32 },
      3: { cellWidth: 24, halign: 'center', textColor: [100, 116, 139] },
      4: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 24, halign: 'right' },
      6: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
    },
    didDrawPage: (data: any) => {
      // Clean footer on every page
      const pageCount = (doc.internal as any).getNumberOfPages();
      const currentPage = data.pageNumber;
      const pageHeight = doc.internal.pageSize.getHeight();

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);

      // Left footer
      doc.text(
        `Generated by HisaabFlow POS • ${shopName} (${address})`,
        marginX,
        pageHeight - 8
      );

      // Right footer: Page numbers
      doc.text(
        `Page ${currentPage} of ${pageCount}`,
        pageWidth - marginX,
        pageHeight - 8,
        { align: 'right' }
      );
    },
  });

  // Direct download to user's device
  const safeShopName = shopName.replace(/[^a-zA-Z0-9]/g, '_');
  const dateFilePart = format(today, 'yyyy-MM-dd');
  const fileName = `${safeShopName}_Inventory_Valuation_${dateFilePart}.pdf`;

  doc.save(fileName);
}

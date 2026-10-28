/**
 * Web Bluetooth & Thermal Printer Utility (ESC/POS)
 * Engineered for 58mm & 80mm Bluetooth mini thermal receipt printers.
 * Supports:
 * - Direct Web Bluetooth (Chrome Android, PC, Mac, Bluefy on iOS)
 * - RawBT Deep-Link / Intent for Android / iOS
 * - Clean Plain-Text Thermal Receipt for Copying & Sharing
 */

import { SHOP_CONFIG } from '../config/shopConfig';

export interface BluetoothPrinterDevice {
  device: any;
  server: any;
  characteristic: any;
}

// Common Bluetooth Serial Port / BLE Thermal Printer GATT UUIDs
// Covering standard ESC/POS, HM-10 UART (CC2541), ISSC, Star, Posnet, and Chinese OEM 58mm/80mm printers
export const PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Common ESC/POS thermal GATT
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 / CC2541 transparent UART (Very popular in 58mm mini printers)
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent UART
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Posnet / Star / ESC/POS
  '0000ff00-0000-1000-8000-00805f9b34fb', // Custom POS printer
  '0000fee7-0000-1000-8000-00805f9b34fb', // Tencent / Chinese BLE
  '0000af30-0000-1000-8000-00805f9b34fb',
  '0000ae00-0000-1000-8000-00805f9b34fb',
  '0000fff0-0000-1000-8000-00805f9b34fb',
  '0000fd00-0000-1000-8000-00805f9b34fb',
  '00001101-0000-1000-8000-00805f9b34fb', // Serial Port Profile
];

/**
 * Checks whether Web Bluetooth API is supported in the current browser
 */
export function isBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator && typeof (navigator as any).bluetooth?.requestDevice === 'function';
}

/**
 * Detects whether the current device is an iPhone, iPad, or iPod
 */
export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// Cached active connection during the app session
let activeBluetoothDevice: BluetoothPrinterDevice | null = null;

/**
 * Connect to a nearby Bluetooth mini thermal printer
 */
export async function connectBluetoothPrinter(): Promise<BluetoothPrinterDevice> {
  if (!isBluetoothSupported()) {
    throw new Error(
      'Web Bluetooth is not supported in this browser. Apple Safari on iPhone disables Web Bluetooth natively. To connect directly via Bluetooth on iPhone, open this app in "Bluefy - Web BLE Browser" (free on App Store), or use the "Share to Bluetooth Printer App" button!'
    );
  }

  // If already connected and active, return it
  if (activeBluetoothDevice && activeBluetoothDevice.device?.gatt?.connected) {
    return activeBluetoothDevice;
  }

  // Request Bluetooth device pairing prompt
  const device = await (navigator as any).bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: PRINTER_SERVICES
  });

  if (!device || !device.gatt) {
    throw new Error('No Bluetooth device selected.');
  }

  // Connect to GATT Server
  const server = await device.gatt.connect();

  // Find writable characteristic across all discovered primary services
  let characteristic: any = null;

  try {
    const services = await server.getPrimaryServices();
    for (const service of services) {
      try {
        const characteristics = await service.getCharacteristics();
        for (const c of characteristics) {
          if (c.properties.write || c.properties.writeWithoutResponse) {
            characteristic = c;
            break;
          }
        }
      } catch (err) {
        // Continue searching other services
      }
      if (characteristic) break;
    }
  } catch (err) {
    console.warn('Error fetching all primary services:', err);
  }

  // Fallback: try individual known services if getPrimaryServices was restricted
  if (!characteristic) {
    for (const serviceUuid of PRINTER_SERVICES) {
      try {
        const service = await server.getPrimaryService(serviceUuid);
        const chars = await service.getCharacteristics();
        for (const c of chars) {
          if (c.properties.write || c.properties.writeWithoutResponse) {
            characteristic = c;
            break;
          }
        }
        if (characteristic) break;
      } catch (e) {
        // Try next
      }
    }
  }

  if (!characteristic) {
    throw new Error('Connected to Bluetooth device, but could not find a writable print channel (ESC/POS UART). Please ensure the printer is turned on and in pairing mode.');
  }

  activeBluetoothDevice = { device, server, characteristic };

  // Listen for disconnect
  device.addEventListener('gattserverdisconnected', () => {
    activeBluetoothDevice = null;
  });

  return activeBluetoothDevice;
}

/**
 * Disconnect current Bluetooth printer
 */
export function disconnectBluetoothPrinter(): void {
  if (activeBluetoothDevice?.device?.gatt?.connected) {
    activeBluetoothDevice.device.gatt.disconnect();
  }
  activeBluetoothDevice = null;
}

/**
 * Convert receipt bill data into ESC/POS binary format for 58mm & 80mm thermal printers
 */
export function generateEscPosReceipt(billData: any, shopName = SHOP_CONFIG.name): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: number[] = [];

  const addBytes = (...bytes: number[]) => chunks.push(...bytes);
  const addText = (text: string) => {
    const encoded = encoder.encode(text);
    for (let i = 0; i < encoded.length; i++) {
      chunks.push(encoded[i]);
    }
  };

  // Initialize printer: ESC @ (0x1B, 0x40)
  addBytes(0x1B, 0x40);

  // Center alignment: ESC a 1 (0x1B, 0x61, 0x01)
  addBytes(0x1B, 0x61, 0x01);

  // Double height & double width for header: GS ! 0x11
  addBytes(0x1D, 0x21, 0x11);
  addBytes(0x1B, 0x45, 0x01); // Bold on
  addText(`${shopName.toUpperCase()}\n`);
  addBytes(0x1B, 0x45, 0x00); // Bold off

  // Normal text size: GS ! 0x00
  addBytes(0x1D, 0x21, 0x00);
  addText(`${SHOP_CONFIG.subTitle.toUpperCase()} • ${SHOP_CONFIG.shortName}\n`);
  if (SHOP_CONFIG.phone) {
    addText(`Tel: ${SHOP_CONFIG.phone}\n`);
  }
  addText('================================\n');
  addBytes(0x1B, 0x45, 0x01); // Bold on
  addText('SALES RECEIPT\n');
  addBytes(0x1B, 0x45, 0x00); // Bold off
  addText('--------------------------------\n');

  // Left alignment: ESC a 0
  addBytes(0x1B, 0x61, 0x00);

  const billNo = billData.billNumber || (billData.id ? billData.id.slice(0, 8).toUpperCase() : 'N/A');
  const dateStr = new Date().toLocaleDateString('en-GB');
  const timeStr = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  addText(`Bill #: ${billNo}\n`);
  addText(`Date  : ${dateStr} ${timeStr}\n`);
  addText(`Cust  : ${billData.customerName || 'Walk-in'}\n`);
  if (billData.customerPhone) {
    addText(`Phone : ${billData.customerPhone}\n`);
  }
  if (billData.registerPageNo) {
    addText(`Reg Pg: #${billData.registerPageNo}\n`);
  }
  addText(`Pay   : ${billData.paymentMethod || 'Cash'}\n`);
  addText('--------------------------------\n');

  // Items
  const items = billData.items && billData.items.length > 0 
    ? billData.items 
    : [{
        modelName: billData.itemName || billData.modelName || 'Mobile Phone',
        sellPrice: billData.sellPrice || billData.totalSellPrice || 0,
        imei1: billData.imei1 || '',
        imei2: billData.imei2 || '',
      }];

  items.forEach((item: any, idx: number) => {
    const name = `${item.company || ''} ${item.modelName || item.itemName || ''}`.trim();
    const price = `Rs. ${(item.sellPrice || 0).toLocaleString()}`;
    addBytes(0x1B, 0x45, 0x01); // Bold on
    addText(`${idx + 1}. ${name}\n`);
    addBytes(0x1B, 0x45, 0x00); // Bold off
    if (item.imei1) addText(`   IMEI1: ${item.imei1}\n`);
    if (item.imei2) addText(`   IMEI2: ${item.imei2}\n`);
    addText(`   Price: ${price}\n`);
  });

  addText('--------------------------------\n');

  // Total
  const total = Number(billData.totalSellPrice || billData.totalSellAmount || billData.sellPrice || 0);
  addBytes(0x1B, 0x45, 0x01); // Bold on
  addBytes(0x1D, 0x21, 0x01); // Double height
  addText(`TOTAL : Rs. ${total.toLocaleString()}\n`);
  addBytes(0x1D, 0x21, 0x00); // Normal
  addBytes(0x1B, 0x45, 0x00); // Bold off

  addText('================================\n');

  // Center alignment: ESC a 1
  addBytes(0x1B, 0x61, 0x01);
  addText('Thank You For Your Business!\n');
  addText('Visit Again Soon 😊\n');
  addText(`${shopName}\n\n\n\n`); // Feed lines

  // Cut paper: GS V 66 0 (if cutter supported)
  addBytes(0x1D, 0x56, 0x42, 0x00);

  return new Uint8Array(chunks);
}

/**
 * Generate formatted plain-text receipt (32-character thermal width)
 * Ideal for copying, sharing to Bluetooth printer apps (RawBT, ESC POS Print), or WhatsApp
 */
export function generatePlainTextReceipt(billData: any, shopName = SHOP_CONFIG.name): string {
  const billNo = billData.billNumber || (billData.id ? billData.id.slice(0, 8).toUpperCase() : 'N/A');
  const dateStr = new Date().toLocaleDateString('en-GB');
  const timeStr = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const items = billData.items && billData.items.length > 0 
    ? billData.items 
    : [{
        modelName: billData.itemName || billData.modelName || 'Mobile Phone',
        sellPrice: billData.sellPrice || billData.totalSellPrice || 0,
        imei1: billData.imei1 || '',
        imei2: billData.imei2 || '',
      }];

  const total = Number(billData.totalSellPrice || billData.totalSellAmount || billData.sellPrice || 0);

  let text = '';
  text += '================================\n';
  text += `      ${shopName.toUpperCase()}\n`;
  text += `   ${SHOP_CONFIG.subTitle.toUpperCase()} • ${SHOP_CONFIG.shortName}\n`;
  if (SHOP_CONFIG.phone) {
    text += `       Tel: ${SHOP_CONFIG.phone}\n`;
  }
  text += '================================\n';
  text += '         SALES RECEIPT          \n';
  text += '--------------------------------\n';
  text += `Bill #: ${billNo}\n`;
  text += `Date  : ${dateStr} ${timeStr}\n`;
  text += `Cust  : ${billData.customerName || 'Walk-in'}\n`;
  if (billData.customerPhone) {
    text += `Phone : ${billData.customerPhone}\n`;
  }
  if (billData.registerPageNo) {
    text += `Reg Pg: #${billData.registerPageNo}\n`;
  }
  text += `Pay   : ${billData.paymentMethod || 'Cash'}\n`;
  text += '--------------------------------\n';
  text += 'ITEMS:\n';

  items.forEach((item: any, idx: number) => {
    const name = `${item.company || ''} ${item.modelName || item.itemName || ''}`.trim();
    text += `${idx + 1}. ${name}\n`;
    if (item.imei1) text += `   IMEI 1: ${item.imei1}\n`;
    if (item.imei2) text += `   IMEI 2: ${item.imei2}\n`;
    text += `   Price : Rs. ${(item.sellPrice || 0).toLocaleString()}\n`;
  });

  text += '--------------------------------\n';
  text += `TOTAL : Rs. ${total.toLocaleString()}\n`;
  text += '================================\n';
  text += '  Thank You For Your Business!  \n';
  text += '        Visit Again Soon        \n';
  text += '================================\n';

  return text;
}

/**
 * Generate RawBT Deep Link URL for instant 1-tap print via RawBT Bluetooth app
 */
export function getRawBtDeepLink(billData: any): string {
  const plainText = generatePlainTextReceipt(billData);
  try {
    const base64Data = btoa(unescape(encodeURIComponent(plainText)));
    return `rawbt:data:text/plain;base64,${base64Data}`;
  } catch (e) {
    return `rawbt:data:text/plain,${encodeURIComponent(plainText)}`;
  }
}

/**
 * Send raw binary bytes to connected Bluetooth thermal printer in safe chunks
 */
export async function printToBluetoothDevice(deviceObj: BluetoothPrinterDevice, data: Uint8Array): Promise<void> {
  // Mini Bluetooth printer buffers are typically 64-128 bytes
  const CHUNK_SIZE = 64;
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    const chunk = data.slice(i, i + CHUNK_SIZE);
    if (deviceObj.characteristic.writeValueWithResponse) {
      await deviceObj.characteristic.writeValueWithResponse(chunk);
    } else {
      await deviceObj.characteristic.writeValueWithoutResponse(chunk);
    }
    // Small delay to prevent micro-buffer overflow on cheap mini thermal printers
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

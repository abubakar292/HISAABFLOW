import { collection, getDocs, doc, setDoc, getDoc, writeBatch, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SHOP_CONFIG } from '../config/shopConfig';
import { isDocForShop } from './multiTenantService';

export interface ShopBackupData {
  version: string;
  shopName: string;
  shopShortName: string;
  userId?: string;
  createdAt: string;
  summary: {
    mobilesCount: number;
    salesCount: number;
    billsCount?: number;
    khataCustomersCount: number;
    khataTransactionsCount: number;
    expensesCount: number;
  };
  data: {
    mobiles: any[];
    sales?: any[];
    mobileSales?: any[];
    bills?: any[];
    khata: any[];
    khataTransactions: any[];
    expenses: any[];
  };
}

export interface RestoreResult {
  success: boolean;
  restoredCount: {
    mobiles: number;
    sales: number;
    bills: number;
    khataCustomers: number;
    khataTransactions: number;
    expenses: number;
  };
  message: string;
}

// Drive Webhook URL can be set via env var or localStorage
export function getDriveWebhookUrl(): string {
  return (
    import.meta.env.VITE_DRIVE_BACKUP_WEBHOOK_URL ||
    localStorage.getItem('amz_drive_webhook_url') ||
    ''
  );
}

export function setDriveWebhookUrl(url: string): void {
  if (url) {
    localStorage.setItem('amz_drive_webhook_url', url.trim());
  } else {
    localStorage.removeItem('amz_drive_webhook_url');
  }
}

/**
 * Exports all shop data from Firestore into a structured JSON backup object
 * strictly scoped to the authenticated user.
 */
export async function createFullShopBackup(userId?: string, shopId?: string): Promise<ShopBackupData> {
  const getColDocs = (colName: string) => {
    return getDocs(collection(db, colName));
  };

  const [mobilesSnap, salesSnap, billsSnap, khataSnap, txSnap, expensesSnap] = await Promise.all([
    getColDocs('mobiles'),
    getColDocs('sales'),
    getColDocs('bills'),
    getColDocs('khata'),
    getColDocs('khataTransactions'),
    getColDocs('expenses'),
  ]);

  const filterDocs = (snap: any) => {
    const all = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    return shopId ? all.filter((d: any) => isDocForShop(d, shopId)) : all;
  };

  const mobiles = filterDocs(mobilesSnap);
  const sales = filterDocs(salesSnap);
  const bills = filterDocs(billsSnap);
  const khata = filterDocs(khataSnap);
  const khataTransactions = filterDocs(txSnap);
  const expenses = filterDocs(expensesSnap);

  const backup: ShopBackupData = {
    version: '2.0.0',
    shopName: SHOP_CONFIG.name,
    shopShortName: SHOP_CONFIG.shortName,
    userId,
    createdAt: new Date().toISOString(),
    summary: {
      mobilesCount: mobiles.length,
      salesCount: sales.length,
      billsCount: bills.length,
      khataCustomersCount: khata.length,
      khataTransactionsCount: khataTransactions.length,
      expensesCount: expenses.length,
    },
    data: {
      mobiles,
      sales,
      mobileSales: sales, // Backwards compatibility alias
      bills,
      khata,
      khataTransactions,
      expenses,
    },
  };

  // 1. Always store the master latest snapshot in Firestore under user-scoped doc
  try {
    const backupDocRef = userId ? doc(db, 'backups', userId) : doc(db, 'backups', 'latest_ArshadMobileBackup');
    await setDoc(backupDocRef, {
      ...backup,
      userId,
      updatedAt: backup.createdAt,
    });
  } catch (err) {
    console.warn('Firestore backup doc warning:', err);
  }

  // 2. If Google Drive Webhook URL is configured, push to Google Drive to update ArshadMobileBackup.json
  const webhookUrl = getDriveWebhookUrl();
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' }, // Avoid CORS preflight with text/plain for Google Apps Script
        body: JSON.stringify(backup),
        mode: 'no-cors',
      });
    } catch (err) {
      console.warn('Drive Webhook push notice:', err);
    }
  }

  // Save last backup timestamp to localStorage
  localStorage.setItem('amz_last_backup_time', backup.createdAt);

  return backup;
}

/**
 * Triggers a direct JSON download of the shop's single backup file
 */
export function downloadBackupFile(backup: ShopBackupData) {
  const jsonString = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  // Standardized file name: "AMZ_Shop_Backup.json" (single file for the shop)
  const filename = `${SHOP_CONFIG.shortName}_Shop_Backup.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Gets the last recorded backup time from localStorage
 */
export function getLastBackupTime(): string | null {
  return localStorage.getItem('amz_last_backup_time');
}

/**
 * Retrieves the latest cloud backup stored in Firestore for the given user
 */
export async function getLatestCloudBackup(userId?: string): Promise<ShopBackupData | null> {
  try {
    const backupDocRef = userId ? doc(db, 'backups', userId) : doc(db, 'backups', 'latest_ArshadMobileBackup');
    const docSnap = await getDoc(backupDocRef);
    if (docSnap.exists()) {
      return docSnap.data() as ShopBackupData;
    }
  } catch (err) {
    console.warn('Failed to fetch latest cloud backup doc:', err);
  }
  return null;
}

/**
 * Sanitizes and converts date representations for Firestore restoration
 */
function sanitizeDocForRestore(data: any): any {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeDocForRestore);

  // Firestore serialized timestamp object { seconds, nanoseconds }
  if (typeof data.seconds === 'number') {
    return new Date(data.seconds * 1000);
  }

  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === 'id') continue; // ID belongs to doc reference, not doc data
    if (value && typeof value === 'object' && typeof (value as any).seconds === 'number') {
      clean[key] = new Date((value as any).seconds * 1000);
    } else if (
      typeof value === 'string' &&
      (key.toLowerCase().includes('date') || key.toLowerCase().includes('createdat') || key.toLowerCase().includes('updatedat')) &&
      !isNaN(Date.parse(value))
    ) {
      clean[key] = new Date(value);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      clean[key] = sanitizeDocForRestore(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * Restores full shop data into Firestore from a backup data object,
 * ensuring all restored documents belong strictly to the authenticated user.
 */
export async function restoreShopBackup(
  backup: ShopBackupData,
  userId?: string,
  shopId?: string,
  userEmail?: string
): Promise<RestoreResult> {
  if (!backup || (!backup.data && !backup.summary)) {
    throw new Error('Invalid backup file format. Missing data or summary.');
  }

  const data: Record<string, any[]> = (backup.data || {}) as Record<string, any[]>;
  const mobiles = Array.isArray(data.mobiles) ? data.mobiles : [];
  const sales = Array.isArray(data.sales) ? data.sales : (Array.isArray(data.mobileSales) ? data.mobileSales : []);
  const bills = Array.isArray(data.bills) ? data.bills : [];
  const khata = Array.isArray(data.khata) ? data.khata : [];
  const khataTransactions = Array.isArray(data.khataTransactions) ? data.khataTransactions : [];
  const expenses = Array.isArray(data.expenses) ? data.expenses : [];

  const restoreCollection = async (colName: string, items: any[]): Promise<number> => {
    if (!items || items.length === 0) return 0;
    const CHUNK_SIZE = 400;
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      const chunk = items.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const item of chunk) {
        const docId = String(item.id || doc(collection(db, colName)).id);
        const sanitized = sanitizeDocForRestore(item);
        const docData: Record<string, any> = {
          ...sanitized,
          ...(userId && userId !== 'clear_and_replace' ? { userId } : {}),
          ...(shopId ? { shopId } : {}),
          ...(userEmail ? { userEmail: userEmail.toLowerCase().trim() } : {}),
        };
        batch.set(doc(db, colName, docId), docData, { merge: true });
      }
      await batch.commit();
    }
    return items.length;
  };

  const [mobilesCount, salesCount, billsCount, khataCount, txCount, expensesCount] = await Promise.all([
    restoreCollection('mobiles', mobiles),
    restoreCollection('sales', sales),
    restoreCollection('bills', bills),
    restoreCollection('khata', khata),
    restoreCollection('khataTransactions', khataTransactions),
    restoreCollection('expenses', expenses),
  ]);

  return {
    success: true,
    restoredCount: {
      mobiles: mobilesCount,
      sales: salesCount,
      bills: billsCount,
      khataCustomers: khataCount,
      khataTransactions: txCount,
      expenses: expensesCount,
    },
    message: `Restored ${mobilesCount} mobiles, ${salesCount} sales, ${billsCount} bills, ${khataCount} khata customers, ${txCount} ledger transactions, and ${expensesCount} expenses.`,
  };
}


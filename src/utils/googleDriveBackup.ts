import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ShopProfile, isDocForShop } from './multiTenantService';

export interface BackupSyncResult {
  fileId: string;
  fileName: string;
  webViewLink?: string;
  modifiedTime: string;
  totalRecords: number;
}

/**
 * Compiles all data strictly belonging to the specified shop into a structured backup archive.
 */
export async function compileShopBackupData(shopProfile: ShopProfile) {
  const shopId = shopProfile.shopId;
  const collections = ['mobiles', 'sales', 'bills', 'khata', 'khataTransactions', 'expenses'];
  const archive: Record<string, any[]> = {};
  let totalRecords = 0;

  for (const col of collections) {
    try {
      const snap = await getDocs(collection(db, col));
      const docs = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(doc => isDocForShop(doc, shopId));
      archive[col] = docs;
      totalRecords += docs.length;
    } catch (err) {
      console.warn(`Error compiling backup for ${col}:`, err);
      archive[col] = [];
    }
  }

  return {
    meta: {
      appName: 'Mobile Shop Management System',
      version: '2.0-multitenant',
      shopId: shopProfile.shopId,
      shopName: shopProfile.shopName,
      shortName: shopProfile.shortName,
      ownerEmail: shopProfile.ownerEmail,
      ownerPhone: shopProfile.phone,
      exportedAt: new Date().toISOString(),
      totalRecords,
    },
    shopProfile,
    data: archive,
  };
}

/**
 * Downloads the shop data locally as a formatted JSON file.
 */
export async function downloadShopBackupLocally(shopProfile: ShopProfile): Promise<number> {
  const backup = await compileShopBackupData(shopProfile);
  const jsonStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const cleanName = (shopProfile.shopName || 'Shop').replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${cleanName}_Backup_${dateStr}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return backup.meta.totalRecords;
}

/**
 * Syncs the current shop's complete backup archive directly to the Master Google Drive
 * into a dedicated file named "[Shop Name] Backup.json", updating existing files in-place.
 */
export async function syncShopBackupToGoogleDrive(
  shopProfile: ShopProfile,
  accessToken: string
): Promise<BackupSyncResult> {
  if (!accessToken) {
    throw new Error('Google Drive authorization is missing. Please ensure Master Drive is connected.');
  }

  const backupData = await compileShopBackupData(shopProfile);
  const cleanShopName = (shopProfile.shopName || 'Shop').trim();
  const fileName = `${cleanShopName} Backup.json`;
  const fileContent = JSON.stringify(backupData, null, 2);

  let targetFileId: string | null = null;
  let targetWebViewLink: string | undefined = undefined;

  // 1. If shopProfile already has a known googleDriveBackupFileId, verify it exists in Drive
  if (shopProfile.googleDriveBackupFileId) {
    try {
      const checkRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${shopProfile.googleDriveBackupFileId}?fields=id,name,webViewLink,trashed`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (checkRes.ok) {
        const fileInfo = await checkRes.json();
        if (!fileInfo.trashed) {
          targetFileId = fileInfo.id;
          targetWebViewLink = fileInfo.webViewLink;
        }
      }
    } catch (e) {
      console.warn('Could not verify existing backup file ID, falling back to name search:', e);
    }
  }

  // 2. If no valid file ID yet, search for file by exact shop name in Drive
  if (!targetFileId) {
    const queryParam = encodeURIComponent(`name = '${fileName}' and trashed = false`);
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${queryParam}&fields=files(id,name,webViewLink,modifiedTime)&spaces=drive`;

    const searchRes = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!searchRes.ok) {
      const errorText = await searchRes.text();
      throw new Error(`Google Drive search failed (${searchRes.status}): ${errorText}`);
    }

    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      targetFileId = searchData.files[0].id;
      targetWebViewLink = searchData.files[0].webViewLink;
    }
  }

  // 3. If file exists, UPDATE in-place via PATCH (no duplicates created)
  if (targetFileId) {
    const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${targetFileId}?uploadType=media`;
    const updateRes = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: fileContent,
    });

    if (!updateRes.ok) {
      const errorText = await updateRes.text();
      throw new Error(`Google Drive update failed (${updateRes.status}): ${errorText}`);
    }

    return {
      fileId: targetFileId,
      fileName,
      webViewLink: targetWebViewLink,
      modifiedTime: new Date().toISOString(),
      totalRecords: backupData.meta.totalRecords,
    };
  }

  // 4. File does not exist yet for this shop, create new file via multipart upload
  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    description: `Automated cloud backup for ${cleanShopName} generated on ${new Date().toLocaleDateString()}`,
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    fileContent +
    closeDelimiter;

  const createUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,modifiedTime';
  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartRequestBody,
  });

  if (!createRes.ok) {
    const errorText = await createRes.text();
    throw new Error(`Google Drive create file failed (${createRes.status}): ${errorText}`);
  }

  const createdData = await createRes.json();
  return {
    fileId: createdData.id,
    fileName: createdData.name || fileName,
    webViewLink: createdData.webViewLink,
    modifiedTime: createdData.modifiedTime || new Date().toISOString(),
    totalRecords: backupData.meta.totalRecords,
  };
}

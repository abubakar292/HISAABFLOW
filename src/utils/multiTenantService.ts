import { collection, getDocs, doc, getDoc, setDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getInitials, updateAppBranding } from './brandIdentity';

export interface ShopProfile {
  shopId: string;
  ownerUid: string;
  ownerEmail: string;
  shopName: string;
  shortName: string;
  ownerName: string;
  phone: string;
  secondaryPhone?: string;
  address: string;
  subTitle?: string;
  receiptNote?: string;
  whatsappFooter?: string;
  logoUrl?: string;
  avatarUrl?: string;
  lastBackupTime?: string;
  googleDriveBackupFileId?: string;
  createdAt?: any;
  updatedAt?: any;
}

export const ARSHAD_SHOP_ID = 'arshad-mobile-zone';

export const DEFAULT_ARSHAD_PROFILE: ShopProfile = {
  shopId: ARSHAD_SHOP_ID,
  ownerUid: 'tLkiSnO7Q2ee8uNnrwg0X7AZPdq1',
  ownerEmail: 'arshadkhan122aaty@gmail.com',
  shopName: 'Arshad Mobile Zone',
  shortName: 'AMZ',
  ownerName: 'Arshad Khan',
  phone: '0300-0000000',
  secondaryPhone: '',
  address: 'Bara Bazar, Khyber',
  subTitle: 'Bara Bazar Khyber',
  receiptNote: 'Warranty claim requires original bill slip. Thank you for your business!',
  whatsappFooter: 'ارشد موبائل زون (AMZ) باڑہ بازار، خیبر',
  logoUrl: '',
  avatarUrl: '',
};

export const EMPTY_SHOP_PROFILE: ShopProfile = {
  shopId: '',
  ownerUid: '',
  ownerEmail: '',
  shopName: '',
  shortName: 'HF',
  ownerName: '',
  phone: '',
  secondaryPhone: '',
  address: '',
  subTitle: '',
  receiptNote: '',
  whatsappFooter: '',
  logoUrl: '',
  avatarUrl: '',
};

/**
 * Checks whether a Firestore document belongs to the active shop.
 * Handles the vital Arshad legacy rule: any record without a `shopId`
 * is treated as belonging to Arshad Mobile Zone.
 */
export function isDocForShop(docData: any, activeShopId: string): boolean {
  if (!docData || !activeShopId) return false;
  
  if (activeShopId === ARSHAD_SHOP_ID) {
    // If viewing Arshad: matches if explicitly arshad OR if legacy document with no shopId
    return !docData.shopId || docData.shopId === ARSHAD_SHOP_ID;
  }

  // Other shops (e.g. Usman Afridi): must strictly match their shopId
  return docData.shopId === activeShopId;
}

/**
 * Attaches the current shopId and audit metadata to an outgoing Firestore mutation payload.
 */
export function attachShopScope<T extends Record<string, any>>(
  payload: T,
  shopProfile: ShopProfile | null,
  user?: any
): T & { shopId: string; userId: string; userEmail: string } {
  const shopId = shopProfile?.shopId || ARSHAD_SHOP_ID;
  return {
    ...payload,
    shopId,
    userId: user?.uid || '',
    userEmail: user?.email || '',
  };
}

/**
 * Loads or initializes the shop profile for the given user.
 */
export async function getShopProfile(
  uid: string,
  email: string,
  displayName?: string
): Promise<ShopProfile> {
  if (!uid) return EMPTY_SHOP_PROFILE;

  try {
    const shopRef = doc(db, 'shops', uid);
    const snap = await getDoc(shopRef);

    if (snap.exists()) {
      const data = snap.data() as ShopProfile;
      const resolvedName = data.shopName || displayName || (email ? email.split('@')[0] : 'Mobile Center');
      const profile: ShopProfile = {
        ...EMPTY_SHOP_PROFILE,
        ...data,
        shopId: data.shopId || `shop_${uid.slice(0, 8)}`,
        shopName: resolvedName,
        shortName: data.shortName || getInitials(resolvedName),
        ownerUid: uid,
        ownerEmail: email || data.ownerEmail,
      };
      updateAppBranding(profile.shopName, profile.shortName);
      return profile;
    }

    // Determine initial profile
    const isArshadAccount = email.toLowerCase().includes('arshad');
    const isSuperAdmin = email.toLowerCase() === 'threadsandtailsshop@gmail.com';

    let initialProfile: ShopProfile;

    if (isSuperAdmin) {
      initialProfile = {
        shopId: `shop_${uid.slice(0, 8)}`,
        ownerUid: uid,
        ownerEmail: email,
        shopName: 'Super Admin',
        shortName: 'SA',
        ownerName: 'Super Admin',
        phone: '0300-0000000',
        secondaryPhone: '',
        address: 'Headquarters',
        subTitle: 'System Administration',
        receiptNote: '',
        whatsappFooter: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
    } else if (isArshadAccount) {
      initialProfile = {
        ...DEFAULT_ARSHAD_PROFILE,
        ownerUid: uid,
        ownerEmail: email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
    } else {
      const shopName = displayName && displayName.trim().length > 0 
        ? displayName 
        : 'Mobile Center';
      const initials = getInitials(shopName);

      initialProfile = {
        shopId: `shop_${uid.slice(0, 8)}`,
        ownerUid: uid,
        ownerEmail: email,
        shopName,
        shortName: initials,
        ownerName: displayName || 'Shop Owner',
        phone: '0300-0000000',
        secondaryPhone: '',
        address: 'Main Market',
        subTitle: 'Mobile Sales & Services',
        receiptNote: 'Warranty claim requires original bill slip. Thank you for your business!',
        whatsappFooter: `${shopName} — Main Market`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
    }

    await setDoc(shopRef, initialProfile, { merge: true });
    updateAppBranding(initialProfile.shopName, initialProfile.shortName);
    return initialProfile;
  } catch (err) {
    console.error('Error in getShopProfile:', err);
    return DEFAULT_ARSHAD_PROFILE;
  }
}

/**
 * Updates the user's shop profile in Firestore and syncs name changes to `users`.
 */
export async function updateShopProfile(uid: string, data: Partial<ShopProfile>): Promise<void> {
  if (!uid) return;
  const shopRef = doc(db, 'shops', uid);

  let shortName = data.shortName;
  if (data.shopName && !shortName) {
    shortName = getInitials(data.shopName);
  }

  const payload: Partial<ShopProfile> = {
    ...data,
    ...(shortName ? { shortName } : {}),
    updatedAt: serverTimestamp(),
  };

  await setDoc(shopRef, payload, { merge: true });

  // Also sync shopName and ownerName to the `users` collection so Admin Panel is always 100% synced
  const userSyncPayload: Record<string, any> = { updatedAt: serverTimestamp() };
  if (data.shopName) userSyncPayload.shopName = data.shopName;
  if (data.ownerName) userSyncPayload.name = data.ownerName;
  await setDoc(doc(db, 'users', uid), userSyncPayload, { merge: true }).catch(() => {});

  if (data.shopName || shortName) {
    updateAppBranding(data.shopName || '', shortName);
  }
}

/**
 * Background helper that safely tags unassigned historical documents
 * to Arshad Mobile Zone (`shopId: 'arshad-mobile-zone'`).
 */
export async function ensureLegacyDataLinkedToArshad(): Promise<number> {
  const collections = ['mobiles', 'sales', 'bills', 'khata', 'khataTransactions', 'expenses'];
  let totalMigrated = 0;

  for (const colName of collections) {
    try {
      const snap = await getDocs(collection(db, colName));
      const unassigned = snap.docs.filter(d => {
        const data = d.data();
        return !data.shopId;
      });

      if (unassigned.length > 0) {
        const chunkSize = 350;
        for (let i = 0; i < unassigned.length; i += chunkSize) {
          const chunk = unassigned.slice(i, i + chunkSize);
          const batch = writeBatch(db);
          chunk.forEach(d => {
            batch.update(doc(db, colName, d.id), {
              shopId: ARSHAD_SHOP_ID,
            });
          });
          await batch.commit();
          totalMigrated += chunk.length;
        }
      }
    } catch (err) {
      console.warn(`Could not stamp legacy records for ${colName}:`, err);
    }
  }

  return totalMigrated;
}

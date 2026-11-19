import { collection, getDocs, doc, getDoc, setDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getInitials, updateAppBranding } from './brandIdentity';

export type SubscriptionStatus =
  | 'free'
  | 'unselected'
  | 'trial'
  | 'pending_approval'
  | 'active'
  | 'expired';

export interface SubscriptionSettings {
  monthlyPricePkr: number;
  trialDays: number;
  easypaisaTitle: string;
  easypaisaNumber: string;
  jazzcashTitle: string;
  jazzcashNumber: string;
  bankName: string;
  bankAccountTitle: string;
  bankAccountNumber: string;
  whatsappSupportNumber?: string;
  updatedAt?: string;
}

export const DEFAULT_SUBSCRIPTION_SETTINGS: SubscriptionSettings = {
  monthlyPricePkr: 1999,
  trialDays: 3,
  easypaisaTitle: 'HisaabFlow Official',
  easypaisaNumber: '0300-0000000',
  jazzcashTitle: 'HisaabFlow Official',
  jazzcashNumber: '0300-0000000',
  bankName: 'Meezan Bank',
  bankAccountTitle: 'HisaabFlow Technologies',
  bankAccountNumber: 'PK00MEZN0000000000000000',
  whatsappSupportNumber: '',
};

export interface SubscriptionRequest {
  id: string;
  shopId: string;
  ownerUid: string;
  ownerEmail: string;
  shopName: string;
  ownerName: string;
  amountPkr: number;
  paymentMethod: 'Easypaisa' | 'JazzCash' | 'Bank Transfer';
  senderAccountName: string;
  senderAccountNumber: string;
  transactionIdLast6: string;
  screenshotDataUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  grantedDays?: number;
  rejectionReason?: string;
  submittedAt: string;
  reviewedAt?: string;
}

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
  autoBackupEnabled?: boolean;
  pinEnabled?: boolean;
  pinCodeHash?: string;
  enableImeiCheck?: boolean;
  enableSupplierKhata?: boolean;
  subscriptionStatus?: SubscriptionStatus;
  trialStartedAt?: string;
  trialEndsAt?: string;
  trialUsed?: boolean;
  subscriptionStartedAt?: string;
  subscriptionEndsAt?: string;
  subscriptionPlanPrice?: number;
  lastPaymentRequestId?: string;
  rejectionReason?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface SubscriptionAccessEvaluation {
  isLocked: boolean;
  effectiveStatus: SubscriptionStatus;
  remainingMs: number;
  remainingText: string;
  expiredReason?: 'trial_ended' | 'subscription_ended' | 'admin_locked';
}

export function evaluateSubscriptionAccess(
  profile: Partial<ShopProfile> | null | undefined,
  isMasterAdmin = false
): SubscriptionAccessEvaluation {
  if (isMasterAdmin) {
    return {
      isLocked: false,
      effectiveStatus: 'free',
      remainingMs: Infinity,
      remainingText: 'Super Admin',
    };
  }

  const email = (profile?.ownerEmail || '').toLowerCase().trim();
  if (email === 'threadsandtailsshop@gmail.com' || email === 'admin@hisaabflow.com') {
    return {
      isLocked: false,
      effectiveStatus: 'free',
      remainingMs: Infinity,
      remainingText: 'Super Admin',
    };
  }

  const rawStatus: SubscriptionStatus = profile?.subscriptionStatus || 'free';
  const now = Date.now();

  const formatRemaining = (ms: number): string => {
    if (ms <= 0) return 'Expired';
    const totalHours = Math.ceil(ms / (1000 * 60 * 60));
    if (totalHours < 48) {
      return `${totalHours} ${totalHours === 1 ? 'hr' : 'hrs'} left`;
    }
    const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
    return `${days} ${days === 1 ? 'day' : 'days'} left`;
  };

  if (rawStatus === 'free') {
    return {
      isLocked: false,
      effectiveStatus: 'free',
      remainingMs: Infinity,
      remainingText: 'Free Access',
    };
  }

  if (rawStatus === 'trial') {
    const endsMs = profile?.trialEndsAt ? new Date(profile.trialEndsAt).getTime() : 0;
    if (endsMs && !isNaN(endsMs) && now < endsMs) {
      const rem = endsMs - now;
      return {
        isLocked: false,
        effectiveStatus: 'trial',
        remainingMs: rem,
        remainingText: `Trial (${formatRemaining(rem)})`,
      };
    }
    return {
      isLocked: true,
      effectiveStatus: 'expired',
      remainingMs: 0,
      remainingText: 'Trial Expired',
      expiredReason: 'trial_ended',
    };
  }

  if (rawStatus === 'active') {
    const endsMs = profile?.subscriptionEndsAt ? new Date(profile.subscriptionEndsAt).getTime() : 0;
    if (endsMs && !isNaN(endsMs) && now < endsMs) {
      const rem = endsMs - now;
      return {
        isLocked: false,
        effectiveStatus: 'active',
        remainingMs: rem,
        remainingText: `Paid (${formatRemaining(rem)})`,
      };
    }
    return {
      isLocked: true,
      effectiveStatus: 'expired',
      remainingMs: 0,
      remainingText: 'Subscription Expired',
      expiredReason: 'subscription_ended',
    };
  }

  if (rawStatus === 'pending_approval') {
    return {
      isLocked: true,
      effectiveStatus: 'pending_approval',
      remainingMs: 0,
      remainingText: 'Pending Approval',
    };
  }

  if (rawStatus === 'expired') {
    return {
      isLocked: true,
      effectiveStatus: 'expired',
      remainingMs: 0,
      remainingText: 'Payment Required',
      expiredReason: profile?.trialUsed ? 'trial_ended' : 'admin_locked',
    };
  }

  // 'unselected'
  return {
    isLocked: true,
    effectiveStatus: 'unselected',
    remainingMs: 0,
    remainingText: 'Plan Selection Required',
  };
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
  subscriptionStatus: 'free',
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
  enableImeiCheck: false,
  enableSupplierKhata: false,
  subscriptionStatus: 'free',
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
        subscriptionStatus: data.subscriptionStatus || 'free',
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
        subscriptionStatus: 'free',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
    } else if (isArshadAccount) {
      initialProfile = {
        ...DEFAULT_ARSHAD_PROFILE,
        ownerUid: uid,
        ownerEmail: email,
        subscriptionStatus: 'free',
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
        subscriptionStatus: 'unselected',
        trialUsed: false,
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

  // Also sync shopName, ownerName, PIN, and subscription settings to the `users` collection so Admin Panel and cross-device auth stay 100% synced
  const userSyncPayload: Record<string, any> = { updatedAt: serverTimestamp() };
  if (data.shopName) userSyncPayload.shopName = data.shopName;
  if (data.ownerName) userSyncPayload.name = data.ownerName;
  if (data.pinEnabled !== undefined) userSyncPayload.pinEnabled = data.pinEnabled;
  if (data.pinCodeHash !== undefined) userSyncPayload.pinCodeHash = data.pinCodeHash;
  if (data.subscriptionStatus !== undefined) userSyncPayload.subscriptionStatus = data.subscriptionStatus;
  if (data.trialStartedAt !== undefined) userSyncPayload.trialStartedAt = data.trialStartedAt;
  if (data.trialEndsAt !== undefined) userSyncPayload.trialEndsAt = data.trialEndsAt;
  if (data.trialUsed !== undefined) userSyncPayload.trialUsed = data.trialUsed;
  if (data.subscriptionStartedAt !== undefined) userSyncPayload.subscriptionStartedAt = data.subscriptionStartedAt;
  if (data.subscriptionEndsAt !== undefined) userSyncPayload.subscriptionEndsAt = data.subscriptionEndsAt;
  if (data.subscriptionPlanPrice !== undefined) userSyncPayload.subscriptionPlanPrice = data.subscriptionPlanPrice;
  if (data.lastPaymentRequestId !== undefined) userSyncPayload.lastPaymentRequestId = data.lastPaymentRequestId;
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

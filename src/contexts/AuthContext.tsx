import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, deleteDoc, collection, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import {
  ShopProfile,
  getShopProfile,
  updateShopProfile,
  DEFAULT_ARSHAD_PROFILE,
  EMPTY_SHOP_PROFILE,
  ensureLegacyDataLinkedToArshad,
  ARSHAD_SHOP_ID,
} from '../utils/multiTenantService';
import { getInitials, updateAppBranding } from '../utils/brandIdentity';
import { getGoogleDriveAccessToken, getMasterDriveToken } from '../utils/googleAuthHelper';

export const MASTER_ADMIN_EMAILS = [
  'threadsandtailsshop@gmail.com',
  'admin@hisaabflow.com',
];

export const MASTER_ADMIN_PASSWORDS = [
  'admin786',
  'HisaabFlow@786',
  'admin1000',
];

interface AuthContextType {
  user: User | null;
  shopProfile: ShopProfile;
  currentShopId: string;
  loading: boolean;
  googleAccessToken: string | null;
  isMasterAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  connectGoogleDrive: (forcePrompt?: boolean) => Promise<string>;
  logout: () => Promise<void>;
  updateProfileData: (data: Partial<ShopProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

let cachedDriveToken: string | null = null;

const getInitialProfile = (): ShopProfile => {
  try {
    const cachedShopId = localStorage.getItem('cached_shop_id');
    const cachedName = localStorage.getItem('cached_shop_name');
    const cachedShort = localStorage.getItem('cached_shop_short_name');
    const cachedSub = localStorage.getItem('cached_shop_subtitle');
    if (cachedShopId && cachedName) {
      return {
        ...EMPTY_SHOP_PROFILE,
        shopId: cachedShopId,
        shopName: cachedName,
        shortName: cachedShort || 'HF',
        subTitle: cachedSub || '',
      };
    }
  } catch (e) {
    // ignore
  }
  return EMPTY_SHOP_PROFILE;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      if ((auth as any)?.currentUser) {
        return (auth as any).currentUser;
      }
      if (localStorage.getItem('master_admin_session') === 'true') {
        return {
          uid: 'master_admin',
          email: 'threadsandtailsshop@gmail.com',
          displayName: 'Super Admin',
        } as unknown as User;
      }
    } catch (e) {
      // ignore
    }
    return null;
  });

  const [shopProfile, setShopProfile] = useState<ShopProfile>(getInitialProfile);
  const [loading, setLoading] = useState(true);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);

  /**
   * Purges any older duplicate documents in `users` or `shops` that have the same email
   * but a different (stale/deleted) Firebase Auth UID.
   */
  async function purgeStaleEmailDocs(email: string, activeUid: string) {
    if (!email) return;
    try {
      const usersQ = query(collection(db, 'users'), where('email', '==', email));
      const usersSnap = await getDocs(usersQ);
      for (const d of usersSnap.docs) {
        if (d.id !== activeUid) {
          await deleteDoc(doc(db, 'users', d.id)).catch(() => {});
          await deleteDoc(doc(db, 'shops', d.id)).catch(() => {});
        }
      }

      const shopsQ = query(collection(db, 'shops'), where('ownerEmail', '==', email));
      const shopsSnap = await getDocs(shopsQ);
      for (const d of shopsSnap.docs) {
        if (d.id !== activeUid) {
          await deleteDoc(doc(db, 'shops', d.id)).catch(() => {});
          await deleteDoc(doc(db, 'users', d.id)).catch(() => {});
        }
      }
    } catch (e) {
      // ignore query errors
    }
  }

  async function ensureUserDoc(firebaseUser: User, name?: string): Promise<boolean> {
    try {
      if (firebaseUser.isAnonymous || !firebaseUser.email) return false;

      const email = firebaseUser.email.toLowerCase().trim();
      const userRef = doc(db, 'users', firebaseUser.uid);
      const snap = await getDoc(userRef);

      // Clean up any older duplicate UIDs for this same email
      await purgeStaleEmailDocs(email, firebaseUser.uid);

      const resolvedName = MASTER_ADMIN_EMAILS.includes(email)
        ? 'Super Admin'
        : (name || snap.data()?.name || firebaseUser.displayName || email.split('@')[0] || 'Shop Client');

      const userData: Record<string, any> = {
        uid: firebaseUser.uid,
        email: email,
        name: resolvedName,
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (firebaseUser.refreshToken) {
        userData.refreshToken = firebaseUser.refreshToken;
      }

      if (!snap.exists()) {
        userData.createdAt = serverTimestamp();
        userData.role = MASTER_ADMIN_EMAILS.includes(email) ? 'superadmin' : 'admin';
        userData.status = 'active';
      }

      await setDoc(userRef, userData, { merge: true });

      // Ensure shops document also exists with clean defaults
      const shopRef = doc(db, 'shops', firebaseUser.uid);
      const shopSnap = await getDoc(shopRef);
      if (!shopSnap.exists()) {
        const initials = getInitials(resolvedName || 'Mobile Center');
        await setDoc(shopRef, {
          shopId: `shop_${firebaseUser.uid.slice(0, 8)}`,
          ownerUid: firebaseUser.uid,
          ownerEmail: email,
          ownerName: resolvedName,
          shopName: resolvedName,
          shortName: initials,
          phone: '',
          secondaryPhone: '',
          address: 'Main Market',
          subTitle: 'Mobile Sales & Services',
          receiptNote: 'Warranty claim requires original bill slip. Thank you for your business!',
          whatsappFooter: `${resolvedName} — Main Market`,
          status: 'active',
          paidMonths: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } else if (email) {
        await setDoc(shopRef, { ownerEmail: email, updatedAt: serverTimestamp() }, { merge: true });
      }
      return true;
    } catch (err) {
      console.warn('Error in ensureUserDoc:', err);
      return true;
    }
  }

  const loadUserProfile = async (firebaseUser: User, customName?: string) => {
    try {
      if (firebaseUser.isAnonymous) return;
      const isValid = await ensureUserDoc(firebaseUser, customName);
      if (!isValid) return;

      const profile = await getShopProfile(
        firebaseUser.uid,
        firebaseUser.email || '',
        customName || firebaseUser.displayName || ''
      );
      setShopProfile(profile);

      try {
        localStorage.setItem('cached_shop_id', profile.shopId);
        localStorage.setItem('cached_shop_name', profile.shopName);
        localStorage.setItem('cached_shop_short_name', profile.shortName);
        if (profile.subTitle) localStorage.setItem('cached_shop_subtitle', profile.subTitle);
      } catch (e) {
        // ignore
      }
      updateAppBranding(profile.shopName, profile.shortName);

      if (profile.shopId === ARSHAD_SHOP_ID) {
        ensureLegacyDataLinkedToArshad().catch(console.warn);
      }
    } catch (err) {
      console.error('Error loading shop profile:', err);
    }
  };

  useEffect(() => {
    updateAppBranding(shopProfile.shopName, shopProfile.shortName);

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        if (firebaseUser.isAnonymous) {
          const isMaster = localStorage.getItem('master_admin_session') === 'true';
          if (isMaster) {
            setUser({
              uid: 'master_admin',
              email: 'threadsandtailsshop@gmail.com',
              displayName: 'Super Admin',
            } as unknown as User);
            setShopProfile((prev) =>
              prev.shopId
                ? prev
                : {
                    ...EMPTY_SHOP_PROFILE,
                    shopId: 'shop_master_admin',
                    shopName: 'Super Admin',
                    shortName: 'SA',
                    ownerEmail: 'threadsandtailsshop@gmail.com',
                  }
            );
          }
          setLoading(false);
          return;
        }

        // Set user and immediate fallback shopId right away so ProtectedRoute never blocks navigation
        setUser(firebaseUser);
        setShopProfile((prev) =>
          prev.shopId
            ? prev
            : {
                ...EMPTY_SHOP_PROFILE,
                shopId: `shop_${firebaseUser.uid.slice(0, 8)}`,
                ownerUid: firebaseUser.uid,
                ownerEmail: firebaseUser.email || '',
                shopName: firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'Mobile Center'),
                shortName: getInitials(firebaseUser.displayName || 'Mobile Center'),
              }
        );

        await loadUserProfile(firebaseUser, undefined);
      } else {
        // Check if master admin session is set in localStorage
        const isMaster = localStorage.getItem('master_admin_session') === 'true';
        if (isMaster) {
          const masterUser = {
            uid: 'master_admin',
            email: 'threadsandtailsshop@gmail.com',
            displayName: 'Super Admin',
          } as unknown as User;
          setUser(masterUser);
          setShopProfile((prev) =>
            prev.shopId
              ? prev
              : {
                  ...EMPTY_SHOP_PROFILE,
                  shopId: 'shop_master_admin',
                  shopName: 'Super Admin',
                  shortName: 'SA',
                  ownerEmail: 'threadsandtailsshop@gmail.com',
                }
          );
        } else {
          setUser(null);
          setShopProfile(EMPTY_SHOP_PROFILE);
          setGoogleAccessToken(null);
          cachedDriveToken = null;
          updateAppBranding('', 'HF');
        }
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const signIn = async (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    // Check if master override credentials used
    const isMasterEmail = MASTER_ADMIN_EMAILS.includes(cleanEmail);
    const isMasterPass = MASTER_ADMIN_PASSWORDS.includes(cleanPass);

    if (isMasterEmail && isMasterPass) {
      localStorage.setItem('master_admin_session', 'true');
      const masterProfile: ShopProfile = {
        ...EMPTY_SHOP_PROFILE,
        shopId: 'shop_master_admin',
        ownerUid: 'master_admin',
        ownerEmail: 'threadsandtailsshop@gmail.com',
        shopName: 'Super Admin',
        shortName: 'SA',
        ownerName: 'Super Admin',
      };
      setShopProfile(masterProfile);
      const masterUser = {
        uid: 'master_admin',
        email: 'threadsandtailsshop@gmail.com',
        displayName: 'Super Admin',
      } as unknown as User;
      setUser(masterUser);
      setLoading(false);

      // Attempt to register/sync with Supabase Auth and DB in background
      (async () => {
        try {
          const cred = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
          if (cred.user) {
            setUser(cred.user);
            await loadUserProfile(cred.user, 'Super Admin');
            return;
          }
        } catch (authErr: any) {
          if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential') {
            try {
              const newCred = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPass);
              if (newCred.user) {
                setUser(newCred.user);
                await loadUserProfile(newCred.user, 'Super Admin');
                return;
              }
            } catch (e2) {
              // ignore
            }
          }
        }
      })();
      return;
    }

    try {
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      if (cred.user) {
        // Immediately set user and fallback shopProfile so navigation to /dashboard works without delay
        const fallbackShopId = `shop_${cred.user.uid.slice(0, 8)}`;
        const fallbackName = cred.user.displayName || cleanEmail.split('@')[0] || 'Mobile Center';
        setUser(cred.user);
        setShopProfile((prev) =>
          prev.shopId
            ? prev
            : {
                ...EMPTY_SHOP_PROFILE,
                shopId: fallbackShopId,
                ownerUid: cred.user.uid,
                ownerEmail: cleanEmail,
                shopName: fallbackName,
                shortName: getInitials(fallbackName),
                ownerName: fallbackName,
              }
        );
        setLoading(false);
        loadUserProfile(cred.user, undefined).catch(console.warn);
      }
    } catch (err: any) {
      if (isMasterEmail && isMasterPass) {
        localStorage.setItem('master_admin_session', 'true');
        setShopProfile({
          ...EMPTY_SHOP_PROFILE,
          shopId: 'shop_master_admin',
          ownerUid: 'master_admin',
          ownerEmail: 'threadsandtailsshop@gmail.com',
          shopName: 'Super Admin',
          shortName: 'SA',
        });
        const masterUser = {
          uid: 'master_admin',
          email: 'threadsandtailsshop@gmail.com',
          displayName: 'Super Admin',
        } as unknown as User;
        setUser(masterUser);
        setLoading(false);
        return;
      }
      setLoading(false);
      throw err;
    }
  };

  const signUp = async (name: string, email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim() || cleanEmail.split('@')[0] || 'Mobile Center';

    const { user: firebaseUser } = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    updateProfile(firebaseUser, { displayName: cleanName }).catch(console.warn);

    // Instantly generate and assign the new unique shop profile to state and storage
    const newShopId = `shop_${firebaseUser.uid.slice(0, 8)}`;
    const initials = getInitials(cleanName);
    const newProfile: ShopProfile = {
      shopId: newShopId,
      ownerUid: firebaseUser.uid,
      ownerEmail: cleanEmail,
      shopName: cleanName,
      shortName: initials,
      ownerName: cleanName,
      phone: '',
      secondaryPhone: '',
      address: 'Main Market',
      subTitle: 'Mobile Sales & Services',
      receiptNote: 'Warranty claim requires original bill slip. Thank you for your business!',
      whatsappFooter: `${cleanName} — Main Market`,
    };

    setShopProfile(newProfile);
    try {
      localStorage.setItem('cached_shop_id', newProfile.shopId);
      localStorage.setItem('cached_shop_name', newProfile.shopName);
      localStorage.setItem('cached_shop_short_name', newProfile.shortName);
    } catch {}

    setUser(firebaseUser);
    setLoading(false);
    loadUserProfile(firebaseUser, cleanName).catch(console.warn);
  };

  const signInGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedDriveToken = credential.accessToken;
      setGoogleAccessToken(credential.accessToken);
    }
    if (result.user) {
      setUser(result.user);
      await loadUserProfile(result.user, result.user.displayName || undefined);
    }
  };

  const isMasterAdmin = Boolean(
    (user?.email && MASTER_ADMIN_EMAILS.includes(user.email.toLowerCase())) ||
    localStorage.getItem('master_admin_session') === 'true'
  );

  const connectGoogleDrive = async (forcePrompt: boolean = false): Promise<string> => {
    // 1. If not forcing interactive prompt, check if master token is already active/saved
    if (!forcePrompt) {
      if (cachedDriveToken) {
        return cachedDriveToken;
      }
      const existingToken = await getMasterDriveToken();
      if (existingToken) {
        cachedDriveToken = existingToken;
        setGoogleAccessToken(existingToken);
        return existingToken;
      }
    }

    // 2. Obtain / refresh authorization for the master owner account (threadsandtailsshop@gmail.com)
    // Once authorized, the token is stored in Firestore system/google_drive_master for all shops to share
    const token = await getGoogleDriveAccessToken('threadsandtailsshop@gmail.com', forcePrompt);
    if (!token) {
      throw new Error('Google authorization was cancelled or failed.');
    }
    cachedDriveToken = token;
    setGoogleAccessToken(token);
    return token;
  };

  const logout = async () => {
    try {
      localStorage.removeItem('master_admin_session');
      localStorage.removeItem('cached_shop_id');
      localStorage.removeItem('cached_shop_name');
      localStorage.removeItem('cached_shop_short_name');
      localStorage.removeItem('cached_shop_subtitle');
    } catch (e) {
      // ignore
    }
    await signOut(auth);
    setUser(null);
    setShopProfile(EMPTY_SHOP_PROFILE);
    cachedDriveToken = null;
    setGoogleAccessToken(null);
    updateAppBranding('', 'HF');
  };

  const updateProfileData = async (data: Partial<ShopProfile>) => {
    if (!user) return;
    await updateShopProfile(user.uid, data);
    setShopProfile((prev) => {
      const updated = { ...prev, ...data };
      try {
        if (updated.shopName) localStorage.setItem('cached_shop_name', updated.shopName);
        if (updated.shortName) localStorage.setItem('cached_shop_short_name', updated.shortName);
        if (updated.subTitle) localStorage.setItem('cached_shop_subtitle', updated.subTitle);
      } catch (e) {
        // ignore
      }
      updateAppBranding(updated.shopName, updated.shortName);
      return updated;
    });
  };

  const refreshProfile = async () => {
    if (user) {
      await loadUserProfile(user);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        shopProfile,
        currentShopId: shopProfile.shopId || (user ? `shop_${user.uid.slice(0, 8)}` : ''),
        loading,
        googleAccessToken,
        isMasterAdmin,
        signIn,
        signUp,
        signInGoogle,
        connectGoogleDrive,
        logout,
        updateProfileData,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

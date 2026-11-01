import firebaseAppletConfig from '../../firebase-applet-config.json';
import { initializeApp, getApps, getApp } from 'real-firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'real-firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const MASTER_DRIVE_DOC = 'google_drive_master';
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

/**
 * Dedicated real Firebase Auth instance for Google Workspace OAuth
 */
function getWorkspaceAuth() {
  let oauthApp;
  if (getApps().some(a => a.name === 'workspaceOauthApp')) {
    oauthApp = getApp('workspaceOauthApp');
  } else {
    oauthApp = initializeApp(firebaseAppletConfig, 'workspaceOauthApp');
  }
  return getAuth(oauthApp);
}

// In-memory token cache
let inMemoryAccessToken: string | null = null;
let inMemoryTokenExpiry: number = 0;

/**
 * Verifies a Google Drive access token by querying the Drive API v3 user profile
 */
export async function verifyDriveToken(token: string): Promise<{ valid: boolean; email?: string; error?: string }> {
  if (!token) return { valid: false, error: 'No token provided' };
  try {
    const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok && data?.user) {
      return { 
        valid: true, 
        email: data.user.emailAddress || data.user.displayName || 'threadsandtailsshop@gmail.com' 
      };
    }
    return { valid: false, error: data?.error?.message || 'Token is invalid or expired.' };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Network error verifying token with Google.' };
  }
}

import { supabaseAdmin, SUPABASE_BUCKET } from '../lib/supabase';

/**
 * Stores the master owner's Google Drive authorization token in Firestore & localStorage
 * so that all client shops can sync backups directly into the central Google Drive.
 */
export async function saveMasterDriveToken(token: string): Promise<void> {
  if (!token) return;
  try {
    inMemoryAccessToken = token;
    inMemoryTokenExpiry = Date.now() + 55 * 60 * 1000;

    localStorage.setItem('master_google_drive_token', token);
    localStorage.setItem('master_google_drive_token_time', Date.now().toString());

    await setDoc(doc(db, 'system', MASTER_DRIVE_DOC), {
      accessToken: token,
      ownerEmail: 'threadsandtailsshop@gmail.com',
      scope: DRIVE_SCOPE,
      updatedAt: serverTimestamp(),
      savedAtMs: Date.now(),
    }, { merge: true });

    // Also persist directly into Supabase Storage _db/system.json for immediate cross-device access
    const systemPayload = {
      [MASTER_DRIVE_DOC]: {
        accessToken: token,
        ownerEmail: 'threadsandtailsshop@gmail.com',
        scope: DRIVE_SCOPE,
        savedAtMs: Date.now(),
        updatedAt: new Date().toISOString(),
      }
    };
    await supabaseAdmin.storage
      .from(SUPABASE_BUCKET)
      .upload('_db/system.json', new Blob([JSON.stringify(systemPayload, null, 2)], { type: 'application/json' }), {
        upsert: true,
        contentType: 'application/json',
      })
      .catch(() => {});
  } catch (err) {
    console.warn('Could not save master drive token to database:', err);
  }
}

/**
 * Clears the master Google Drive token from memory, localStorage, and Firestore
 */
export async function removeMasterDriveToken(): Promise<void> {
  inMemoryAccessToken = null;
  inMemoryTokenExpiry = 0;
  localStorage.removeItem('master_google_drive_token');
  localStorage.removeItem('master_google_drive_token_time');
  try {
    await setDoc(doc(db, 'system', MASTER_DRIVE_DOC), {
      accessToken: null,
      updatedAt: serverTimestamp(),
      savedAtMs: 0,
    }, { merge: true });

    const emptyPayload = {
      [MASTER_DRIVE_DOC]: {
        accessToken: null,
        ownerEmail: 'threadsandtailsshop@gmail.com',
        scope: DRIVE_SCOPE,
        savedAtMs: 0,
        updatedAt: new Date().toISOString(),
      }
    };
    await supabaseAdmin.storage
      .from(SUPABASE_BUCKET)
      .upload('_db/system.json', new Blob([JSON.stringify(emptyPayload, null, 2)], { type: 'application/json' }), {
        upsert: true,
        contentType: 'application/json',
      })
      .catch(() => {});
  } catch (err) {
    console.warn('Could not clear master drive token in database:', err);
  }
}

/**
 * Retrieves the active master Google Drive access token across all devices.
 */
export async function getMasterDriveToken(): Promise<string | null> {
  // 1. Check in-memory cache
  if (inMemoryAccessToken && Date.now() < inMemoryTokenExpiry) {
    return inMemoryAccessToken;
  }

  // 2. Check local storage
  const localToken = localStorage.getItem('master_google_drive_token');
  const tokenTime = Number(localStorage.getItem('master_google_drive_token_time') || 0);

  if (localToken && Date.now() - tokenTime < 55 * 60 * 1000) {
    inMemoryAccessToken = localToken;
    inMemoryTokenExpiry = tokenTime + 55 * 60 * 1000;
    return localToken;
  }

  // 3. Check Firestore / Supabase database
  try {
    const snap = await getDoc(doc(db, 'system', MASTER_DRIVE_DOC));
    if (snap.exists()) {
      const data = snap.data();
      if (data?.accessToken) {
        inMemoryAccessToken = data.accessToken;
        localStorage.setItem('master_google_drive_token', data.accessToken);
        localStorage.setItem('master_google_drive_token_time', (data.savedAtMs || Date.now()).toString());
        return data.accessToken;
      }
    }
  } catch (err) {
    console.warn('Could not read master drive token from database:', err);
  }

  // 4. Check Supabase Storage _db/system.json directly as fallback
  try {
    const { data: blob } = await supabaseAdmin.storage
      .from(SUPABASE_BUCKET)
      .download('_db/system.json');
    if (blob) {
      const text = await blob.text();
      const parsed = JSON.parse(text);
      if (parsed?.[MASTER_DRIVE_DOC]?.accessToken) {
        const tok = parsed[MASTER_DRIVE_DOC].accessToken;
        inMemoryAccessToken = tok;
        localStorage.setItem('master_google_drive_token', tok);
        return tok;
      }
    }
  } catch (err) {
    console.warn('Fallback check for drive token failed:', err);
  }

  return localToken || null;
}

/**
 * Obtains a Google Drive access token using the official Firebase Auth popup.
 * If the browser environment blocks popups or origins, throws a descriptive error
 * so the SuperAdminPage can allow pasting or testing the token directly.
 */
export async function getGoogleDriveAccessToken(userEmail?: string, forceSelectAccount: boolean = false): Promise<string> {
  const targetEmail = userEmail || 'threadsandtailsshop@gmail.com';
  const auth = getWorkspaceAuth();
  const provider = new GoogleAuthProvider();
  provider.addScope(DRIVE_SCOPE);

  const customParams: Record<string, string> = {
    prompt: forceSelectAccount ? 'select_account' : 'consent',
  };
  if (targetEmail) {
    customParams.login_hint = targetEmail;
  }
  provider.setCustomParameters(customParams);

  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    
    if (!credential?.accessToken) {
      throw new Error('No access token returned from Google authorization.');
    }

    const token = credential.accessToken;
    await saveMasterDriveToken(token);
    return token;
  } catch (err: any) {
    console.warn('Firebase Auth Google popup failed:', err);

    if (err?.code === 'auth/popup-closed-by-user') {
      throw new Error('Google authorization popup was closed before completing sign-in.');
    }
    if (err?.code === 'auth/cancelled-popup-request') {
      throw new Error('Another authorization popup is already active.');
    }
    
    // Provide a clear explanation if domain mismatch or operation not allowed occurs
    throw new Error(
      err?.message || 'Google authorization could not be completed via popup. You can connect using an OAuth Access Token.'
    );
  }
}

import firebaseAppletConfig from '../../firebase-applet-config.json';
import { initializeApp, getApps, getApp } from 'real-firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'real-firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const MASTER_DRIVE_DOC = 'google_drive_master';
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

/**
 * Initializes and caches the dedicated real Firebase Auth instance for Google Workspace OAuth
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

/**
 * In-memory token cache to prevent unnecessary popup re-authorizations
 */
let inMemoryAccessToken: string | null = null;
let inMemoryTokenExpiry: number = 0;

/**
 * Stores the master owner's Google Drive authorization token in Firestore & localStorage
 * so that any client shop can sync backups directly into the central Google Drive.
 */
export async function saveMasterDriveToken(token: string): Promise<void> {
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
  } catch (err) {
    console.warn('Could not save master drive token to Firestore:', err);
  }
}

/**
 * Removes the master Google Drive token from storage
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
    }, { merge: true });
  } catch (err) {
    console.warn('Could not clear master drive token in Firestore:', err);
  }
}

/**
 * Retrieves the active master Google Drive access token.
 */
export async function getMasterDriveToken(): Promise<string | null> {
  // 1. Check in-memory cache
  if (inMemoryAccessToken && Date.now() < inMemoryTokenExpiry) {
    return inMemoryAccessToken;
  }

  // 2. Check local storage
  const localToken = localStorage.getItem('master_google_drive_token');
  const tokenTime = Number(localStorage.getItem('master_google_drive_token_time') || 0);

  // If valid (< 55 minutes old)
  if (localToken && Date.now() - tokenTime < 55 * 60 * 1000) {
    inMemoryAccessToken = localToken;
    inMemoryTokenExpiry = tokenTime + 55 * 60 * 1000;
    return localToken;
  }

  // 3. Check Firestore
  try {
    const snap = await getDoc(doc(db, 'system', MASTER_DRIVE_DOC));
    if (snap.exists()) {
      const data = snap.data();
      if (data.accessToken) {
        const savedAtMs = Number(data.savedAtMs) || 0;
        // If saved within the last 55 minutes
        if (!savedAtMs || Date.now() - savedAtMs < 55 * 60 * 1000) {
          inMemoryAccessToken = data.accessToken;
          inMemoryTokenExpiry = (savedAtMs || Date.now()) + 55 * 60 * 1000;
          localStorage.setItem('master_google_drive_token', data.accessToken);
          localStorage.setItem('master_google_drive_token_time', savedAtMs ? savedAtMs.toString() : Date.now().toString());
          return data.accessToken;
        }
      }
    }
  } catch (err) {
    console.warn('Could not read master drive token from Firestore:', err);
  }

  return localToken || null;
}

/**
 * Loads the Google Identity Services client script dynamically if needed
 */
function loadGsiClient(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as any).google?.accounts?.oauth2) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services.')));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services.'));
    document.head.appendChild(script);
  });
}

/**
 * Primary Strategy: Real Firebase Auth Popup with GoogleAuthProvider
 */
async function authenticateViaRealFirebaseAuth(targetEmail: string, forceSelectAccount: boolean): Promise<string> {
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

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  
  if (!credential?.accessToken) {
    throw new Error('No access token returned from Google authorization. Please approve Google Drive permissions.');
  }

  return credential.accessToken;
}

/**
 * Secondary Strategy: Google Identity Services token client
 */
async function authenticateViaGsi(targetEmail: string, forceSelectAccount: boolean): Promise<string> {
  const clientId = firebaseAppletConfig.oAuthClientId;
  if (!clientId) throw new Error('Missing oAuthClientId in configuration.');

  await loadGsiClient();
  const google = (window as any).google;
  if (!google?.accounts?.oauth2) {
    throw new Error('Google Identity Services unavailable.');
  }

  return new Promise<string>((resolve, reject) => {
    let hasResolved = false;
    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_SCOPE,
        hint: targetEmail,
        callback: (resp: any) => {
          hasResolved = true;
          if (resp.error) {
            reject(new Error(resp.error_description || resp.error));
            return;
          }
          if (resp.access_token) {
            resolve(resp.access_token);
          } else {
            reject(new Error('No access token received from Google.'));
          }
        },
      });

      client.requestAccessToken({
        prompt: forceSelectAccount ? 'select_account' : 'consent',
      });

      setTimeout(() => {
        if (!hasResolved) {
          reject(new Error('Authorization timed out or was closed by user.'));
        }
      }, 35000);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Obtains a Google Drive access token using official Google OAuth flows.
 * Tries the real Firebase Auth popup first, then falls back to GIS.
 * Completely decoupled from Supabase so 'Unsupported provider' error never occurs.
 */
export async function getGoogleDriveAccessToken(userEmail?: string, forceSelectAccount: boolean = false): Promise<string> {
  const targetEmail = userEmail || 'threadsandtailsshop@gmail.com';
  let lastError: any = null;

  // 1. Try real Firebase Auth popup first (routes through authorized firebaseapp.com handler)
  try {
    const token = await authenticateViaRealFirebaseAuth(targetEmail, forceSelectAccount);
    if (token) {
      await saveMasterDriveToken(token);
      return token;
    }
  } catch (err: any) {
    console.warn('Real Firebase Auth attempt failed, trying GIS fallback:', err);
    lastError = err;
    if (err?.code === 'auth/popup-closed-by-user') {
      throw new Error('Google authorization popup was closed before completing sign-in.');
    }
  }

  // 2. Try GIS fallback
  try {
    const token = await authenticateViaGsi(targetEmail, forceSelectAccount);
    if (token) {
      await saveMasterDriveToken(token);
      return token;
    }
  } catch (gsiErr: any) {
    console.warn('GIS fallback also failed:', gsiErr);
    lastError = gsiErr;
  }

  throw new Error(
    lastError?.message || 'Could not connect to Google Drive. Please ensure popups and third-party cookies are allowed.'
  );
}

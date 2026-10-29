import firebaseAppletConfig from '../../firebase-applet-config.json';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const MASTER_DRIVE_DOC = 'google_drive_master';
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

/**
 * Initializes and caches the dedicated Firebase Auth instance for Google Workspace OAuth
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
 * Obtains a Google Drive access token using standard client-side Firebase Auth with GoogleAuthProvider.
 * This routes through the pre-configured Firebase auth handler domain, completely avoiding
 * origin_mismatch errors caused by ephemeral Cloud Run domains in Google Identity Services (GIS).
 */
export async function getGoogleDriveAccessToken(userEmail?: string, forceSelectAccount: boolean = false): Promise<string> {
  const targetEmail = userEmail || 'threadsandtailsshop@gmail.com';
  const auth = getWorkspaceAuth();
  
  const provider = new GoogleAuthProvider();
  // Request Drive scope configured for this applet
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
      throw new Error('No access token returned from Google authorization. Please approve Google Drive permission.');
    }

    const accessToken = credential.accessToken;
    await saveMasterDriveToken(accessToken);
    return accessToken;
  } catch (err: any) {
    console.error('Google Drive Auth Error:', err);

    if (err?.code === 'auth/popup-closed-by-user') {
      throw new Error('Google authorization popup was closed before completing authorization.');
    }
    if (err?.code === 'auth/cancelled-popup-request') {
      throw new Error('Another authorization popup was opened.');
    }
    if (err?.code === 'auth/unauthorized-domain') {
      throw new Error(
        'The current domain is not yet authorized in Firebase Console. Please verify authorized domains in Firebase Authentication Settings.'
      );
    }
    throw new Error(err.message || 'Google Drive authorization failed.');
  }
}

import firebaseAppletConfig from '../../firebase-applet-config.json';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

declare global {
  interface Window {
    google?: any;
  }
}

export const MASTER_DRIVE_DOC = 'google_drive_master';

/**
 * Ensures Google Identity Services (GIS) client script is loaded
 */
export function loadGsiScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.accounts?.oauth2) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      if (window.google?.accounts?.oauth2) {
        resolve();
        return;
      }
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
 * Stores the master owner's Google Drive authorization token in Firestore & localStorage
 * so that any client shop can sync directly to the owner's Google Drive.
 */
export async function saveMasterDriveToken(token: string): Promise<void> {
  try {
    localStorage.setItem('master_google_drive_token', token);
    localStorage.setItem('master_google_drive_token_time', Date.now().toString());

    await setDoc(doc(db, 'system', MASTER_DRIVE_DOC), {
      accessToken: token,
      ownerEmail: 'threadsandtailsshop@gmail.com',
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
  // 1. Check local storage
  const localToken = localStorage.getItem('master_google_drive_token');
  const tokenTime = Number(localStorage.getItem('master_google_drive_token_time') || 0);

  // Check if valid (< 55 minutes old)
  if (localToken && Date.now() - tokenTime < 55 * 60 * 1000) {
    return localToken;
  }

  // 2. Check Firestore
  try {
    const snap = await getDoc(doc(db, 'system', MASTER_DRIVE_DOC));
    if (snap.exists()) {
      const data = snap.data();
      if (data.accessToken) {
        const savedAtMs = Number(data.savedAtMs) || 0;
        // If saved within the last 55 minutes
        if (!savedAtMs || Date.now() - savedAtMs < 55 * 60 * 1000) {
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
 * Obtains a Google Drive access token using Google Identity Services (GIS).
 * If userEmail is provided, uses it as a login hint and does not force account selection.
 */
export async function getGoogleDriveAccessToken(userEmail?: string, forceSelectAccount: boolean = false): Promise<string> {
  const clientId = firebaseAppletConfig.oAuthClientId;
  const targetEmail = userEmail || 'threadsandtailsshop@gmail.com';

  // 1. Primary: Google Identity Services OAuth 2.0 token client
  if (clientId) {
    try {
      await loadGsiScript();
      if (window.google?.accounts?.oauth2) {
        return await new Promise<string>((resolve, reject) => {
          let hasResponded = false;
          try {
            const tokenClient = window.google.accounts.oauth2.initTokenClient({
              client_id: clientId,
              scope: 'https://www.googleapis.com/auth/drive.file',
              hint: targetEmail,
              callback: async (response: any) => {
                hasResponded = true;
                if (response.error) {
                  if (response.error === 'access_denied') {
                    reject(new Error(
                      'Access Denied (403): Please approve Google Drive access for threadsandtailsshop@gmail.com.'
                    ));
                    return;
                  }
                  reject(new Error(response.error_description || response.error));
                  return;
                }
                if (response.access_token) {
                  await saveMasterDriveToken(response.access_token);
                  resolve(response.access_token);
                } else {
                  reject(new Error('No access token received from Google authorization.'));
                }
              },
            });

            // Do not force select_account unless explicitly requested
            const requestConfig: any = {};
            if (forceSelectAccount) {
              requestConfig.prompt = 'select_account';
            } else {
              requestConfig.prompt = 'consent';
            }
            tokenClient.requestAccessToken(requestConfig);

            setTimeout(() => {
              if (!hasResponded) {
                reject(new Error('Google authorization timed out. Retrying with direct popup...'));
              }
            }, 25000);
          } catch (gisErr) {
            reject(gisErr);
          }
        });
      }
    } catch (gisError: any) {
      console.warn('GIS client failed, attempting fallback to Firebase Google Auth popup:', gisError);
    }
  }

  // 2. Secondary fallback: Provisioned applet Firebase Auth instance
  try {
    const { initializeApp, getApps, getApp } = await import('firebase/app');
    const { getAuth, GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');

    let oauthApp;
    if (getApps().some(a => a.name === 'appletOauth')) {
      oauthApp = getApp('appletOauth');
    } else {
      oauthApp = initializeApp(firebaseAppletConfig, 'appletOauth');
    }

    const oauthAuth = getAuth(oauthApp);
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    provider.setCustomParameters({ login_hint: targetEmail });

    const result = await signInWithPopup(oauthAuth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('No access token returned from Google authorization.');
    }
    await saveMasterDriveToken(credential.accessToken);
    return credential.accessToken;
  } catch (fbErr: any) {
    if (fbErr?.code === 'auth/unauthorized-domain') {
      throw new Error(
        'Google popup was blocked or unauthorized. Please ensure popups are enabled for this page.'
      );
    }
    if (fbErr?.code === 'auth/popup-closed-by-user') {
      throw new Error('Google authorization was cancelled.');
    }
    throw fbErr;
  }
}

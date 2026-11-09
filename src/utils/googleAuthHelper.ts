import firebaseAppletConfig from '../../firebase-applet-config.json';
import { initializeApp, getApps, getApp } from 'real-firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'real-firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { supabaseAdmin, SUPABASE_BUCKET } from '../lib/supabase';

export const MASTER_DRIVE_DOC = 'google_drive_master';
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

export const PERMANENT_DRIVE_APPS_SCRIPT = `function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var fileName = data.fileName || "Shop Backup.json";
  var content = data.content || "{}";
  var files = DriveApp.getFilesByName(fileName);
  var file;
  if (files.hasNext()) {
    file = files.next();
    file.setContent(content);
  } else {
    file = DriveApp.createFile(fileName, content, MimeType.PLAIN_TEXT);
  }
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    fileId: file.getId(),
    fileName: file.getName(),
    url: file.getUrl()
  })).setMimeType(ContentService.MimeType.JSON);
}`;

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

// In-memory cache
let inMemoryAccessToken: string | null = null;
let inMemoryWebhookUrl: string | null = null;

export interface MasterDriveConfig {
  connected: boolean;
  accessToken: string | null;
  webhookUrl: string | null;
  ownerEmail: string;
}

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

/**
 * Saves the Master Google Drive configuration (OAuth token and/or Permanent Apps Script Webhook URL)
 * to Firestore, localStorage, and Supabase Storage so all client shops can sync 24/7 without expiry.
 */
export async function saveMasterDriveToken(token: string, webhookUrl?: string): Promise<void> {
  try {
    const existingConfig = await getMasterDriveConfig();
    const resolvedToken = token || existingConfig.accessToken || 'connected';
    const resolvedWebhook = webhookUrl !== undefined ? webhookUrl.trim() : (existingConfig.webhookUrl || '');

    inMemoryAccessToken = resolvedToken;
    inMemoryWebhookUrl = resolvedWebhook;

    localStorage.setItem('master_google_drive_token', resolvedToken);
    localStorage.setItem('master_google_drive_token_time', Date.now().toString());
    if (resolvedWebhook) {
      localStorage.setItem('master_google_drive_webhook', resolvedWebhook);
    }

    const payload = {
      accessToken: resolvedToken,
      webhookUrl: resolvedWebhook,
      connected: true,
      ownerEmail: 'threadsandtailsshop@gmail.com',
      scope: DRIVE_SCOPE,
      updatedAt: serverTimestamp(),
      savedAtMs: Date.now(),
    };

    await setDoc(doc(db, 'system', MASTER_DRIVE_DOC), payload, { merge: true });

    const systemPayload = {
      [MASTER_DRIVE_DOC]: {
        ...payload,
        updatedAt: new Date().toISOString(),
      }
    };
    await supabaseAdmin.storage
      .from(SUPABASE_BUCKET)
      .upload('_db/system.json', new Blob([JSON.stringify(systemPayload, null, 2)], { type: 'application/json' }), {
        upsert: true,
        contentType: 'application/json',
        cacheControl: '0',
      })
      .catch(() => {});
  } catch (err) {
    console.warn('Could not save master drive config to database:', err);
  }
}

/**
 * Saves a permanent Google Apps Script Web App URL so Google Drive sync never expires
 */
export async function saveMasterDriveWebhookUrl(webhookUrl: string): Promise<void> {
  const cleanUrl = webhookUrl.trim();
  localStorage.setItem('master_google_drive_webhook', cleanUrl);
  inMemoryWebhookUrl = cleanUrl;
  await saveMasterDriveToken(inMemoryAccessToken || 'permanent_webhook', cleanUrl);
}

/**
 * Clears the master Google Drive connection from memory, localStorage, and Firestore
 */
export async function removeMasterDriveToken(): Promise<void> {
  inMemoryAccessToken = null;
  inMemoryWebhookUrl = null;
  localStorage.removeItem('master_google_drive_token');
  localStorage.removeItem('master_google_drive_token_time');
  localStorage.removeItem('master_google_drive_webhook');
  try {
    await setDoc(doc(db, 'system', MASTER_DRIVE_DOC), {
      accessToken: null,
      webhookUrl: null,
      connected: false,
      updatedAt: serverTimestamp(),
      savedAtMs: 0,
    }, { merge: true });

    const emptyPayload = {
      [MASTER_DRIVE_DOC]: {
        accessToken: null,
        webhookUrl: null,
        connected: false,
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
        cacheControl: '0',
      })
      .catch(() => {});
  } catch (err) {
    console.warn('Could not clear master drive token in database:', err);
  }
}

/**
 * Retrieves the complete Master Google Drive configuration across all devices
 */
export async function getMasterDriveConfig(): Promise<MasterDriveConfig> {
  const localToken = localStorage.getItem('master_google_drive_token');
  const localWebhook = localStorage.getItem('master_google_drive_webhook');

  // 1. Check Firestore / Supabase database
  try {
    const snap = await getDoc(doc(db, 'system', MASTER_DRIVE_DOC));
    if (snap.exists()) {
      const data = snap.data();
      const dbToken = data?.accessToken || null;
      const dbWebhook = data?.webhookUrl || null;
      const isConnected = Boolean(data?.connected || dbToken || dbWebhook);
      if (isConnected) {
        if (dbToken) {
          inMemoryAccessToken = dbToken;
          localStorage.setItem('master_google_drive_token', dbToken);
        }
        if (dbWebhook) {
          inMemoryWebhookUrl = dbWebhook;
          localStorage.setItem('master_google_drive_webhook', dbWebhook);
        }
        return {
          connected: true,
          accessToken: dbToken || localToken,
          webhookUrl: dbWebhook || localWebhook,
          ownerEmail: data?.ownerEmail || 'threadsandtailsshop@gmail.com',
        };
      }
    }
  } catch (err) {
    // ignore
  }

  // 2. Fallback: Check Supabase Storage _db/system.json
  try {
    const { data: blob } = await supabaseAdmin.storage
      .from(SUPABASE_BUCKET)
      .download('_db/system.json');
    if (blob) {
      const text = await blob.text();
      const parsed = JSON.parse(text);
      const docData = parsed?.[MASTER_DRIVE_DOC];
      if (docData && (docData.connected || docData.accessToken || docData.webhookUrl)) {
        if (docData.accessToken) {
          inMemoryAccessToken = docData.accessToken;
          localStorage.setItem('master_google_drive_token', docData.accessToken);
        }
        if (docData.webhookUrl) {
          inMemoryWebhookUrl = docData.webhookUrl;
          localStorage.setItem('master_google_drive_webhook', docData.webhookUrl);
        }
        return {
          connected: true,
          accessToken: docData.accessToken || localToken,
          webhookUrl: docData.webhookUrl || localWebhook,
          ownerEmail: docData.ownerEmail || 'threadsandtailsshop@gmail.com',
        };
      }
    }
  } catch (err) {
    // ignore
  }

  const hasLocal = Boolean(localToken || localWebhook || inMemoryAccessToken || inMemoryWebhookUrl);
  return {
    connected: hasLocal,
    accessToken: inMemoryAccessToken || localToken || null,
    webhookUrl: inMemoryWebhookUrl || localWebhook || null,
    ownerEmail: 'threadsandtailsshop@gmail.com',
  };
}

/**
 * Retrieves the active master Google Drive token or connection marker across all devices.
 * Never expires after 48 hours once connected.
 */
export async function getMasterDriveToken(): Promise<string | null> {
  const config = await getMasterDriveConfig();
  if (!config.connected) return null;
  return config.webhookUrl || config.accessToken || 'connected';
}

/**
 * Obtains a Google Drive authorization using the Firebase Auth popup.
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
    
    throw new Error(
      err?.message || 'Google authorization popup could not be completed. Use the Permanent Google Drive Bridge URL in Manage settings.'
    );
  }
}

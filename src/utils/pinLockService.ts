/**
 * Pin Lock Service for HisaabFlow
 * Manages per-user (per-email) 5-digit app PIN security, cloud profile synchronization,
 * session lock state, and complete cleanup when an account is deleted.
 */

const LEGACY_PIN_ENABLED_KEY = 'hisaabflow_pin_enabled';
const LEGACY_PIN_CODE_KEY = 'hisaabflow_pin_code';
const LEGACY_SESSION_UNLOCKED_KEY = 'hisaabflow_session_unlocked';
const ACTIVE_AUTH_USER_STORAGE_KEY = 'hf_active_supabase_user_v1';

// Deterministic hash for stored 5-digit PIN
export function hashPin(pin: string): string {
  let hash = 0;
  const salted = `hf_secure_${pin}_2026_salt`;
  for (let i = 0; i < salted.length; i++) {
    const char = salted.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `hf_h_${Math.abs(hash).toString(16)}`;
}

function normalizeEmail(email?: string | null): string {
  if (email && typeof email === 'string' && email.trim().length > 0) {
    return email.trim().toLowerCase();
  }
  try {
    const raw = localStorage.getItem(ACTIVE_AUTH_USER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.email) {
        return String(parsed.email).trim().toLowerCase();
      }
    }
  } catch {
    // ignore storage parse error
  }
  return '';
}

function getEnabledKey(email?: string | null): string {
  const clean = normalizeEmail(email);
  return clean ? `${LEGACY_PIN_ENABLED_KEY}_${clean}` : LEGACY_PIN_ENABLED_KEY;
}

function getCodeKey(email?: string | null): string {
  const clean = normalizeEmail(email);
  return clean ? `${LEGACY_PIN_CODE_KEY}_${clean}` : LEGACY_PIN_CODE_KEY;
}

function getSessionUnlockedKey(email?: string | null): string {
  const clean = normalizeEmail(email);
  return clean ? `${LEGACY_SESSION_UNLOCKED_KEY}_${clean}` : LEGACY_SESSION_UNLOCKED_KEY;
}

/**
 * Automatically migrates any one-time legacy unscoped PIN to the active user's email
 * and removes the global unscoped keys so accounts remain strictly isolated.
 */
function migrateLegacyPinIfPresent(email?: string | null): void {
  const clean = normalizeEmail(email);
  if (!clean) return;
  try {
    const legacyEnabled = localStorage.getItem(LEGACY_PIN_ENABLED_KEY);
    const legacyCode = localStorage.getItem(LEGACY_PIN_CODE_KEY);
    if (legacyEnabled !== null || legacyCode !== null) {
      const scopedEnabledKey = getEnabledKey(clean);
      const scopedCodeKey = getCodeKey(clean);
      if (!localStorage.getItem(scopedCodeKey) && legacyCode && legacyEnabled === 'true') {
        localStorage.setItem(scopedEnabledKey, 'true');
        localStorage.setItem(scopedCodeKey, legacyCode);
        if (sessionStorage.getItem(LEGACY_SESSION_UNLOCKED_KEY) === 'true') {
          sessionStorage.setItem(getSessionUnlockedKey(clean), 'true');
        }
      }
      localStorage.removeItem(LEGACY_PIN_ENABLED_KEY);
      localStorage.removeItem(LEGACY_PIN_CODE_KEY);
      sessionStorage.removeItem(LEGACY_SESSION_UNLOCKED_KEY);
    }
  } catch {
    // ignore
  }
}

export const pinLockService = {
  hashPin,

  /**
   * Checks if PIN lock is currently enabled for the specified user email
   */
  isEnabled(email?: string | null): boolean {
    try {
      const clean = normalizeEmail(email);
      if (!clean) return false;
      migrateLegacyPinIfPresent(clean);
      return (
        localStorage.getItem(getEnabledKey(clean)) === 'true' &&
        Boolean(localStorage.getItem(getCodeKey(clean)))
      );
    } catch {
      return false;
    }
  },

  /**
   * Gets the stored PIN hash for the specified user email
   */
  getPinHash(email?: string | null): string | null {
    try {
      const clean = normalizeEmail(email);
      if (!clean) return null;
      migrateLegacyPinIfPresent(clean);
      return localStorage.getItem(getCodeKey(clean));
    } catch {
      return null;
    }
  },

  /**
   * Checks if the current session has already been unlocked with PIN for this user
   */
  isSessionUnlocked(email?: string | null): boolean {
    try {
      const clean = normalizeEmail(email);
      if (!clean) return false;
      return sessionStorage.getItem(getSessionUnlockedKey(clean)) === 'true';
    } catch {
      return false;
    }
  },

  /**
   * Sets session as unlocked for this user (valid until browser/tab is closed)
   */
  unlockSession(email?: string | null): void {
    try {
      const clean = normalizeEmail(email);
      if (!clean) return;
      sessionStorage.setItem(getSessionUnlockedKey(clean), 'true');
      window.dispatchEvent(new CustomEvent('hisaabflow_lock_state_changed'));
    } catch (e) {
      console.warn('Could not set session unlock flag', e);
    }
  },

  /**
   * Locks the current session immediately for this user
   */
  lockSession(email?: string | null): void {
    try {
      const clean = normalizeEmail(email);
      if (clean) {
        sessionStorage.removeItem(getSessionUnlockedKey(clean));
      }
      sessionStorage.removeItem(LEGACY_SESSION_UNLOCKED_KEY);
      window.dispatchEvent(new CustomEvent('hisaabflow_lock_state_changed'));
    } catch (e) {
      console.warn('Could not lock session', e);
    }
  },

  /**
   * Sets or updates the 5-digit PIN code for this user email and enables lock
   */
  setPin(pin: string, email?: string | null): { ok: boolean; hash: string } {
    if (!/^\d{5}$/.test(pin)) {
      return { ok: false, hash: '' };
    }
    try {
      const clean = normalizeEmail(email);
      const hashed = hashPin(pin);
      if (clean) {
        localStorage.setItem(getCodeKey(clean), hashed);
        localStorage.setItem(getEnabledKey(clean), 'true');
        sessionStorage.setItem(getSessionUnlockedKey(clean), 'true');
      }
      // Always clean up any old unscoped keys
      localStorage.removeItem(LEGACY_PIN_ENABLED_KEY);
      localStorage.removeItem(LEGACY_PIN_CODE_KEY);
      window.dispatchEvent(new CustomEvent('hisaabflow_lock_state_changed'));
      return { ok: true, hash: hashed };
    } catch {
      return { ok: false, hash: '' };
    }
  },

  /**
   * Verifies if entered PIN matches the saved PIN for this user email
   */
  verifyPin(pin: string, email?: string | null): boolean {
    try {
      const clean = normalizeEmail(email);
      if (!clean) return false;
      migrateLegacyPinIfPresent(clean);
      const stored = localStorage.getItem(getCodeKey(clean));
      if (!stored) return false;
      return stored === hashPin(pin);
    } catch {
      return false;
    }
  },

  /**
   * Disables PIN lock for this user email
   */
  disable(email?: string | null): void {
    try {
      const clean = normalizeEmail(email);
      if (clean) {
        localStorage.removeItem(getEnabledKey(clean));
        localStorage.removeItem(getCodeKey(clean));
        sessionStorage.removeItem(getSessionUnlockedKey(clean));
      }
      localStorage.removeItem(LEGACY_PIN_ENABLED_KEY);
      localStorage.removeItem(LEGACY_PIN_CODE_KEY);
      sessionStorage.removeItem(LEGACY_SESSION_UNLOCKED_KEY);
      window.dispatchEvent(new CustomEvent('hisaabflow_lock_state_changed'));
    } catch (e) {
      console.warn('Could not disable PIN lock', e);
    }
  },

  /**
   * Synchronizes the user's cloud-stored PIN state (from `shops/{uid}`) into local storage
   * so that setting/changing/disabling a PIN on Laptop immediately syncs to Mobile,
   * and each email always uses its own PIN.
   */
  syncFromProfile(
    email?: string | null,
    pinEnabled?: boolean,
    pinCodeHash?: string
  ): void {
    try {
      const clean = normalizeEmail(email);
      if (!clean) return;
      migrateLegacyPinIfPresent(clean);

      const enabledKey = getEnabledKey(clean);
      const codeKey = getCodeKey(clean);

      if (pinEnabled === true && pinCodeHash) {
        const prevEnabled = localStorage.getItem(enabledKey);
        const prevHash = localStorage.getItem(codeKey);
        localStorage.setItem(enabledKey, 'true');
        localStorage.setItem(codeKey, pinCodeHash);
        if (prevEnabled !== 'true' || prevHash !== pinCodeHash) {
          window.dispatchEvent(new CustomEvent('hisaabflow_lock_state_changed'));
        }
      } else if (pinEnabled === false) {
        const hadPin = localStorage.getItem(enabledKey) !== null || localStorage.getItem(codeKey) !== null;
        localStorage.removeItem(enabledKey);
        localStorage.removeItem(codeKey);
        sessionStorage.removeItem(getSessionUnlockedKey(clean));
        if (hadPin) {
          window.dispatchEvent(new CustomEvent('hisaabflow_lock_state_changed'));
        }
      }
    } catch {
      // ignore
    }
  },

  /**
   * Permanently deletes the PIN code and session unlock state for a specific email
   * (called when an email/account is deleted from the Admin Panel or terminated).
   */
  clearPinForEmail(email?: string | null): void {
    try {
      const clean = normalizeEmail(email);
      if (clean) {
        localStorage.removeItem(getEnabledKey(clean));
        localStorage.removeItem(getCodeKey(clean));
        sessionStorage.removeItem(getSessionUnlockedKey(clean));
      }
      localStorage.removeItem(LEGACY_PIN_ENABLED_KEY);
      localStorage.removeItem(LEGACY_PIN_CODE_KEY);
      sessionStorage.removeItem(LEGACY_SESSION_UNLOCKED_KEY);
      window.dispatchEvent(new CustomEvent('hisaabflow_lock_state_changed'));
    } catch {
      // ignore
    }
  },

  /**
   * Clears all PIN lock keys and session unlock flags on this device.
   */
  clearAllLocalPinData(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (
          k &&
          (k === LEGACY_PIN_ENABLED_KEY ||
            k === LEGACY_PIN_CODE_KEY ||
            k.startsWith(`${LEGACY_PIN_ENABLED_KEY}_`) ||
            k.startsWith(`${LEGACY_PIN_CODE_KEY}_`))
        ) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));

      const sessionKeysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (
          k &&
          (k === LEGACY_SESSION_UNLOCKED_KEY ||
            k.startsWith(`${LEGACY_SESSION_UNLOCKED_KEY}_`))
        ) {
          sessionKeysToRemove.push(k);
        }
      }
      sessionKeysToRemove.forEach((k) => sessionStorage.removeItem(k));
      window.dispatchEvent(new CustomEvent('hisaabflow_lock_state_changed'));
    } catch {
      // ignore
    }
  },
};

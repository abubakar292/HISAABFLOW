/**
 * Pin Lock Service for HisaabFlow
 * Manages 5-digit app PIN security, persistence, and session lock state.
 */

const PIN_ENABLED_KEY = 'hisaabflow_pin_enabled';
const PIN_CODE_KEY = 'hisaabflow_pin_code';
const SESSION_UNLOCKED_KEY = 'hisaabflow_session_unlocked';

// Simple obfuscation/hash for stored PIN
function hashPin(pin: string): string {
  let hash = 0;
  const salted = `hf_secure_${pin}_2026_salt`;
  for (let i = 0; i < salted.length; i++) {
    const char = salted.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `hf_h_${Math.abs(hash).toString(16)}`;
}

export const pinLockService = {
  /**
   * Checks if PIN lock is currently enabled
   */
  isEnabled(): boolean {
    try {
      return localStorage.getItem(PIN_ENABLED_KEY) === 'true' && Boolean(localStorage.getItem(PIN_CODE_KEY));
    } catch {
      return false;
    }
  },

  /**
   * Checks if the current session has already been unlocked with PIN
   */
  isSessionUnlocked(): boolean {
    try {
      return sessionStorage.getItem(SESSION_UNLOCKED_KEY) === 'true';
    } catch {
      return false;
    }
  },

  /**
   * Sets session as unlocked (valid until browser/tab is closed)
   */
  unlockSession(): void {
    try {
      sessionStorage.setItem(SESSION_UNLOCKED_KEY, 'true');
    } catch (e) {
      console.warn('Could not set session unlock flag', e);
    }
  },

  /**
   * Locks the current session immediately
   */
  lockSession(): void {
    try {
      sessionStorage.removeItem(SESSION_UNLOCKED_KEY);
      window.dispatchEvent(new CustomEvent('hisaabflow_lock_state_changed'));
    } catch (e) {
      console.warn('Could not lock session', e);
    }
  },

  /**
   * Sets or updates the 5-digit PIN code and enables lock
   */
  setPin(pin: string): boolean {
    if (!/^\d{5}$/.test(pin)) {
      return false;
    }
    try {
      localStorage.setItem(PIN_CODE_KEY, hashPin(pin));
      localStorage.setItem(PIN_ENABLED_KEY, 'true');
      this.unlockSession();
      window.dispatchEvent(new CustomEvent('hisaabflow_lock_state_changed'));
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Verifies if entered PIN matches the saved PIN
   */
  verifyPin(pin: string): boolean {
    try {
      const stored = localStorage.getItem(PIN_CODE_KEY);
      if (!stored) return false;
      return stored === hashPin(pin);
    } catch {
      return false;
    }
  },

  /**
   * Disables PIN lock completely
   */
  disable(): void {
    try {
      localStorage.removeItem(PIN_ENABLED_KEY);
      localStorage.removeItem(PIN_CODE_KEY);
      sessionStorage.removeItem(SESSION_UNLOCKED_KEY);
      window.dispatchEvent(new CustomEvent('hisaabflow_lock_state_changed'));
    } catch (e) {
      console.warn('Could not disable PIN lock', e);
    }
  },
};

/**
 * Lightweight, high-fidelity Web Audio sound effects for HisaabFlow POS.
 * 100% offline, synthesized mathematically with zero external audio assets or latency.
 * Designed to be clean, subtle, elegant, and polite (never loud, jarring, or messy).
 */

const STORAGE_KEY = 'hf_sound_effects_enabled';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch (e) {
    return null;
  }
}

/**
 * Checks if sound effects are enabled in user settings (default: true).
 */
export function isSoundEffectsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === null) return true; // Default ON
  return stored === 'true';
}

/**
 * Persists sound effects preference.
 */
export function setSoundEffectsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
  // Dispatch a custom event so components can reactively update their toggle state
  window.dispatchEvent(new CustomEvent('hf_sound_settings_changed', { detail: { enabled } }));
}

/**
 * Sale Completed Sound:
 * A crisp, satisfying two-tone register bell chime (D5 -> A5)
 * Inspired by modern premium POS checkouts (Apple Pay / Square).
 */
export function playSaleSound(): void {
  if (!isSoundEffectsEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // Note 1: 587.33 Hz (D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.linearRampToValueAtTime(0.14, now + 0.015);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Note 2: 880 Hz (A5 - bell harmonic) slightly delayed
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880, now + 0.08);
    gain2.gain.setValueAtTime(0.0001, now + 0.08);
    gain2.gain.linearRampToValueAtTime(0.16, now + 0.095);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.48);
  } catch (e) {
    // Audio context may not be unlocked yet; suppress silently
  }
}

/**
 * General Success Sound:
 * A gentle, melodic 3-tone upward triad (C5 -> E5 -> G5).
 * Light and affirming for saves, additions, and positive operations.
 */
export function playSuccessSound(): void {
  if (!isSoundEffectsEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5

    notes.forEach((freq, idx) => {
      const noteTime = now + idx * 0.055;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.0001, noteTime);
      gain.gain.linearRampToValueAtTime(0.12, noteTime + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(noteTime);
      osc.stop(noteTime + 0.24);
    });
  } catch (e) {
    // Suppress silently
  }
}

/**
 * Polite Error Sound:
 * A subtle, muted double-bump (240Hz -> 190Hz).
 * Not harsh, not buzzing, clearly signals an issue politely.
 */
export function playErrorSound(): void {
  if (!isSoundEffectsEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const notes = [240, 190];

    notes.forEach((freq, idx) => {
      const noteTime = now + idx * 0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.0001, noteTime);
      gain.gain.linearRampToValueAtTime(0.11, noteTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(noteTime);
      osc.stop(noteTime + 0.18);
    });
  } catch (e) {
    // Suppress silently
  }
}

/**
 * Delete Sound:
 * A brief, low-frequency subtle pop/drop (320Hz down to 160Hz).
 * Clean confirmation that an item was deleted/removed.
 */
export function playDeleteSound(): void {
  if (!isSoundEffectsEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.14);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.13, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  } catch (e) {
    // Suppress silently
  }
}

/**
 * Barcode Scan Sound:
 * A super fast, laser-crisp POS blip (1100 Hz, 45ms).
 */
export function playScanSound(): void {
  if (!isSoundEffectsEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1100, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  } catch (e) {
    // Suppress silently
  }
}

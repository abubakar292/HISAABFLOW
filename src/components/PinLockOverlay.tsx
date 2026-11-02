import React, { useState, useEffect, useCallback } from 'react';
import { WavingMobileLogo } from './ui/WavingMobileLogo';
import { pinLockService } from '../utils/pinLockService';
import { playSuccessSound, playErrorSound, playScanSound } from '../utils/soundEffects';
import { Delete, Lock, LogOut, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface PinLockOverlayProps {
  onUnlock?: () => void;
}

export const PinLockOverlay: React.FC<PinLockOverlayProps> = ({ onUnlock }) => {
  const { logout, shopProfile } = useAuth();
  const [pin, setPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [isShaking, setIsShaking] = useState<boolean>(false);

  const handleDigitPress = useCallback((digit: string) => {
    if (isSuccess) return;
    setErrorMsg(null);
    try {
      playScanSound();
    } catch {}

    setPin((prev) => {
      if (prev.length >= 5) return prev;
      return prev + digit;
    });
  }, [isSuccess]);

  const handleDeletePress = useCallback(() => {
    if (isSuccess) return;
    setErrorMsg(null);
    try {
      playScanSound();
    } catch {}
    setPin((prev) => prev.slice(0, -1));
  }, [isSuccess]);

  const handleClear = useCallback(() => {
    if (isSuccess) return;
    setErrorMsg(null);
    setPin('');
  }, [isSuccess]);

  // Handle physical keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSuccess) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleDigitPress(e.key);
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        handleDeletePress();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDigitPress, handleDeletePress, handleClear, isSuccess]);

  // When 5 digits are entered, verify automatically
  useEffect(() => {
    if (pin.length !== 5) return;

    const timer = setTimeout(() => {
      const isValid = pinLockService.verifyPin(pin);
      if (isValid) {
        setIsSuccess(true);
        try {
          playSuccessSound();
        } catch {}
        pinLockService.unlockSession();
        setTimeout(() => {
          if (onUnlock) onUnlock();
        }, 600);
      } else {
        setIsShaking(true);
        setErrorMsg('Incorrect PIN code. Please try again.');
        try {
          playErrorSound();
        } catch {}
        setTimeout(() => {
          setIsShaking(false);
          setPin('');
        }, 650);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [pin, onUnlock]);

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center overflow-hidden select-none">
      {/* Styles for spreading color aura & shake animation */}
      <style>{`
        @keyframes auraBreath {
          0%, 100% {
            transform: scale(0.92) translate(0px, 0px);
            opacity: 0.65;
          }
          50% {
            transform: scale(1.18) translate(10px, -15px);
            opacity: 0.9;
          }
        }

        @keyframes auraBreathSecondary {
          0%, 100% {
            transform: scale(1.15) rotate(0deg);
            opacity: 0.55;
          }
          50% {
            transform: scale(0.88) rotate(180deg);
            opacity: 0.8;
          }
        }

        @keyframes cardPopIn {
          0% {
            opacity: 0;
            transform: scale(0.92) translateY(12px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes pinShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-9px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(5px); }
        }

        .animate-aura-primary {
          animation: auraBreath 7s ease-in-out infinite;
        }

        .animate-aura-secondary {
          animation: auraBreathSecondary 10s ease-in-out infinite;
        }

        .animate-card-pop {
          animation: cardPopIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .animate-shake {
          animation: pinShake 0.45s ease-in-out;
        }
      `}</style>

      {/* ── Background Deep Tint + Spreading Color Auras ── */}
      <div className="absolute inset-0 bg-[#0F0814]/85 backdrop-blur-xl transition-opacity duration-500" />

      {/* Spreading Glow Orb 1 (Brand Deep Purple #522D60) */}
      <div className="absolute w-[440px] h-[440px] rounded-full bg-gradient-to-tr from-[#522D60] via-[#7B2E8F] to-[#522D60]/20 blur-[90px] pointer-events-none animate-aura-primary" />

      {/* Spreading Glow Orb 2 (Bright Violet & Soft Amber Gold) */}
      <div className="absolute w-[360px] h-[360px] rounded-full bg-gradient-to-br from-[#A855F7]/40 via-[#EC4899]/30 to-[#F59E0B]/20 blur-[85px] pointer-events-none animate-aura-secondary" />

      {/* Subtle floating ambient particle ring */}
      <div className="absolute w-[500px] h-[500px] rounded-full border border-purple-500/10 pointer-events-none scale-110" />

      {/* ── The Center Popup Card ── */}
      <div className={`relative z-10 w-[92%] max-w-[390px] bg-white/95 backdrop-blur-2xl rounded-3xl p-6 sm:p-7 shadow-[0_24px_60px_-15px_rgba(82,45,96,0.35)] border border-purple-100 flex flex-col items-center text-center animate-card-pop ${
        isShaking ? 'animate-shake' : ''
      }`}>
        
        {/* Animated Brand Mascot Logo at top: Mobile moving its hand saying hello */}
        <div className="mb-2">
          <WavingMobileLogo size={105} />
        </div>

        {/* Brand Greeting Heading */}
        <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
          Welcome to HisaabFlow
        </h1>

        {/* Subtitle / Shop identity */}
        <p className="text-xs text-gray-500 font-medium mt-1">
          {shopProfile.shopName ? `${shopProfile.shopName} • ` : ''}Enter your 5-digit security PIN
        </p>

        {/* ── 5-Digit Visual Dots / Boxes ── */}
        <div className="flex items-center justify-center gap-3 my-5">
          {[0, 1, 2, 3, 4].map((index) => {
            const hasDigit = pin.length > index;
            const isCurrent = pin.length === index;

            return (
              <div
                key={index}
                className={`w-11 h-12 rounded-2xl flex items-center justify-center text-lg font-black transition-all duration-200 ${
                  isSuccess
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-600 scale-105'
                    : errorMsg
                    ? 'border-rose-400 bg-rose-50 text-rose-600'
                    : hasDigit
                    ? 'border-[#522D60] bg-[#FAF5FC] text-[#522D60] shadow-sm'
                    : isCurrent
                    ? 'border-[#522D60] ring-2 ring-[#522D60]/20 bg-white'
                    : 'border-gray-200 bg-gray-50/80 text-gray-400'
                } border-2`}
              >
                {isSuccess ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 animate-scale" />
                ) : hasDigit ? (
                  <span className="w-3.5 h-3.5 rounded-full bg-[#522D60] inline-block animate-[scaleIn_0.15s_ease-out]" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block" />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Error Notification Pill ── */}
        <div className="min-h-[24px] mb-3 flex items-center justify-center">
          {errorMsg ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold animate-fadeIn">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          ) : isSuccess ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>PIN Verified! Unlocking...</span>
            </div>
          ) : (
            <span className="text-[11px] text-gray-400 font-medium">
              Tap keypad or use keyboard to enter PIN
            </span>
          )}
        </div>

        {/* ── Numeric Keypad (Clean, Tactile & Compact) ── */}
        <div className="grid grid-cols-3 gap-2.5 w-full max-w-[280px]">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={isSuccess}
              onClick={() => handleDigitPress(digit)}
              className="h-13 rounded-2xl bg-gray-50 hover:bg-[#FAF5FC] active:bg-[#522D60] active:text-white border border-gray-150 text-gray-800 text-lg font-bold flex items-center justify-center transition-all duration-100 shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {digit}
            </button>
          ))}

          {/* Clear Button */}
          <button
            type="button"
            disabled={isSuccess || pin.length === 0}
            onClick={handleClear}
            className="h-13 rounded-2xl bg-gray-50/70 hover:bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center transition-all cursor-pointer active:scale-95 disabled:opacity-30"
          >
            Clear
          </button>

          {/* Digit 0 */}
          <button
            type="button"
            disabled={isSuccess}
            onClick={() => handleDigitPress('0')}
            className="h-13 rounded-2xl bg-gray-50 hover:bg-[#FAF5FC] active:bg-[#522D60] active:text-white border border-gray-150 text-gray-800 text-lg font-bold flex items-center justify-center transition-all duration-100 shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
          >
            0
          </button>

          {/* Backspace Button */}
          <button
            type="button"
            disabled={isSuccess || pin.length === 0}
            onClick={handleDeletePress}
            className="h-13 rounded-2xl bg-gray-50/70 hover:bg-rose-50 text-gray-600 hover:text-rose-600 flex items-center justify-center transition-all cursor-pointer active:scale-95 disabled:opacity-30"
            aria-label="Backspace"
          >
            <Delete className="w-5 h-5 stroke-[2]" />
          </button>
        </div>

        {/* ── Emergency Reset / Sign Out ── */}
        <div className="mt-5 pt-3 border-t border-gray-100 w-full flex items-center justify-center">
          <button
            type="button"
            onClick={async () => {
              try {
                await logout();
              } catch (e) {
                window.location.reload();
              }
            }}
            className="text-[11px] text-gray-400 hover:text-rose-600 font-semibold flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-rose-50/60 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Forgot PIN? Sign out to use account password</span>
          </button>
        </div>

      </div>
    </div>
  );
};

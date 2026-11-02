import React, { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { pinLockService } from '../utils/pinLockService';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { Lock, ShieldCheck, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';
import { playSuccessSound, playErrorSound } from '../utils/soundEffects';

interface PinLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'set' | 'change' | 'disable';
  onSuccess: () => void;
}

export const PinLockModal: React.FC<PinLockModalProps> = ({
  isOpen,
  onClose,
  mode,
  onSuccess,
}) => {
  const { success, error } = useToast();
  const { user, updateProfileData } = useAuth();
  const userEmail = user?.email || '';
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      setErrorMessage(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // If changing or disabling, must verify current PIN first
    if (mode === 'change' || mode === 'disable') {
      if (!pinLockService.verifyPin(currentPin, userEmail)) {
        setErrorMessage('Current PIN is incorrect.');
        try { playErrorSound(); } catch {}
        return;
      }
    }

    if (mode === 'disable') {
      pinLockService.disable(userEmail);
      updateProfileData({ pinEnabled: false, pinCodeHash: '' }).catch(() => {});
      try { playSuccessSound(); } catch {}
      success('5-Digit PIN Lock disabled.');
      onSuccess();
      onClose();
      return;
    }

    // Setting or Changing new PIN
    if (!/^\d{5}$/.test(newPin)) {
      setErrorMessage('PIN must be exactly 5 digits (0-9).');
      try { playErrorSound(); } catch {}
      return;
    }

    if (newPin !== confirmPin) {
      setErrorMessage('Confirm PIN does not match new PIN.');
      try { playErrorSound(); } catch {}
      return;
    }

    const { ok, hash } = pinLockService.setPin(newPin, userEmail);
    if (ok) {
      updateProfileData({ pinEnabled: true, pinCodeHash: hash }).catch(() => {});
      try { playSuccessSound(); } catch {}
      success(mode === 'change' ? '5-Digit PIN changed successfully!' : '5-Digit PIN Lock enabled successfully!');
      onSuccess();
      onClose();
    } else {
      error('Failed to save PIN.');
    }
  };

  const title =
    mode === 'set'
      ? 'Set 5-Digit PIN Password'
      : mode === 'change'
      ? 'Change 5-Digit PIN Password'
      : 'Disable PIN Lock';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="flex items-center gap-3 p-3 bg-purple-50/70 border border-purple-100 rounded-2xl">
          <div className="w-10 h-10 rounded-xl bg-[#522D60] text-white flex items-center justify-center shrink-0 shadow-sm">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-xs">
              {mode === 'disable' ? 'Confirm Deactivation' : '5-Digit Security Protection'}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {mode === 'disable'
                ? 'Enter your current PIN to turn off the app lock.'
                : 'Your app will prompt for this PIN when reopened.'}
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Current PIN input (if changing or disabling) */}
        {(mode === 'change' || mode === 'disable') && (
          <div>
            <label className="block font-bold text-gray-700 mb-1">
              Enter Current 5-Digit PIN
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={5}
              autoFocus
              required
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 5))}
              placeholder="•••••"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-center tracking-[0.4em] font-mono text-base font-bold bg-white focus:outline-none focus:border-[#522D60] focus:ring-1 focus:ring-[#522D60]"
            />
          </div>
        )}

        {/* New PIN & Confirm PIN (if setting or changing) */}
        {mode !== 'disable' && (
          <>
            <div>
              <label className="block font-bold text-gray-700 mb-1">
                {mode === 'change' ? 'New 5-Digit PIN' : 'Enter 5-Digit PIN Password'}
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={5}
                autoFocus={mode === 'set'}
                required
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="•••••"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-center tracking-[0.4em] font-mono text-base font-bold bg-white focus:outline-none focus:border-[#522D60] focus:ring-1 focus:ring-[#522D60]"
              />
              <p className="text-[10px] text-gray-400 mt-1">Must be exactly 5 numeric digits (0-9)</p>
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">
                Confirm 5-Digit PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={5}
                required
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="•••••"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-center tracking-[0.4em] font-mono text-base font-bold bg-white focus:outline-none focus:border-[#522D60] focus:ring-1 focus:ring-[#522D60]"
              />
            </div>
          </>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} className="text-xs">
            Cancel
          </Button>
          <Button
            type="submit"
            className={`text-xs font-bold ${
              mode === 'disable' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-[#522D60] hover:bg-[#42244E]'
            } text-white`}
          >
            {mode === 'disable' ? 'Confirm Disable' : mode === 'change' ? 'Save New PIN' : 'Activate 5-Digit PIN'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

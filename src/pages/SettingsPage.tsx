import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { 
  Store, User, LogOut, Download, 
  RefreshCw, HardDrive, Cloud, AlertTriangle
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { Modal } from '../components/ui/Modal';
import { 
  syncShopBackupToGoogleDrive, 
  downloadShopBackupLocally, 
  BackupSyncResult 
} from '../utils/googleDriveBackup';
import { getMasterDriveToken } from '../utils/googleAuthHelper';
import { restoreShopBackup, ShopBackupData } from '../utils/backupService';
import { format } from 'date-fns';

export default function SettingsPage() {
  const { 
    user, 
    logout, 
    shopProfile, 
    updateProfileData, 
    connectGoogleDrive 
  } = useAuth();
  const { success, error, toast } = useToast();
  
  // Clean Store Profile State
  const [shopName, setShopName] = useState(shopProfile.shopName || '');
  const [ownerName, setOwnerName] = useState(shopProfile.ownerName || '');
  const [phone, setPhone] = useState(shopProfile.phone || '');
  const [secondaryPhone, setSecondaryPhone] = useState(shopProfile.secondaryPhone || '');
  const [address, setAddress] = useState(shopProfile.address || '');
  const [subTitle, setSubTitle] = useState(shopProfile.subTitle || '');
  const [receiptNote, setReceiptNote] = useState(shopProfile.receiptNote || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Backup State
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [driveSyncResult, setDriveSyncResult] = useState<BackupSyncResult | null>(null);
  const [isDownloadingLocal, setIsDownloadingLocal] = useState(false);
  const [hasMasterDrive, setHasMasterDrive] = useState<boolean | null>(null);
  const [isAuthorizingMaster, setIsAuthorizingMaster] = useState(false);

  // Restore State
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreCandidate, setRestoreCandidate] = useState<ShopBackupData | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (shopProfile) {
      setShopName(shopProfile.shopName || '');
      setOwnerName(shopProfile.ownerName || '');
      setPhone(shopProfile.phone || '');
      setSecondaryPhone(shopProfile.secondaryPhone || '');
      setAddress(shopProfile.address || '');
      setSubTitle(shopProfile.subTitle || '');
      setReceiptNote(shopProfile.receiptNote || '');
    }
    getMasterDriveToken().then(tok => setHasMasterDrive(Boolean(tok)));
  }, [shopProfile]);

  const handleAuthorizeMasterDrive = async () => {
    setIsAuthorizingMaster(true);
    try {
      toast('Connecting Master Google Drive...', 'info');
      await connectGoogleDrive(true);
      setHasMasterDrive(true);
      success('Master Google Drive connected successfully.');
    } catch (err: any) {
      const msg = err.message?.includes('popup') || err.message?.includes('unauthorized')
        ? 'Google authorization window was closed. Please allow popups and try again.'
        : (err.message || 'Failed to connect Master Google Drive.');
      error(msg);
    } finally {
      setIsAuthorizingMaster(false);
    }
  };

  const handleSaveShopProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      await updateProfileData({
        shopName: shopName.trim(),
        ownerName: ownerName.trim(),
        phone: phone.trim(),
        secondaryPhone: secondaryPhone.trim(),
        address: address.trim(),
        subTitle: subTitle.trim(),
        receiptNote: receiptNote.trim(),
      });
      success('Store profile updated successfully.');
    } catch (err: any) {
      error(err.message || 'Error updating store profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSyncToGoogleDrive = async () => {
    setIsSyncingDrive(true);
    try {
      toast('Connecting to Google Drive...', 'info');
      const token = await connectGoogleDrive();
      toast('Uploading store backup...', 'info');
      
      const res = await syncShopBackupToGoogleDrive(shopProfile, token);
      setDriveSyncResult(res);
      await updateProfileData({
        lastBackupTime: res.modifiedTime,
        googleDriveBackupFileId: res.fileId,
      });
      success(`Synced ${res.totalRecords} records to Google Drive.`);
    } catch (err: any) {
      const msg = err.message?.includes('popup') || err.message?.includes('unauthorized')
        ? 'Google authorization window was closed. Please allow popups and try again.'
        : (err.message || 'Failed to sync with Google Drive.');
      error(msg);
    } finally {
      setIsSyncingDrive(false);
    }
  };

  const handleDownloadLocalBackup = async () => {
    setIsDownloadingLocal(true);
    try {
      const total = await downloadShopBackupLocally(shopProfile);
      success(`Downloaded offline backup (${total} records).`);
    } catch (err: any) {
      error('Failed to export local backup.');
    } finally {
      setIsDownloadingLocal(false);
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawJson = event.target?.result as string;
        const parsed = JSON.parse(rawJson) as ShopBackupData;
        if (!parsed.data) {
          throw new Error('Invalid backup file structure.');
        }
        setRestoreCandidate(parsed);
        setShowRestoreModal(true);
      } catch (err: any) {
        error(err.message || 'Invalid backup JSON file.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const executeRestore = async () => {
    if (!restoreCandidate) return;
    setIsRestoring(true);
    try {
      const res = await restoreShopBackup(
        restoreCandidate,
        user?.uid,
        shopProfile.shopId,
        user?.email || shopProfile.ownerEmail
      );
      if (res.success) {
        const total = Object.values(res.restoredCount).reduce((a, b) => a + b, 0);
        success(`Restored ${total} records successfully.`);
        setShowRestoreModal(false);
        setRestoreCandidate(null);
      } else {
        error(res.message || 'Failed to restore backup.');
      }
    } catch (err: any) {
      error(err.message || 'Failed to restore backup.');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
            Store Settings
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Configure store profile, contact information, and data backups.
          </p>
        </div>
      </div>

      {/* ── 1. STORE PROFILE ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2.5">
          <Store className="w-4 h-4 text-[#522D60]" />
          <h2 className="font-bold text-gray-900 text-sm">Store Details</h2>
        </div>

        <form onSubmit={handleSaveShopProfile} className="p-5 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Shop Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={shopName}
                onChange={e => setShopName(e.target.value)}
                placeholder="e.g. Usman Afridi Mobile Center"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs sm:text-sm text-gray-900 bg-white focus:outline-none focus:border-[#522D60] focus:ring-1 focus:ring-[#522D60] transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Owner / Contact Person
              </label>
              <input
                type="text"
                value={ownerName}
                onChange={e => setOwnerName(e.target.value)}
                placeholder="e.g. Usman Afridi"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs sm:text-sm text-gray-900 bg-white focus:outline-none focus:border-[#522D60] focus:ring-1 focus:ring-[#522D60] transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Primary WhatsApp / Phone <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="0300-1234567"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs sm:text-sm text-gray-900 bg-white focus:outline-none focus:border-[#522D60] focus:ring-1 focus:ring-[#522D60] transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Market / Subtitle
              </label>
              <input
                type="text"
                value={subTitle}
                onChange={e => setSubTitle(e.target.value)}
                placeholder="e.g. Bara Bazar, Khyber"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs sm:text-sm text-gray-900 bg-white focus:outline-none focus:border-[#522D60] focus:ring-1 focus:ring-[#522D60] transition-all"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Shop Address
              </label>
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Shop #, Plaza / Market Name"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs sm:text-sm text-gray-900 bg-white focus:outline-none focus:border-[#522D60] focus:ring-1 focus:ring-[#522D60] transition-all"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Receipt Footer Terms / Note
              </label>
              <input
                type="text"
                value={receiptNote}
                onChange={e => setReceiptNote(e.target.value)}
                placeholder="3 days checking warranty. No cash refund."
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs sm:text-sm text-gray-900 bg-white focus:outline-none focus:border-[#522D60] focus:ring-1 focus:ring-[#522D60] transition-all"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button 
              type="submit" 
              disabled={isSavingProfile} 
              isLoading={isSavingProfile}
              className="bg-[#522D60] hover:bg-[#42244D] text-white px-5 py-2 text-xs sm:text-sm"
            >
              Save Details
            </Button>
          </div>
        </form>
      </div>

      {/* ── 2. BACKUP & CLOUD STORAGE ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Cloud className="w-4 h-4 text-[#522D60]" />
            <h2 className="font-bold text-gray-900 text-sm">Cloud & Offline Backups</h2>
          </div>
          {shopProfile.lastBackupTime && (
            <span className="text-[11px] text-gray-500 font-medium">
              Last synced: {format(new Date(shopProfile.lastBackupTime), 'dd MMM yyyy, p')}
            </span>
          )}
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          {/* Master Drive Link Card */}
          <div className="p-3.5 rounded-xl border border-purple-100 bg-purple-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#522D60]">Master Google Drive Storage</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  hasMasterDrive ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-[#522D60]'
                }`}>
                  {hasMasterDrive ? 'Connected' : 'Ready to Connect'}
                </span>
              </div>
              <p className="text-[11px] text-gray-500">
                Target Owner: <span className="font-medium text-gray-700">threadsandtailsshop@gmail.com</span>
              </p>
            </div>

            <Button
              size="sm"
              variant="secondary"
              onClick={handleAuthorizeMasterDrive}
              disabled={isAuthorizingMaster}
              isLoading={isAuthorizingMaster}
              className="text-xs self-start sm:self-auto border-purple-200 text-[#522D60] hover:bg-purple-100/60 font-semibold"
            >
              <Cloud className="w-3.5 h-3.5 mr-1.5 text-[#522D60]" />
              {hasMasterDrive ? 'Refresh Drive Access' : 'Connect Master Drive'}
            </Button>
          </div>

          {/* Backup Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Button 
              onClick={handleSyncToGoogleDrive}
              disabled={isSyncingDrive}
              isLoading={isSyncingDrive}
              className="bg-[#522D60] hover:bg-[#42244D] text-white text-xs sm:text-sm font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isSyncingDrive ? 'animate-spin' : ''}`} />
              Sync to Google Drive
            </Button>

            <Button 
              variant="secondary"
              onClick={handleDownloadLocalBackup}
              disabled={isDownloadingLocal}
              isLoading={isDownloadingLocal}
              className="text-xs sm:text-sm"
            >
              <Download className="w-3.5 h-3.5 mr-1.5 text-gray-500" />
              Download Offline Backup
            </Button>

            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs sm:text-sm"
            >
              <HardDrive className="w-3.5 h-3.5 mr-1.5 text-gray-500" />
              Restore from File
            </Button>
            <input 
              type="file" 
              ref={fileInputRef} 
              accept=".json" 
              className="hidden" 
              onChange={handleFileSelected} 
            />
          </div>
        </div>
      </div>

      {/* ── 3. USER ACCOUNT & SIGN OUT ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-50 text-[#522D60] flex items-center justify-center font-bold">
            <User className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-900">{user?.email || 'Logged In'}</p>
            <p className="text-[11px] text-gray-400">Authenticated Store Account</p>
          </div>
        </div>

        <Button 
          onClick={logout} 
          variant="danger" 
          size="sm"
          className="text-xs font-bold"
        >
          <LogOut className="w-3.5 h-3.5 mr-1.5" />
          Sign Out
        </Button>
      </div>

      {/* RESTORE CONFIRMATION MODAL */}
      <Modal
        isOpen={showRestoreModal}
        onClose={() => !isRestoring && setShowRestoreModal(false)}
        title="Restore Shop Data"
        size="sm"
      >
        {restoreCandidate && (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="font-semibold">
                Importing {restoreCandidate.meta?.totalRecords || 0} records into {shopProfile.shopName}.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button 
                variant="secondary" 
                onClick={() => setShowRestoreModal(false)} 
                disabled={isRestoring}
                className="w-full sm:flex-1 text-xs"
              >
                Cancel
              </Button>
              <Button 
                onClick={executeRestore} 
                disabled={isRestoring} 
                isLoading={isRestoring}
                className="w-full sm:flex-1 bg-[#522D60] text-white text-xs"
              >
                Confirm Restore
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

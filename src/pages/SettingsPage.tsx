import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { 
  Store, User, LogOut, Download, 
  RefreshCw, HardDrive, Cloud, AlertTriangle,
  Upload, Trash2, Image as ImageIcon, Camera, CheckCircle2, Eye, Receipt
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
import { compressImage } from '../utils/imageUtils';
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
  const [logoUrl, setLogoUrl] = useState(shopProfile.logoUrl || '');
  const [avatarUrl, setAvatarUrl] = useState(shopProfile.avatarUrl || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isProcessingLogo, setIsProcessingLogo] = useState(false);
  const [isProcessingAvatar, setIsProcessingAvatar] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

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
      setLogoUrl(shopProfile.logoUrl || '');
      setAvatarUrl(shopProfile.avatarUrl || '');
    }
    getMasterDriveToken().then(tok => setHasMasterDrive(Boolean(tok)));
  }, [shopProfile]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingLogo(true);
    try {
      const compressedDataUrl = await compressImage(file, 480, 0.85);
      setLogoUrl(compressedDataUrl);
      success('Shop logo loaded. Click "Save Details" below to apply it across all bills.');
    } catch (err: any) {
      error(err.message || 'Failed to process image file');
    } finally {
      setIsProcessingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = () => {
    setLogoUrl('');
    success('Shop logo removed. Clean typography will be used on bills.');
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingAvatar(true);
    try {
      const compressedDataUrl = await compressImage(file, 300, 0.85);
      setAvatarUrl(compressedDataUrl);
      success('Profile picture loaded. Click "Save Details" to apply.');
    } catch (err: any) {
      error(err.message || 'Failed to process avatar');
    } finally {
      setIsProcessingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl('');
    success('Profile picture removed.');
  };

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
        logoUrl: logoUrl.trim(),
        avatarUrl: avatarUrl.trim(),
      });
      success('Store profile, logo, and avatar updated successfully.');
    } catch (err: any) {
      error(err.message || 'Error updating store profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSyncToGoogleDrive = async () => {
    setIsSyncingDrive(true);
    try {
      const token = await getMasterDriveToken();
      if (!token) {
        toast('Master Google Drive backup is currently being set up by the Administrator. You can download an offline backup below anytime.', 'info');
        return;
      }
      toast('Syncing shop backup to Master Google Drive...', 'info');
      
      const res = await syncShopBackupToGoogleDrive(shopProfile, token);
      setDriveSyncResult(res);
      await updateProfileData({
        lastBackupTime: res.modifiedTime,
        googleDriveBackupFileId: res.fileId,
      });
      success(`Synced ${res.totalRecords} records to Master Google Drive ("${shopProfile.shopName || 'Shop'} Backup.json").`);
    } catch (err: any) {
      console.warn('Drive sync error:', err);
      error(err.message || 'Failed to sync backup to Google Drive.');
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

      {/* Hidden File Inputs */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        onChange={handleAvatarUpload}
        className="hidden"
      />
      <input
        ref={logoInputRef}
        type="file"
        accept="image/*"
        onChange={handleLogoUpload}
        className="hidden"
      />

      {/* ── 1. PROFILE PICTURE & SHOP LOGO BRANDING ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Card A: Owner Profile Picture */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-[#522D60] flex items-center justify-center">
                <Camera className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Owner Profile Photo</h3>
                <p className="text-[11px] text-gray-400">Displayed in top navigation bar and account profile</p>
              </div>
            </div>

            <div className="flex items-center gap-4 py-3">
              <div className="relative">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Owner Avatar"
                    className="w-20 h-20 rounded-2xl object-cover border-2 border-[#522D60]/20 shadow-md"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-[#522D60] text-white flex items-center justify-center font-black text-2xl uppercase shadow-md">
                    {(ownerName || shopName || 'H').slice(0, 1)}
                  </div>
                )}
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    title="Remove Photo"
                    className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-md transition-transform active:scale-90"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex-1 space-y-2">
                <p className="text-xs text-gray-600">
                  {avatarUrl ? 'Photo loaded successfully.' : 'Upload a clear headshot or personal photo.'}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isProcessingAvatar}
                    onClick={() => avatarInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-xs font-semibold py-1.5 px-3"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {avatarUrl ? 'Change Photo' : 'Upload Photo'}
                  </Button>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 border-t border-gray-50 pt-2.5 mt-2">
            Auto-compressed & stored securely in your shop profile.
          </p>
        </div>

        {/* Card B: Shop Logo & Bill Header */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-[#522D60] flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Shop Logo for Invoices</h3>
                <p className="text-[11px] text-gray-400">Printed on all customer thermal bills, A4 invoices, and receipts</p>
              </div>
            </div>

            <div className="flex items-center gap-4 py-3">
              <div className="relative">
                {logoUrl ? (
                  <div className="w-24 h-16 rounded-xl bg-white border border-gray-200 p-1 flex items-center justify-center shadow-xs">
                    <img
                      src={logoUrl}
                      alt="Shop Logo"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-24 h-16 rounded-xl bg-gray-50 border border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 p-2 text-center">
                    <ImageIcon className="w-5 h-5 text-gray-300 mb-0.5" />
                    <span className="text-[9px] font-bold">NO LOGO</span>
                  </div>
                )}
                {logoUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    title="Remove Logo"
                    className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-md transition-transform active:scale-90"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex-1 space-y-2">
                <p className="text-xs text-gray-600">
                  {logoUrl 
                    ? 'Uploaded logo will replace generic monograms on customer receipts.' 
                    : 'Upload your store emblem or trademark PNG/JPEG.'}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isProcessingLogo}
                    onClick={() => logoInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-xs font-semibold py-1.5 px-3"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {logoUrl ? 'Change Logo' : 'Upload Logo'}
                  </Button>
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Live Bill Header Mini Preview */}
          <div className="mt-3 p-3 bg-gray-900 rounded-xl text-white">
            <div className="flex items-center justify-between text-[10px] text-gray-300 font-bold mb-1.5 uppercase tracking-wider">
              <span>Live Printed Bill Header Preview</span>
              <Eye className="w-3 h-3 text-purple-300" />
            </div>
            <div className="bg-[#522D60] rounded-lg p-2.5 flex items-center justify-center gap-3">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Bill Logo"
                  className="max-h-9 max-w-[70px] object-contain bg-white rounded p-0.5 shrink-0"
                />
              ) : null}
              <div className="text-center min-w-0">
                <p className="font-black text-xs text-white tracking-wide truncate">
                  {shopName || 'Shop Name'}
                </p>
                <p className="text-[9px] text-purple-100 font-medium truncate">
                  {(subTitle || 'Market Subtitle')} • Tel: {(phone || '0300-XXXXXXX')}
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── 2. STORE PROFILE FORM ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Store className="w-4 h-4 text-[#522D60]" />
            <h2 className="font-bold text-gray-900 text-sm">Store Information & Invoicing Contact</h2>
          </div>
          {(logoUrl || avatarUrl) && (
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Custom Branding Active
            </span>
          )}
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
          {/* Cloud Sync Card */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-purple-50/50 border border-purple-100">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-[#522D60]">Master Cloud Backup</p>
              <p className="text-xs text-gray-500">
                Back up your shop data into a dedicated <span className="font-semibold text-gray-700">{shopProfile.shopName || 'Shop'} Backup.json</span> file in the central cloud drive.
              </p>
            </div>
            <Button 
              onClick={handleSyncToGoogleDrive}
              disabled={isSyncingDrive}
              isLoading={isSyncingDrive}
              className="bg-[#522D60] hover:bg-[#42244D] text-white text-xs sm:text-sm font-semibold shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isSyncingDrive ? 'animate-spin' : ''}`} />
              Sync Backup
            </Button>
          </div>

          {/* Backup Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <Button 
              variant="secondary"
              onClick={handleDownloadLocalBackup}
              disabled={isDownloadingLocal}
              isLoading={isDownloadingLocal}
              className="text-xs sm:text-sm"
            >
              <Download className="w-3.5 h-3.5 mr-1.5 text-gray-500" />
              Download Offline Backup (.json)
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

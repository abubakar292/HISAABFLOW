import { Bell, LogOut, Menu, ChevronDown, Settings, ShieldCheck, Store, ShoppingCart } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { isDocForShop } from '../../utils/multiTenantService';

interface NavbarProps {
  onMenuClick?: () => void;
  showMenuButton?: boolean;
}

export function Navbar({ onMenuClick, showMenuButton }: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, shopProfile, currentShopId } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [lowStockMobiles, setLowStockMobiles] = useState<any[]>([]);

  const isSuperAdminRoute = location.pathname === '/super-admin';
  const isMasterAdmin = 
    (user?.email || '').toLowerCase() === 'threadsandtailsshop@gmail.com' ||
    (user?.email || '').toLowerCase() === 'admin@hisaabflow.com' ||
    Boolean(localStorage.getItem('master_admin_session'));

  useEffect(() => {
    // Super admin portal does not track shop stock alerts
    if (!user || isSuperAdminRoute) {
      setLowStockMobiles([]);
      return;
    }
    const q = collection(db, 'mobiles');
    const unsub = onSnapshot(
      q,
      (snap) => {
        const lowStock = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((m: any) => 
            isDocForShop(m, currentShopId) && 
            (Number(m.quantity) || 0) <= 2 && 
            (Number(m.quantity) || 0) > 0
          );
        setLowStockMobiles(lowStock);
      },
      (err) => {
        console.warn('Navbar stock alerts listener paused:', err.message);
        setLowStockMobiles([]);
      }
    );
    return unsub;
  }, [user, currentShopId, isSuperAdminRoute]);

  return (
    <header className="bg-white border-b border-gray-100 flex items-center px-4 sm:px-6 gap-3 flex-shrink-0 z-30 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-2.5 min-h-[calc(3.75rem+env(safe-area-inset-top,0px))]">
      {/* Hamburger (mobile only - hidden in Super Admin) */}
      {!isSuperAdminRoute && showMenuButton && onMenuClick && (
        <button
          onClick={onMenuClick}
          className="p-1.5 -ml-1 rounded-xl text-gray-700 hover:bg-gray-100 transition-colors lg:hidden active:scale-95 shrink-0 cursor-pointer"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5 stroke-[2.2]" />
        </button>
      )}

      {/* Universal Brand & Shop Name */}
      <div 
        onClick={() => navigate(isSuperAdminRoute ? '/super-admin' : '/dashboard')}
        className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 cursor-pointer select-none"
      >
        <img 
          src="/logo.png" 
          alt="HISAABFLOW" 
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-contain shrink-0 drop-shadow-xs" 
        />
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 truncate">
            <span className="font-extrabold text-sm sm:text-base text-gray-900 tracking-tight truncate">
              {isSuperAdminRoute ? 'HISAABFLOW' : (shopProfile.shopName || 'HISAABFLOW')}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FAF5FC] text-[#522D60] border border-[#522D60]/20 shrink-0">
              {isSuperAdminRoute ? 'Super Admin' : 'POS'}
            </span>
          </div>
          <span className="text-[11px] text-gray-400 font-medium tracking-wide truncate hidden sm:block">
            {isSuperAdminRoute 
              ? 'Master SaaS Billing & Tenant Management' 
              : (shopProfile.subTitle || 'HISAABFLOW Mobile Shop Cloud Engine')}
          </span>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">

        {/* Purchase Mobile quick navigation in Navbar */}
        {!isSuperAdminRoute && (
          <button
            type="button"
            onClick={() => navigate('/purchase-mobile')}
            className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer ${
              location.pathname === '/purchase-mobile'
                ? 'bg-[#522D60] text-white shadow-xs'
                : 'bg-[#FAF5FC] text-[#522D60] hover:bg-[#F3E8FA] border border-[#522D60]/20'
            }`}
            title="Purchase Mobile"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Purchase Mobile</span>
          </button>
        )}

        {/* Low Stock Alerts Notification Bell - ONLY shown in Shop POS, NEVER in Super Admin */}
        {!isSuperAdminRoute && (
          <div className="relative">
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowNotifications(prev => !prev);
              }}
              className="p-2 rounded-xl text-gray-600 hover:bg-gray-100 hover:text-[#522D60] transition-colors relative active:scale-95 cursor-pointer"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {lowStockMobiles.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full animate-pulse ring-2 ring-white" />
              )}
            </button>
            
            <AnimatePresence>
              {showNotifications && (
                <>
                  <div 
                    className="fixed inset-0 z-40 bg-black/10 sm:bg-transparent" 
                    onClick={() => setShowNotifications(false)} 
                  />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="fixed inset-x-3 sm:absolute sm:inset-x-auto sm:right-0 top-[calc(3.75rem+env(safe-area-inset-top,0px)+8px)] sm:top-full sm:mt-2 w-auto sm:w-80 max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 z-50 text-left"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h4 className="text-xs font-bold text-gray-900 border-b border-gray-100 pb-2 mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Bell className="w-3.5 h-3.5 text-[#522D60]" />
                        <span>Low Stock Alerts</span>
                      </div>
                      <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
                        {lowStockMobiles.length} items
                      </span>
                    </h4>
                    {lowStockMobiles.length === 0 ? (
                      <p className="text-xs text-gray-500 py-3 text-center">All mobile stocks are healthy</p>
                    ) : (
                      <div className="max-h-60 overflow-y-auto space-y-2">
                        {lowStockMobiles.map((m) => (
                          <div key={m.id} className="flex items-center justify-between text-xs p-2 bg-rose-50/70 rounded-xl border border-rose-100">
                            <div>
                              <p className="font-semibold text-gray-900">{m.brand || m.company} {m.modelName || m.model}</p>
                              <p className="text-[10px] text-gray-500">Remaining: {m.quantity}</p>
                            </div>
                            <button 
                              type="button"
                              onClick={() => { setShowNotifications(false); navigate('/purchase-mobile'); }}
                              className="text-[10px] bg-rose-600 text-white font-bold px-2.5 py-1 rounded-lg hover:bg-rose-700 cursor-pointer"
                            >
                              Restock
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* User Account Menu */}
        <div className="relative">
          <button 
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-gray-100 transition-colors active:scale-95 cursor-pointer"
            aria-label="User menu"
          >
            {shopProfile.avatarUrl && !isSuperAdminRoute ? (
              <img 
                src={shopProfile.avatarUrl} 
                alt={shopProfile.ownerName || 'Profile'} 
                className="w-8 h-8 rounded-xl object-cover border border-[#522D60]/20 shadow-xs" 
              />
            ) : (
              <div className="w-8 h-8 rounded-xl bg-[#522D60] text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs">
                {isSuperAdminRoute ? 'A' : (shopProfile.ownerName || shopProfile.shopName || 'H').slice(0, 1)}
              </div>
            )}
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </button>

          <AnimatePresence>
            {showDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 z-50 text-left"
                >
                  <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2.5">
                    {shopProfile.avatarUrl && !isSuperAdminRoute ? (
                      <img 
                        src={shopProfile.avatarUrl} 
                        alt="Avatar" 
                        className="w-9 h-9 rounded-xl object-cover border border-purple-100 shrink-0" 
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-[#522D60] text-white flex items-center justify-center font-bold text-xs uppercase shrink-0">
                        {isSuperAdminRoute ? 'A' : (shopProfile.ownerName || shopProfile.shopName || 'H').slice(0, 1)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-gray-900 truncate">
                        {isSuperAdminRoute ? 'Super Admin Portal' : (shopProfile.ownerName || shopProfile.shopName)}
                      </p>
                      <p className="text-[11px] text-gray-500 truncate">{user?.email || 'Logged In'}</p>
                    </div>
                  </div>

                  <div className="py-1">
                    {/* If currently in POS and user is Master Admin, allow switching to Super Admin */}
                    {!isSuperAdminRoute && isMasterAdmin && (
                      <button
                        onClick={() => { setShowDropdown(false); navigate('/super-admin'); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-[#522D60] bg-[#FAF5FC] hover:bg-[#F3E8FA] rounded-xl transition-colors mb-1"
                      >
                        <ShieldCheck className="w-4 h-4 text-[#522D60]" />
                        <span>Super Admin SaaS Portal</span>
                      </button>
                    )}


                    {!isSuperAdminRoute && (
                      <button
                        onClick={() => { setShowDropdown(false); navigate('/settings'); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                      >
                        <Settings className="w-4 h-4 text-gray-500" />
                        <span>Shop Settings</span>
                      </button>
                    )}

                    <button
                      onClick={() => { setShowDropdown(false); logout(); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}

import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, ShoppingCart, Smartphone, TrendingUp, Receipt, 
  ReceiptText, BookOpen, Package, Settings, X, ShieldCheck 
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const location = useLocation();
  const { user, shopProfile } = useAuth();
  const isSuperAdmin = (user?.email || '').toLowerCase() === 'threadsandtailsshop@gmail.com';

  const sections = [
    {
      title: null,
      items: [
        { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      ]
    },
    {
      title: 'Inventory & Stock',
      items: [
        { path: '/purchase-mobile', icon: ShoppingCart, label: 'Purchase Mobile' },
        { path: '/mobiles-stock', icon: Smartphone, label: 'Mobiles Stock' },
      ]
    },
    {
      title: 'Sales & Accounting',
      items: [
        { path: '/mobile-sales', icon: TrendingUp, label: 'Sales Records' },
        { path: '/bills-history', icon: Receipt, label: 'Bills & Invoices' },
        { path: '/expenses', icon: ReceiptText, label: 'Shop Expenses' },
        { path: '/khata', icon: BookOpen, label: 'Customer Khata' },
      ]
    },
    {
      title: 'Audit & Settings',
      items: [
        { path: '/inventory-valuation', icon: Package, label: 'Inventory Valuation' },
        { path: '/settings', icon: Settings, label: 'Store Settings' },
      ]
    },
  ];

  return (
    <aside className="h-full bg-[#140D19] text-white flex flex-col overflow-hidden border-r border-white/10">
      {/* Header with Official HISAABFLOW Brand */}
      <div className="pt-[env(safe-area-inset-top,0px)] min-h-[calc(4.25rem+env(safe-area-inset-top,0px))] flex items-center justify-between px-5 border-b border-white/10 shrink-0 bg-[#1A0E21]">
        <div className="flex items-center gap-3 min-w-0">
          <img 
            src="/logo.png" 
            alt="HISAABFLOW" 
            className="w-9 h-9 rounded-xl object-contain shrink-0" 
          />
          <div className="flex flex-col min-w-0">
            <span className="font-extrabold text-white text-base tracking-tight truncate leading-tight">
              HISAABFLOW
            </span>
            <span className="text-[10px] text-purple-300 font-semibold tracking-wider uppercase truncate">
              {shopProfile.shopName || 'POS & Accounting'}
            </span>
          </div>
        </div>

        {/* Mobile Close X button */}
        {onNavigate && (
          <button
            onClick={onNavigate}
            className="lg:hidden p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto py-5 px-3 space-y-5">
        {sections.map((section, idx) => (
          <div key={idx} className="space-y-1">
            {section.title && (
              <div className="px-3 mb-1.5 text-[10px] font-bold tracking-wider text-purple-300/50 uppercase">
                {section.title}
              </div>
            )}
            
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onNavigate}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all ${
                    isActive 
                      ? 'bg-[#522D60] text-white font-bold shadow-lg shadow-[#522D60]/40 ring-1 ring-white/20' 
                      : 'text-gray-300 hover:text-white hover:bg-white/5 font-medium'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        ))}

        {/* Super Admin SaaS Portal - Only visible for threadsandtailsshop@gmail.com */}
        {isSuperAdmin && (
          <div className="pt-2 border-t border-white/10">
            <div className="px-3 mb-1.5 text-[10px] font-bold tracking-wider text-purple-300/50 uppercase">
              Platform Admin
            </div>
            <NavLink
              to="/super-admin"
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all ${
                location.pathname === '/super-admin'
                  ? 'bg-purple-600 text-white font-bold shadow-lg ring-1 ring-white/20'
                  : 'text-purple-300 hover:text-white hover:bg-white/10 font-semibold'
              }`}
            >
              <ShieldCheck className="w-4 h-4 shrink-0 text-purple-300" />
              <span className="truncate">Super Admin SaaS</span>
            </NavLink>
          </div>
        )}
      </div>
    </aside>
  );
}

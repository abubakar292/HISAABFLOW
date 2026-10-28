import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Smartphone, TrendingUp, ReceiptText, Menu } from 'lucide-react';
import { motion } from 'framer-motion';

interface BottomNavProps {
  onOpenMenu: () => void;
}

export function BottomNav({ onOpenMenu }: BottomNavProps) {
  const location = useLocation();

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Home' },
    { path: '/mobiles-stock', icon: Smartphone, label: 'Stock' },
    { path: '/mobile-sales', icon: TrendingUp, label: 'Sales' },
    { path: '/expenses', icon: ReceiptText, label: 'Expenses' },
  ];

  return (
    <div className="lg:hidden fixed bottom-4 left-3 right-3 sm:left-6 sm:right-6 max-w-md mx-auto z-40 pointer-events-none pb-[env(safe-area-inset-bottom,0px)]">
      <nav 
        className="pointer-events-auto relative flex items-center justify-between px-3 py-2 rounded-full border border-white/15 shadow-[0_12px_36px_rgba(82,45,96,0.38)] backdrop-blur-2xl"
        style={{
          background: 'linear-gradient(135deg, rgba(24, 15, 30, 0.90) 0%, rgba(16, 10, 20, 0.92) 100%)',
        }}
        aria-label="Mobile Navigation"
      >
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`relative flex flex-col items-center justify-center flex-1 py-1 px-1 transition-all duration-200 select-none ${
                isActive ? 'text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {/* Soft Ambient Brand Glow under active item */}
              {isActive && (
                <>
                  <motion.div
                    layoutId="navbar-ambient-glow"
                    className="absolute -bottom-2 w-10 h-7 rounded-full pointer-events-none"
                    style={{
                      background: 'radial-gradient(ellipse at center, rgba(168, 85, 247, 0.9) 0%, rgba(82, 45, 96, 0.6) 55%, transparent 80%)',
                      filter: 'blur(5px)',
                    }}
                    transition={{ type: 'spring', damping: 24, stiffness: 300 }}
                  />
                  <motion.div
                    layoutId="navbar-active-pill"
                    className="absolute inset-0 rounded-full bg-white/[0.08] pointer-events-none"
                    transition={{ type: 'spring', damping: 25, stiffness: 320 }}
                  />
                </>
              )}

              <Icon
                className={`relative z-10 w-5 h-5 transition-transform duration-200 ${
                  isActive ? 'scale-110 stroke-[2.4] text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]' : 'stroke-[1.8]'
                }`}
              />
              <span className={`relative z-10 text-[10px] mt-0.5 tracking-tight font-medium ${
                isActive ? 'font-bold text-white' : 'text-gray-400'
              }`}>
                {item.label}
              </span>
            </NavLink>
          );
        })}

        {/* Menu Drawer Toggle */}
        <button
          onClick={onOpenMenu}
          className="relative flex flex-col items-center justify-center flex-1 py-1 px-1 text-gray-400 hover:text-white transition-all duration-200 select-none cursor-pointer"
          aria-label="More navigation options"
        >
          <Menu className="w-5 h-5 stroke-[1.8]" />
          <span className="text-[10px] mt-0.5 tracking-tight font-medium text-gray-400">
            More
          </span>
        </button>
      </nav>
    </div>
  );
}

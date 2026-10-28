import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { BottomNav } from './BottomNav';
import { motion, AnimatePresence } from 'framer-motion';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  const location = useLocation();

  useEffect(() => {
    const handleResize = () => {
      const desktop = window.innerWidth >= 1024;
      setIsDesktop(desktop);
      if (desktop) setSidebarOpen(false); // reset on desktop
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close sidebar when route changes (mobile)
  const closeSidebar = () => setSidebarOpen(false);

  const isSuperAdminRoute = location.pathname === '/super-admin';

  // Dedicated full-width layout for Master Super Admin portal
  if (isSuperAdminRoute) {
    return (
      <div className="flex h-screen overflow-hidden bg-surface-2 antialiased selection:bg-[#522D60] selection:text-white">
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          <Navbar showMenuButton={false} />
          <main className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="p-3.5 sm:p-6 lg:p-8 max-w-7xl mx-auto pb-12">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface-2 antialiased selection:bg-[#522D60] selection:text-white">
      {/* ── DESKTOP SIDEBAR (always visible on lg+) ── */}
      <aside className="hidden lg:flex lg:flex-shrink-0">
        <div className="w-[260px] flex flex-col h-full shadow-sidebar relative z-20">
          <Sidebar onNavigate={closeSidebar} />
        </div>
      </aside>

      {/* ── MOBILE SIDEBAR (drawer overlay) ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
              onClick={closeSidebar}
            />
            {/* Drawer */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="fixed inset-y-0 left-0 z-50 w-[270px] max-w-[85vw] flex flex-col lg:hidden shadow-2xl"
            >
              <Sidebar onNavigate={closeSidebar} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Navbar */}
        <Navbar
          onMenuClick={() => setSidebarOpen(true)}
          showMenuButton={!isDesktop}
        />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-3.5 sm:p-6 lg:p-8 max-w-7xl mx-auto pb-24 lg:pb-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.99 }}
                transition={{ duration: 0.2 }}
                className="min-h-full"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* ── MOBILE BOTTOM NAVIGATION BAR ── */}
        <BottomNav 
          onOpenMenu={() => setSidebarOpen(true)} 
        />
      </div>
    </div>
  );
}

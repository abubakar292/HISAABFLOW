import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ConfirmProvider } from './contexts/ConfirmContext';
import { ProtectedRoute, PublicRoute } from './components/ProtectedRoute';
import AppLoader from './components/AppLoader';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PurchaseMobilePage from './pages/PurchaseMobilePage';
import MobilesStockPage from './pages/MobilesStockPage';
import MobileSalesPage from './pages/MobileSalesPage';
import BillsHistoryPage from './pages/BillsHistoryPage';
import ExpensesPage from './pages/ExpensesPage';
import KhataPage from './pages/KhataPage';
import CustomerLedgerPage from './pages/CustomerLedgerPage';
import InventoryValuationPage from './pages/InventoryValuationPage';
import SettingsPage from './pages/SettingsPage';
import SuperAdminPage from './pages/SuperAdminPage';
import Layout from './components/layout/Layout';

function AppBootstrap({ children }: { children: React.ReactNode }) {
  // Allow loader to spin 3-4 cycles (~2.8 seconds) on initial launch
  const [minSpinsCompleted, setMinSpinsCompleted] = useState(false);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

  useEffect(() => {
    // 3-4 full rotations of loader (1.4s per rotation = ~2.8s)
    const spinTimer = setTimeout(() => {
      setMinSpinsCompleted(true);
    }, 2800);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearTimeout(spinTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Show loader if 3-4 spins haven't completed yet OR if internet is not present
  const shouldShowLoader = !minSpinsCompleted || !isOnline;

  return (
    <>
      <AppLoader isLoading={shouldShowLoader} />
      {children}
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>
          <AppBootstrap>
          <Router>
            <Routes>
              <Route element={<PublicRoute />}>
                <Route path="/login" element={<LoginPage />} />
              </Route>

              <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/purchase-mobile" element={<PurchaseMobilePage />} />
                  <Route path="/mobiles-stock" element={<MobilesStockPage />} />
                  <Route path="/mobile-sales" element={<MobileSalesPage />} />
                  <Route path="/bills-history" element={<BillsHistoryPage />} />
                  <Route path="/expenses" element={<ExpensesPage />} />
                  <Route path="/khata" element={<KhataPage />} />
                  <Route path="/khata/:id" element={<CustomerLedgerPage />} />
                  <Route path="/inventory-valuation" element={<InventoryValuationPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/super-admin" element={<SuperAdminPage />} />
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </AppBootstrap>
      </AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}

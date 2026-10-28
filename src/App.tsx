import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ProtectedRoute, PublicRoute } from './components/ProtectedRoute';
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

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
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
      </AuthProvider>
    </ToastProvider>
  );
}

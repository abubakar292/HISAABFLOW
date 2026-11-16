import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppLoader from '../components/AppLoader';
import { evaluateSubscriptionAccess } from '../utils/multiTenantService';
import SubscriptionPage from '../pages/SubscriptionPage';

export function ProtectedRoute() {
  const { user, shopProfile, loading, isMasterAdmin } = useAuth();
  const location = useLocation();
  const [, setTick] = useState(0);

  // Re-evaluate time-based trial or monthly subscription expiry every 30 seconds while tab is open
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  if (loading && !user) return <AppLoader isLoading={true} />;
  
  if (!user) return <Navigate to="/login" replace />;

  // Super Admin credentials have exclusive access to Admin Panel (/super-admin); POS is not available
  if (isMasterAdmin && location.pathname !== '/super-admin') {
    return <Navigate to="/super-admin" replace />;
  }

  // Enforce Subscription & 2-Day Free Trial Gate for client accounts
  if (!isMasterAdmin) {
    const access = evaluateSubscriptionAccess(shopProfile, isMasterAdmin);
    if (access.isLocked) {
      return <SubscriptionPage />;
    }
  }

  return <Outlet />;
}

export function PublicRoute() {
  const { user, loading, isMasterAdmin } = useAuth();

  if (loading && !user) return <AppLoader isLoading={true} />;
  
  if (user) return <Navigate to={isMasterAdmin ? '/super-admin' : '/dashboard'} replace />;

  return <Outlet />;
}



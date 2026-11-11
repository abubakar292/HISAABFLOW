import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppLoader from '../components/AppLoader';

export function ProtectedRoute() {
  const { user, loading, isMasterAdmin } = useAuth();
  const location = useLocation();

  if (loading && !user) return <AppLoader isLoading={true} />;
  
  if (!user) return <Navigate to="/login" replace />;

  // Super Admin credentials have exclusive access to Admin Panel (/super-admin); POS is not available
  if (isMasterAdmin && location.pathname !== '/super-admin') {
    return <Navigate to="/super-admin" replace />;
  }

  return <Outlet />;
}

export function PublicRoute() {
  const { user, loading, isMasterAdmin } = useAuth();

  if (loading && !user) return <AppLoader isLoading={true} />;
  
  if (user) return <Navigate to={isMasterAdmin ? '/super-admin' : '/dashboard'} replace />;

  return <Outlet />;
}



import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppLoader from '../components/AppLoader';

export function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading && !user) return <AppLoader isLoading={true} />;
  
  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}

export function PublicRoute() {
  const { user, loading, isMasterAdmin } = useAuth();

  if (loading && !user) return <AppLoader isLoading={true} />;
  
  if (user) return <Navigate to={isMasterAdmin ? '/super-admin' : '/dashboard'} replace />;

  return <Outlet />;
}


import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppLoader from '../components/AppLoader';

export function ProtectedRoute() {
  const { user, loading, currentShopId } = useAuth();

  if (loading || (user && !currentShopId)) return <AppLoader isLoading={true} />;
  
  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}

export function PublicRoute() {
  const { user, loading } = useAuth();

  if (loading) return <AppLoader isLoading={true} />;
  
  if (user) return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}

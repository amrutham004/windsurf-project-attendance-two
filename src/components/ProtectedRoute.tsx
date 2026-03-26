import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getAuthUser, canAccessPath, getDefaultRedirectPath, UserRole } from '@/lib/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const location = useLocation();
  const user = getAuthUser();

  // Not authenticated - redirect to login
  if (!user) {
    // Store the original URL with query params for redirect after login
    const originalUrl = location.pathname + location.search;
    sessionStorage.setItem('redirectAfterLogin', originalUrl);
    
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if user's role is allowed
  if (!allowedRoles.includes(user.role)) {
    // Redirect to user's default page
    const redirectPath = getDefaultRedirectPath(user.role);
    return <Navigate to={redirectPath} replace />;
  }

  // Check if user can access this specific path
  if (!canAccessPath(location.pathname, user.role)) {
    const redirectPath = getDefaultRedirectPath(user.role);
    return <Navigate to={redirectPath} replace />;
  }

  // User is authenticated and authorized
  return <>{children}</>;
};

export default ProtectedRoute;

import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Spinner } from '@librechat/client';
import { useAuthContext } from '~/hooks/AuthContext';

/**
 * Protected route guard that requires authentication.
 * Redirects unauthenticated users to login page.
 */
export default function ProtectedRoute() {
  const { isAuthenticated } = useAuthContext();
  const location = useLocation();
  const navigate = useNavigate();
  const [isReady, setIsReady] = useState(false);

  // Wait for auth state to be determined
  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isReady && !isAuthenticated) {
      // Redirect to login with return URL
      const redirectPath = encodeURIComponent(location.pathname + location.search);
      navigate(`/login?redirect=${redirectPath}`, { replace: true });
    }
  }, [isReady, isAuthenticated, location.pathname, location.search, navigate]);

  // Show loading spinner while checking auth state
  if (!isReady) {
    return (
      <div className="flex h-screen items-center justify-center" aria-live="polite" role="status">
        <Spinner className="text-text-primary" />
      </div>
    );
  }

  // If not authenticated, don't render children while redirecting
  if (!isAuthenticated) {
    return null;
  }

  return <Outlet />;
}

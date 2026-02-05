import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthContext } from '~/hooks/AuthContext';
import { isDemoMode } from '~/utils/demoMode';

/**
 * Paths that guests are allowed to access without authentication.
 * All other routes will redirect to login.
 */
const GUEST_ALLOWED_PATHS = ['/c', '/login', '/login/2fa'];
const DEMO_ALLOWED_PATHS = ['/c/new', '/login', '/login/2fa'];

/**
 * Check if a path is allowed for guests.
 * Handles both exact matches and prefix matches (e.g., /c/new, /c/123).
 */
function isGuestAllowedPath(pathname: string): boolean {
  const normalizedPath = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  for (const allowed of GUEST_ALLOWED_PATHS) {
    if (normalizedPath === allowed || normalizedPath.startsWith(`${allowed}/`)) {
      return true;
    }
  }
  return false;
}

function isDemoAllowedPath(pathname: string): boolean {
  const normalizedPath = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return DEMO_ALLOWED_PATHS.some((allowed) => normalizedPath === allowed);
}

/**
 * Get the normalized pathname, removing the base href prefix if present.
 * This handles subdirectory deployments where base href is set.
 */
function getNormalizedPathname(pathname: string): string {
  const baseEl = document.querySelector('base');
  const baseHref = baseEl?.getAttribute('href') || '/';

  if (baseHref !== '/' && pathname.startsWith(baseHref)) {
    const stripped = pathname.slice(baseHref.length);
    return stripped.startsWith('/') ? stripped : `/${stripped}`;
  }
  return pathname;
}

/**
 * Route guard that restricts guests from accessing protected routes.
 * Guests can only access chat pages (/c/*) and login pages.
 * Other routes redirect to /login with a redirect query parameter.
 */
export default function GuestRouteGuard() {
  const { isAuthenticated } = useAuthContext();
  const location = useLocation();
  const navigate = useNavigate();
  // Track if initial auth check has completed (prevents redirect flash on first render)
  const [isReady, setIsReady] = useState(false);

  const normalizedPath = getNormalizedPathname(location.pathname);
  const demoMode = isDemoMode();
  const isAllowed = demoMode ? isDemoAllowedPath(normalizedPath) : isGuestAllowedPath(normalizedPath);
  const isGuest = !isAuthenticated;
  const shouldRedirect = isReady && isGuest && !isAllowed;

  // Mark as ready after first render to allow auth state to settle
  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (shouldRedirect) {
      if (demoMode) {
        navigate('/c/new', { replace: true });
        return;
      }
      const redirectPath = encodeURIComponent(location.pathname + location.search);
      navigate(`/login?redirect=${redirectPath}`, { replace: true });
    }
  }, [shouldRedirect, location.pathname, location.search, navigate, demoMode]);

  // Wait for auth state to be determined before rendering
  if (!isReady) {
    return null;
  }

  // If guest on protected route, don't render children while redirecting
  if (shouldRedirect) {
    return null;
  }

  return <Outlet />;
}

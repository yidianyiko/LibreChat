import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from './AuthContext';
import { isDemoMode } from '~/utils/demoMode';

/**
 * Hook for handling guest mode functionality.
 * Guests can view the UI but are redirected to login when attempting actions.
 */
export default function useGuestMode() {
  const { isAuthenticated } = useAuthContext();
  const navigate = useNavigate();

  const isGuest = !isAuthenticated;

  /**
   * Redirect to login page with return URL.
   * Use this when a guest tries to perform an action that requires authentication.
   */
  const redirectToLogin = useCallback(
    (returnUrl?: string) => {
      if (isDemoMode()) {
        navigate('/login', { replace: true });
        return;
      }
      const currentPath = returnUrl || window.location.pathname;
      navigate(`/login?redirect=${encodeURIComponent(currentPath)}`, { replace: true });
    },
    [navigate],
  );

  /**
   * Guard function that redirects guests to login.
   * Returns true if user is a guest (action should be blocked), false if authenticated.
   */
  const requireAuth = useCallback(
    (returnUrl?: string): boolean => {
      if (isGuest) {
        redirectToLogin(returnUrl);
        return true;
      }
      return false;
    },
    [isGuest, redirectToLogin],
  );

  return {
    isGuest,
    isAuthenticated,
    redirectToLogin,
    requireAuth,
  };
}

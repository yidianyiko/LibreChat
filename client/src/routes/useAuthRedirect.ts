import { useAuthContext } from '~/hooks';

/**
 * Hook for auth state in routes.
 */
export default function useAuthRedirect() {
  const { user, roles, isAuthenticated } = useAuthContext();

  return {
    user,
    roles,
    isAuthenticated,
  };
}

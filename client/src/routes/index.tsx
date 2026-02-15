import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { useState, useEffect, lazy, Suspense } from 'react';
import { Spinner } from '@librechat/client';
import {
  Login,
  VerifyEmail,
  Registration,
  ResetPassword,
  ApiErrorWatcher,
  TwoFactorScreen,
  RequestPasswordReset,
  ProtectedRoute,
} from '~/components/Auth';
import { MarketplaceProvider } from '~/components/Agents/MarketplaceContext';
import { AuthContextProvider, useAuthContext } from '~/hooks/AuthContext';
import RouteErrorBoundary from './RouteErrorBoundary';
import StartupLayout from './Layouts/Startup';
import LoginLayout from './Layouts/Login';
import dashboardRoutes from './Dashboard';
import Root from './Root';

const OAuthSuccess = lazy(() =>
  import('~/components/OAuth').then((m) => ({ default: m.OAuthSuccess }))
);
const OAuthError = lazy(() =>
  import('~/components/OAuth').then((m) => ({ default: m.OAuthError }))
);
const RechargePage = lazy(() =>
  import('~/components/Recharge/RechargePage').then((m) => ({ default: m.RechargePage }))
);
const PaymentSuccessPage = lazy(() =>
  import('~/components/Recharge/PaymentSuccessPage').then((m) => ({ default: m.PaymentSuccessPage }))
);
const PaymentCancelPage = lazy(() =>
  import('~/components/Recharge/PaymentCancelPage').then((m) => ({ default: m.PaymentCancelPage }))
);
const RechargeHistoryPage = lazy(() =>
  import('~/components/Recharge/RechargeHistoryPage').then((m) => ({ default: m.RechargeHistoryPage }))
);
const LandingPage = lazy(() =>
  import('~/components/LandingPage/LandingPage').then((m) => ({ default: m.default }))
);
const MissionPage = lazy(() =>
  import('~/components/LandingPage/MissionPage').then((m) => ({ default: m.default }))
);
const AgentMarketplace = lazy(() =>
  import('~/components/Agents/Marketplace').then((m) => ({ default: m.default }))
);
const ShareRoute = lazy(() => import('./ShareRoute').then((m) => ({ default: m.default })));
const ChatRoute = lazy(() => import('./ChatRoute').then((m) => ({ default: m.default })));
const Search = lazy(() => import('./Search').then((m) => ({ default: m.default })));

const LoadingFallback = () => (
  <div className="flex h-screen items-center justify-center" aria-live="polite" role="status">
    <Spinner className="text-text-primary" />
  </div>
);

const AuthLayout = () => (
  <AuthContextProvider>
    <ApiErrorWatcher />
    <Outlet />
  </AuthContextProvider>
);

/**
 * Landing page guard - redirects authenticated users to chat
 */
const LandingPageGuard = () => {
  const { isAuthenticated } = useAuthContext();
  const [isReady, setIsReady] = useState(false);

  // Wait for auth state to be determined
  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Show loading while checking auth state
  if (!isReady) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <div className="flex h-screen items-center justify-center" aria-live="polite" role="status">
          <Spinner className="text-text-primary" />
        </div>
      </Suspense>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/c/new" replace />;
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
      <LandingPage />
    </Suspense>
  );
};

const baseEl = document.querySelector('base');
const baseHref = baseEl?.getAttribute('href') || '/';

export const router = createBrowserRouter(
  [
    {
      path: '/',
      index: true,
      element: (
        <Suspense fallback={<LoadingFallback />}>
          <AuthContextProvider>
            <LandingPageGuard />
          </AuthContextProvider>
        </Suspense>
      ),
      errorElement: <RouteErrorBoundary />,
    },
    {
      path: 'mission',
      element: (
        <Suspense fallback={<LoadingFallback />}>
          <MissionPage />
        </Suspense>
      ),
      errorElement: <RouteErrorBoundary />,
    },
    {
      path: 'share/:shareId',
      element: (
        <Suspense fallback={<LoadingFallback />}>
          <ShareRoute />
        </Suspense>
      ),
      errorElement: <RouteErrorBoundary />,
    },
    {
      path: 'oauth',
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          path: 'success',
          element: (
            <Suspense fallback={<LoadingFallback />}>
              <OAuthSuccess />
            </Suspense>
          ),
        },
        {
          path: 'error',
          element: (
            <Suspense fallback={<LoadingFallback />}>
              <OAuthError />
            </Suspense>
          ),
        },
      ],
    },
    {
      path: '/',
      element: <StartupLayout />,
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          path: 'register',
          element: <Registration />,
        },
        {
          path: 'forgot-password',
          element: <RequestPasswordReset />,
        },
        {
          path: 'reset-password',
          element: <ResetPassword />,
        },
      ],
    },
    {
      path: 'verify',
      element: <VerifyEmail />,
      errorElement: <RouteErrorBoundary />,
    },
    {
      element: <AuthLayout />,
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          path: '/',
          element: <LoginLayout />,
          children: [
            {
              path: 'login',
              element: <Login />,
            },
            {
              path: 'login/2fa',
              element: <TwoFactorScreen />,
            },
          ],
        },
        dashboardRoutes,
        {
          element: <ProtectedRoute />,
          children: [
            {
              path: '/',
              element: <Root />,
              children: [
                {
                  path: 'c/:conversationId?',
                  element: (
                    <Suspense fallback={<LoadingFallback />}>
                      <ChatRoute />
                    </Suspense>
                  ),
                },
                {
                  path: 'search',
                  element: (
                    <Suspense fallback={<LoadingFallback />}>
                      <Search />
                    </Suspense>
                  ),
                },
                {
                  path: 'recharge',
                  element: (
                    <Suspense fallback={<LoadingFallback />}>
                      <RechargePage />
                    </Suspense>
                  ),
                },
                {
                  path: 'recharge/success',
                  element: (
                    <Suspense fallback={<LoadingFallback />}>
                      <PaymentSuccessPage />
                    </Suspense>
                  ),
                },
                {
                  path: 'recharge/cancel',
                  element: (
                    <Suspense fallback={<LoadingFallback />}>
                      <PaymentCancelPage />
                    </Suspense>
                  ),
                },
                {
                  path: 'recharge/history',
                  element: (
                    <Suspense fallback={<LoadingFallback />}>
                      <RechargeHistoryPage />
                    </Suspense>
                  ),
                },
                {
                  path: 'agents',
                  element: (
                    <Suspense fallback={<LoadingFallback />}>
                      <MarketplaceProvider>
                        <AgentMarketplace />
                      </MarketplaceProvider>
                    </Suspense>
                  ),
                },
                {
                  path: 'agents/:category',
                  element: (
                    <Suspense fallback={<LoadingFallback />}>
                      <MarketplaceProvider>
                        <AgentMarketplace />
                      </MarketplaceProvider>
                    </Suspense>
                  ),
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  { basename: baseHref },
);

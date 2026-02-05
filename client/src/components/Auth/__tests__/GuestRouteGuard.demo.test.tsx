import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import GuestRouteGuard from '../GuestRouteGuard';

if (typeof Request === 'undefined') {
  global.Request = class Request {
    constructor(
      public url: string,
      public init?: RequestInit,
    ) {}
  } as any;
}

jest.mock('~/hooks/AuthContext', () => ({
  useAuthContext: () => ({ isAuthenticated: false }),
}));

const createTestRouter = () =>
  createMemoryRouter(
    [
      {
        element: <GuestRouteGuard />,
        children: [
          { path: '/c/new', element: <div>Chat</div> },
          { path: '/settings', element: <div>Settings</div> },
        ],
      },
      { path: '/login', element: <div>Login</div> },
    ],
    { initialEntries: ['/settings'] },
  );

describe('GuestRouteGuard (demo mode)', () => {
  beforeEach(() => {
    (window as any).__LIBRECHAT_DEMO_MODE__ = true;
  });

  afterEach(() => {
    (window as any).__LIBRECHAT_DEMO_MODE__ = false;
  });

  it('redirects guests to /c/new when demo mode is enabled', async () => {
    const router = createTestRouter();
    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/c/new');
      expect(router.state.historyAction).toBe('REPLACE');
    });
  });
});

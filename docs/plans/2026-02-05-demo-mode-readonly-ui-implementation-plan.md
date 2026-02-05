# Demo Mode (Read-Only UI) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a client-only Demo Mode (`VITE_DEMO_MODE=true`) that renders `/c/new` with static demo data, makes zero API calls, and redirects any write action to `/login` without a redirect param.

**Architecture:** Add a demo mode flag (global + helper), provide demo fixtures for startup config/endpoints/messages/convo, short-circuit data-provider queries to return demo data, and adjust guest redirects/route guard to enforce read-only login boundary. Demo mode must not invoke any network calls.

**Tech Stack:** React, React Router, Recoil, React Query, Jest

### Task 1: Add demo-mode redirect tests for `useGuestMode`

**Files:**
- Create: `client/src/hooks/__tests__/useGuestMode.demo.test.tsx`

**Step 1: Write the failing test**

```tsx
import { renderHook, act } from '@testing-library/react';
import useGuestMode from '../useGuestMode';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../AuthContext', () => ({
  useAuthContext: () => ({ isAuthenticated: false }),
}));

describe('useGuestMode (demo mode)', () => {
  beforeEach(() => {
    (window as any).__LIBRECHAT_DEMO_MODE__ = true;
    mockNavigate.mockClear();
  });

  afterEach(() => {
    (window as any).__LIBRECHAT_DEMO_MODE__ = false;
  });

  it('redirects to /login without redirect param in demo mode', () => {
    const { result } = renderHook(() => useGuestMode());

    act(() => {
      result.current.requireAuth();
    });

    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd client && npm run test:ci -- --runTestsByPath src/hooks/__tests__/useGuestMode.demo.test.tsx`
Expected: FAIL (still uses `?redirect=`)

**Step 3: Write minimal implementation**

(Implemented in Task 2)

**Step 4: Run test to verify it passes**

Run: `cd client && npm run test:ci -- --runTestsByPath src/hooks/__tests__/useGuestMode.demo.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add client/src/hooks/__tests__/useGuestMode.demo.test.tsx
git commit -m "test: add demo-mode redirect coverage for useGuestMode"
```

### Task 2: Add demo mode flag + update `useGuestMode`

**Files:**
- Create: `client/src/utils/demoMode.ts`
- Modify: `client/src/main.jsx`
- Modify: `client/src/vite-env.d.ts`
- Modify: `client/src/hooks/useGuestMode.ts`

**Step 1: Write minimal implementation**

```ts
// client/src/utils/demoMode.ts
export const isDemoMode = () =>
  typeof globalThis !== 'undefined' &&
  (globalThis as { __LIBRECHAT_DEMO_MODE__?: boolean }).__LIBRECHAT_DEMO_MODE__ === true;

export const initializeDemoMode = () => {
  if (typeof window !== 'undefined') {
    window.__LIBRECHAT_DEMO_MODE__ = import.meta.env.VITE_DEMO_MODE === 'true';
  }
};
```

```jsx
// client/src/main.jsx
import { initializeDemoMode } from './utils/demoMode';

initializeDemoMode();
```

```ts
// client/src/vite-env.d.ts
interface ImportMetaEnv {
  readonly VITE_ENABLE_LOGGER: string;
  readonly VITE_LOGGER_FILTER: string;
  readonly VITE_DEMO_MODE: string;
}

declare global {
  interface Window {
    __LIBRECHAT_DEMO_MODE__?: boolean;
  }
}
```

```ts
// client/src/hooks/useGuestMode.ts
import { isDemoMode } from '~/utils/demoMode';

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
```

**Step 2: Run tests**

Run: `cd client && npm run test:ci -- --runTestsByPath src/hooks/__tests__/useGuestMode.demo.test.tsx`
Expected: PASS

**Step 3: Commit**

```bash
git add client/src/utils/demoMode.ts client/src/main.jsx client/src/vite-env.d.ts client/src/hooks/useGuestMode.ts
git commit -m "feat: add demo mode flag and login redirect handling"
```

### Task 3: Add demo-mode data-provider query tests

**Files:**
- Create: `client/src/data-provider/__tests__/demoModeQueries.test.tsx`

**Step 1: Write failing tests**

```tsx
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RecoilRoot } from 'recoil';
import { Constants, dataService, initialModelsConfig } from 'librechat-data-provider';
import { useGetModelsQuery } from 'librechat-data-provider/react-query';
import {
  useGetStartupConfig,
  useGetEndpointsQuery,
  useGetConvoIdQuery,
  useGetMessagesByConvoId,
} from '~/data-provider';
import {
  demoStartupConfig,
  demoEndpointsConfig,
  getDemoConversation,
  getDemoMessages,
} from '~/demo/demoData';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <RecoilRoot>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/c/new']}>{children}</MemoryRouter>
      </QueryClientProvider>
    </RecoilRoot>
  );
};

describe('demo mode queries', () => {
  beforeEach(() => {
    (window as any).__LIBRECHAT_DEMO_MODE__ = true;
    jest.spyOn(dataService, 'getStartupConfig').mockResolvedValue({} as any);
    jest.spyOn(dataService, 'getAIEndpoints').mockResolvedValue({} as any);
    jest.spyOn(dataService, 'getConversationById').mockResolvedValue({} as any);
    jest.spyOn(dataService, 'getMessagesByConvoId').mockResolvedValue([] as any);
    jest.spyOn(dataService, 'getModels').mockResolvedValue(initialModelsConfig as any);
  });

  afterEach(() => {
    (window as any).__LIBRECHAT_DEMO_MODE__ = false;
    jest.restoreAllMocks();
  });

  it('returns demo startup config without API calls', async () => {
    const { result } = renderHook(() => useGetStartupConfig(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.data).toEqual(demoStartupConfig));
    expect(dataService.getStartupConfig).not.toHaveBeenCalled();
  });

  it('returns demo endpoints config without API calls', async () => {
    const { result } = renderHook(() => useGetEndpointsQuery(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.data).toEqual(demoEndpointsConfig));
    expect(dataService.getAIEndpoints).not.toHaveBeenCalled();
  });

  it('returns demo conversation without API calls', async () => {
    const { result } = renderHook(() => useGetConvoIdQuery(Constants.NEW_CONVO), {
      wrapper: createWrapper(),
    });

    await waitFor(() =>
      expect(result.current.data).toEqual(getDemoConversation(Constants.NEW_CONVO)),
    );
    expect(dataService.getConversationById).not.toHaveBeenCalled();
  });

  it('returns demo messages without API calls', async () => {
    const { result } = renderHook(() => useGetMessagesByConvoId(Constants.NEW_CONVO), {
      wrapper: createWrapper(),
    });

    await waitFor(() =>
      expect(result.current.data).toEqual(getDemoMessages(Constants.NEW_CONVO)),
    );
    expect(dataService.getMessagesByConvoId).not.toHaveBeenCalled();
  });

  it('returns demo models without API calls', async () => {
    const { result } = renderHook(() => useGetModelsQuery(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.data).toEqual(initialModelsConfig));
    expect(dataService.getModels).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd client && npm run test:ci -- --runTestsByPath src/data-provider/__tests__/demoModeQueries.test.tsx`
Expected: FAIL (hooks still call API)

**Step 3: Write minimal implementation**

(Implemented in Task 4)

**Step 4: Run tests to verify they pass**

Run: `cd client && npm run test:ci -- --runTestsByPath src/data-provider/__tests__/demoModeQueries.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add client/src/data-provider/__tests__/demoModeQueries.test.tsx
git commit -m "test: add demo-mode coverage for data-provider queries"
```

### Task 4: Add demo fixtures + short-circuit data-provider queries

**Files:**
- Create: `client/src/demo/demoData.ts`
- Modify: `client/src/data-provider/Endpoints/queries.ts`
- Modify: `client/src/data-provider/queries.ts`
- Modify: `client/src/data-provider/Messages/queries.ts`
- Modify: `client/src/hooks/Files/useFileMap.ts`
- Modify: `packages/data-provider/src/react-query/react-query-service.ts`
- Create: `packages/data-provider/src/demo.ts`

**Step 1: Write minimal implementation**

```ts
// client/src/demo/demoData.ts
import { Constants, EModelEndpoint } from 'librechat-data-provider';
import type { TStartupConfig, TEndpointsConfig, TConversation, TMessage } from 'librechat-data-provider';

export const demoStartupConfig: TStartupConfig = {
  appTitle: 'LibreChat Demo',
  socialLogins: [],
  discordLoginEnabled: false,
  facebookLoginEnabled: false,
  githubLoginEnabled: false,
  googleLoginEnabled: false,
  openidLoginEnabled: false,
  appleLoginEnabled: false,
  samlLoginEnabled: false,
  openidLabel: 'OpenID',
  openidImageUrl: '',
  openidAutoRedirect: false,
  samlLabel: 'SAML',
  samlImageUrl: '',
  serverDomain: '',
  emailLoginEnabled: true,
  registrationEnabled: false,
  socialLoginEnabled: false,
  passwordResetEnabled: true,
  emailEnabled: false,
  showBirthdayIcon: false,
  helpAndFaqURL: '',
  sharedLinksEnabled: false,
  publicSharedLinksEnabled: false,
  instanceProjectId: 'demo',
};

export const demoEndpointsConfig: TEndpointsConfig = {
  [EModelEndpoint.openAI]: { order: 1, type: EModelEndpoint.openAI },
  [EModelEndpoint.anthropic]: { order: 2, type: EModelEndpoint.anthropic },
  [EModelEndpoint.google]: { order: 3, type: EModelEndpoint.google },
};

export const getDemoConversation = (conversationId = Constants.NEW_CONVO): TConversation => ({
  conversationId,
  title: 'Demo Chat',
  endpoint: EModelEndpoint.openAI,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
});

export const getDemoMessages = (conversationId = Constants.NEW_CONVO): TMessage[] => [
  {
    messageId: 'demo-user-1',
    conversationId,
    parentMessageId: null,
    text: 'Show me how LibreChat looks in demo mode.',
    isCreatedByUser: true,
    sender: 'user',
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  },
  {
    messageId: 'demo-assistant-1',
    conversationId,
    parentMessageId: 'demo-user-1',
    text: 'This is a read-only demo. Sign in to start chatting.',
    isCreatedByUser: false,
    sender: 'assistant',
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  },
];

export const demoFileMap = {} as Record<string, unknown>;
```

```ts
// client/src/data-provider/Endpoints/queries.ts
import { isDemoMode } from '~/utils/demoMode';
import { demoStartupConfig, demoEndpointsConfig } from '~/demo/demoData';

const demoMode = isDemoMode();

// in useGetEndpointsQuery queryFn
() => (demoMode ? Promise.resolve(demoEndpointsConfig) : dataService.getAIEndpoints())

// in useGetStartupConfig queryFn
() => (demoMode ? Promise.resolve(demoStartupConfig) : dataService.getStartupConfig())

// enabled: demoMode ? true : (config?.enabled ?? true) && queriesEnabled
```

```ts
// client/src/data-provider/queries.ts
import { isDemoMode } from '~/utils/demoMode';
import { getDemoConversation } from '~/demo/demoData';

// in useGetConvoIdQuery queryFn
if (isDemoMode()) {
  return getDemoConversation(id);
}
```

```ts
// client/src/data-provider/Messages/queries.ts
import { isDemoMode } from '~/utils/demoMode';
import { getDemoMessages } from '~/demo/demoData';

// in queryFn
if (isDemoMode()) {
  return getDemoMessages(id);
}
```

```ts
// client/src/hooks/Files/useFileMap.ts
import { isDemoMode } from '~/utils/demoMode';
import { demoFileMap } from '~/demo/demoData';

if (isDemoMode()) {
  return demoFileMap;
}
```

```ts
// packages/data-provider/src/demo.ts
export const isDemoMode = () =>
  typeof globalThis !== 'undefined' &&
  (globalThis as { __LIBRECHAT_DEMO_MODE__?: boolean }).__LIBRECHAT_DEMO_MODE__ === true;
```

```ts
// packages/data-provider/src/react-query/react-query-service.ts
import { isDemoMode } from '../demo';

return useQuery<t.TModelsConfig>(
  [QueryKeys.models],
  () => (isDemoMode() ? Promise.resolve(initialModelsConfig) : dataService.getModels()),
  { ... }
);
```

**Step 2: Run tests**

Run: `cd client && npm run test:ci -- --runTestsByPath src/data-provider/__tests__/demoModeQueries.test.tsx`
Expected: PASS

**Step 3: Commit**

```bash
git add client/src/demo/demoData.ts client/src/data-provider/Endpoints/queries.ts client/src/data-provider/queries.ts client/src/data-provider/Messages/queries.ts client/src/hooks/Files/useFileMap.ts packages/data-provider/src/demo.ts packages/data-provider/src/react-query/react-query-service.ts
git commit -m "feat: add demo fixtures and short-circuit queries"
```

### Task 5: Add demo-mode route guard tests

**Files:**
- Create: `client/src/components/Auth/__tests__/GuestRouteGuard.demo.test.tsx`

**Step 1: Write failing test**

```tsx
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import GuestRouteGuard from '../GuestRouteGuard';

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
```

**Step 2: Run test to verify it fails**

Run: `cd client && npm run test:ci -- --runTestsByPath src/components/Auth/__tests__/GuestRouteGuard.demo.test.tsx`
Expected: FAIL (redirect still goes to /login?redirect=...)

**Step 3: Write minimal implementation**

(Implemented in Task 6)

**Step 4: Run test to verify it passes**

Run: `cd client && npm run test:ci -- --runTestsByPath src/components/Auth/__tests__/GuestRouteGuard.demo.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add client/src/components/Auth/__tests__/GuestRouteGuard.demo.test.tsx
git commit -m "test: add demo-mode guest route guard coverage"
```

### Task 6: Update GuestRouteGuard for demo routing

**Files:**
- Modify: `client/src/components/Auth/GuestRouteGuard.tsx`

**Step 1: Write minimal implementation**

```ts
import { isDemoMode } from '~/utils/demoMode';

const DEMO_ALLOWED_PATHS = ['/c/new', '/login', '/login/2fa'];

function isDemoAllowedPath(pathname: string): boolean {
  const normalizedPath = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return DEMO_ALLOWED_PATHS.some((allowed) => normalizedPath === allowed);
}

// inside component
const demoMode = isDemoMode();
const isAllowed = demoMode ? isDemoAllowedPath(normalizedPath) : isGuestAllowedPath(normalizedPath);

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
```

**Step 2: Run test**

Run: `cd client && npm run test:ci -- --runTestsByPath src/components/Auth/__tests__/GuestRouteGuard.demo.test.tsx`
Expected: PASS

**Step 3: Commit**

```bash
git add client/src/components/Auth/GuestRouteGuard.tsx
git commit -m "feat: enforce demo-mode guest routing"
```

### Task 7: Add demo-mode AuthContext refresh test

**Files:**
- Create: `client/src/hooks/__tests__/AuthContext.demo.test.tsx`

**Step 1: Write failing test**

```tsx
import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RecoilRoot } from 'recoil';
import { AuthContextProvider } from '../AuthContext';

const mockRefreshMutate = jest.fn();

jest.mock('~/data-provider', () => ({
  useGetRole: () => ({ data: null }),
  useGetUserQuery: () => ({ data: null, isError: false }),
  useLoginUserMutation: () => ({ mutate: jest.fn() }),
  useLogoutUserMutation: () => ({ mutate: jest.fn() }),
  useRefreshTokenMutation: () => ({ mutate: mockRefreshMutate }),
}));

describe('AuthContextProvider (demo mode)', () => {
  beforeEach(() => {
    (window as any).__LIBRECHAT_DEMO_MODE__ = true;
    mockRefreshMutate.mockClear();
  });

  afterEach(() => {
    (window as any).__LIBRECHAT_DEMO_MODE__ = false;
  });

  it('does not attempt refresh token in demo mode', async () => {
    render(
      <RecoilRoot>
        <MemoryRouter>
          <AuthContextProvider>
            <div />
          </AuthContextProvider>
        </MemoryRouter>
      </RecoilRoot>,
    );

    expect(mockRefreshMutate).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd client && npm run test:ci -- --runTestsByPath src/hooks/__tests__/AuthContext.demo.test.tsx`
Expected: FAIL (refresh called)

**Step 3: Write minimal implementation**

(Implemented in Task 8)

**Step 4: Run test to verify it passes**

Run: `cd client && npm run test:ci -- --runTestsByPath src/hooks/__tests__/AuthContext.demo.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add client/src/hooks/__tests__/AuthContext.demo.test.tsx
git commit -m "test: add demo-mode auth refresh coverage"
```

### Task 8: Skip refresh token in demo mode

**Files:**
- Modify: `client/src/hooks/AuthContext.tsx`

**Step 1: Write minimal implementation**

```ts
import { isDemoMode } from '~/utils/demoMode';

const demoMode = isDemoMode();

const silentRefresh = useCallback(() => {
  if (demoMode) {
    return;
  }
  // existing logic
}, [demoMode, ...]);
```

**Step 2: Run test**

Run: `cd client && npm run test:ci -- --runTestsByPath src/hooks/__tests__/AuthContext.demo.test.tsx`
Expected: PASS

**Step 3: Commit**

```bash
git add client/src/hooks/AuthContext.tsx
git commit -m "feat: skip auth refresh in demo mode"
```

---

Plan complete and saved to `docs/plans/2026-02-05-demo-mode-readonly-ui-implementation-plan.md`.

Two execution options:
1. Subagent-Driven (this session)
2. Parallel Session (separate)

Which approach?

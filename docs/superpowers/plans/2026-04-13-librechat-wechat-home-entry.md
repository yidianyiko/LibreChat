# LibreChat WeChat Home Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a WeChat quick action to the main left-side account area so users can bind or manage WeChat directly from the home shell while keeping the existing Settings -> Account entry working.

**Architecture:** Extract the current inline WeChat binding logic into a shared nav-level hook plus a reusable dialog, then consume that shared flow from two surfaces: a new `AccountSettings` quick action and the existing Settings Account row. Keep backend and data-provider contracts unchanged and drive the work with focused Jest coverage around the new home entry plus regression coverage for the existing settings surface.

**Tech Stack:** React, TypeScript, React Query, Jest, Testing Library, `@librechat/client`, `lucide-react`

---

## File Structure

### New Files

- `client/src/components/Nav/WeChat/useWeChatBindingFlow.ts`
  - Shared controller for `useWeChatStatusQuery`, bind start, bind-status polling, unbind, toast, query invalidation, dialog open state, and transient QR session state.
- `client/src/components/Nav/WeChat/WeChatBindingDialog.tsx`
  - Reusable dialog shell for QR display, loading state, connected-account management state, and retry / unbind actions.
- `client/src/components/Nav/WeChat/WeChatQuickAction.tsx`
  - Home-visible quick action button that opens the shared dialog and auto-starts binding for `unbound` / `reauth_required`.
- `client/src/components/Nav/WeChat/__tests__/WeChatQuickAction.spec.tsx`
  - Focused tests for the new home entry behavior.

### Modified Files

- `client/src/components/Nav/AccountSettings.tsx`
  - Insert the new quick action alongside the existing "迁移数据" trigger.
- `client/src/components/Nav/__tests__/AccountSettings.spec.tsx`
  - Prove the home shell now exposes the WeChat entry in the same quick-action stack.
- `client/src/components/Nav/SettingsTabs/Account/WeChatBinding.tsx`
  - Convert the settings row into a thin presenter over the shared flow and dialog.
- `client/src/components/Nav/SettingsTabs/Account/__tests__/WeChatBinding.spec.tsx`
  - Keep the settings row behavior pinned while the internals move to shared code.

### No Planned Changes

- `packages/api/**/*`
- `packages/data-provider/**/*`
- `client/src/locales/en/translation.json`

This plan reuses existing keys such as `com_nav_wechat_binding`, `com_ui_wechat_bind`, `com_ui_wechat_unbind`, `com_ui_wechat_qr_title`, `com_ui_wechat_qr_help`, `com_ui_initializing`, `com_ui_error`, and `com_ui_retry`.

---

### Task 1: Build the shared home-entry WeChat flow

**Files:**
- Create: `client/src/components/Nav/WeChat/useWeChatBindingFlow.ts`
- Create: `client/src/components/Nav/WeChat/WeChatBindingDialog.tsx`
- Create: `client/src/components/Nav/WeChat/WeChatQuickAction.tsx`
- Test: `client/src/components/Nav/WeChat/__tests__/WeChatQuickAction.spec.tsx`

- [ ] **Step 1: Write the failing test**

Create `client/src/components/Nav/WeChat/__tests__/WeChatQuickAction.spec.tsx` with a single home-entry behavior first:

```tsx
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import WeChatQuickAction from '../WeChatQuickAction';

const mockInvalidateQueries = jest.fn();
const mockRefetchQueries = jest.fn();
const mockShowToast = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
    refetchQueries: mockRefetchQueries,
  }),
}));

jest.mock('~/hooks', () => ({
  useLocalize: jest.fn(() => (key: string) => {
    const translations: Record<string, string> = {
      com_nav_wechat_binding: 'WeChat',
      com_ui_wechat_qr_title: 'Scan with WeChat',
      com_ui_wechat_qr_help: 'Use WeChat to scan this QR code and complete the bind.',
      com_ui_initializing: 'Initializing...',
    };

    return translations[key] ?? key;
  }),
}));

jest.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: { value: string }) => <svg data-testid="wechat-qr-svg" data-value={value} />,
}));

jest.mock('~/data-provider', () => ({
  useWeChatStatusQuery: jest.fn(),
  useWeChatBindStatusQuery: jest.fn(),
  useStartWeChatBindMutation: jest.fn(),
  useUnbindWeChatMutation: jest.fn(),
}));

jest.mock('@librechat/client', () => ({
  Button: ({ children, ...props }: React.ComponentProps<'button'>) => <button {...props}>{children}</button>,
  OGDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  OGDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  OGDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  OGDialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useToastContext: () => ({ showToast: mockShowToast }),
}));

const mockUseWeChatStatusQuery = jest.requireMock('~/data-provider').useWeChatStatusQuery as jest.Mock;
const mockUseWeChatBindStatusQuery = jest.requireMock('~/data-provider').useWeChatBindStatusQuery as jest.Mock;
const mockUseStartWeChatBindMutation = jest.requireMock('~/data-provider').useStartWeChatBindMutation as jest.Mock;
const mockUseUnbindWeChatMutation = jest.requireMock('~/data-provider').useUnbindWeChatMutation as jest.Mock;

describe('WeChatQuickAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWeChatStatusQuery.mockReturnValue({
      data: { status: 'unbound', hasBinding: false },
      isLoading: false,
      isError: false,
    });
    mockUseWeChatBindStatusQuery.mockImplementation((bindSessionId: string | null) => ({
      data:
        bindSessionId == null
          ? undefined
          : {
              bindSessionId,
              status: 'pending',
              qrCodeDataUrl: 'https://liteapp.weixin.qq.com/q/example',
            },
      isError: false,
    }));
    mockUseUnbindWeChatMutation.mockReturnValue({
      mutate: jest.fn(),
      isLoading: false,
    });
    mockUseStartWeChatBindMutation.mockReturnValue({
      isLoading: false,
      mutate: jest.fn((_value, options) => {
        options?.onSuccess?.({
          bindSessionId: 'bind-session-1',
          qrCodeDataUrl: 'https://liteapp.weixin.qq.com/q/example',
          expiresAt: '2026-04-13T00:00:00.000Z',
        });
      }),
    });
  });

  it('auto-starts binding when the quick action opens for an unbound account', () => {
    render(<WeChatQuickAction />);

    fireEvent.click(screen.getByRole('button', { name: 'WeChat' }));

    expect(screen.getByText('Scan with WeChat')).toBeInTheDocument();
    expect(screen.getByTestId('wechat-qr-svg')).toHaveAttribute(
      'data-value',
      'https://liteapp.weixin.qq.com/q/example',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd client && npx jest src/components/Nav/WeChat/__tests__/WeChatQuickAction.spec.tsx --runInBand
```

Expected: `FAIL` because `../WeChatQuickAction` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `client/src/components/Nav/WeChat/useWeChatBindingFlow.ts`:

```ts
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { QueryKeys } from 'librechat-data-provider';
import { useToastContext } from '@librechat/client';
import {
  useStartWeChatBindMutation,
  useUnbindWeChatMutation,
  useWeChatBindStatusQuery,
  useWeChatStatusQuery,
} from '~/data-provider';
import { useLocalize } from '~/hooks';

type UseWeChatBindingFlowOptions = {
  autoStartOnOpen?: boolean;
};

export function useWeChatBindingFlow(options: UseWeChatBindingFlowOptions = {}) {
  const { autoStartOnOpen = false } = options;
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const queryClient = useQueryClient();
  const autoStartedRef = useRef(false);
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [bindSessionId, setBindSessionId] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const statusQuery = useWeChatStatusQuery();
  const startMutation = useStartWeChatBindMutation();
  const unbindMutation = useUnbindWeChatMutation();
  const bindStatusQuery = useWeChatBindStatusQuery(bindSessionId, isDialogOpen);

  const resetDialogState = () => {
    autoStartedRef.current = false;
    setBindSessionId(null);
    setQrCodeDataUrl(null);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      resetDialogState();
    }
  };

  const startBinding = () =>
    startMutation.mutate(undefined, {
      onSuccess: (data) => {
        setBindSessionId(data.bindSessionId);
        setQrCodeDataUrl(data.qrCodeDataUrl);
        setDialogOpen(true);
      },
    });

  useEffect(() => {
    if (!isDialogOpen || !autoStartOnOpen || autoStartedRef.current || statusQuery.isLoading) {
      return;
    }

    if (statusQuery.data?.status === 'healthy') {
      return;
    }

    autoStartedRef.current = true;
    startBinding();
  }, [autoStartOnOpen, isDialogOpen, statusQuery.data?.status, statusQuery.isLoading]);

  useEffect(() => {
    if (bindStatusQuery.data?.qrCodeDataUrl) {
      setQrCodeDataUrl(bindStatusQuery.data.qrCodeDataUrl);
    }

    if (bindStatusQuery.data?.status !== 'healthy') {
      return;
    }

    void queryClient.invalidateQueries([QueryKeys.wechatStatus]);
    void queryClient.refetchQueries([QueryKeys.wechatStatus]);
    showToast({
      message: localize('com_ui_wechat_bound_success'),
      status: 'success',
    });
    handleDialogOpenChange(false);
  }, [bindStatusQuery.data, localize, queryClient, showToast]);

  return {
    bindSessionId,
    handleDialogOpenChange,
    isBusy: startMutation.isLoading || unbindMutation.isLoading,
    isDialogOpen,
    qrCodeDataUrl,
    startBinding,
    status: statusQuery.data,
    statusQuery,
    unbind: () => unbindMutation.mutate(),
  };
}
```

Create `client/src/components/Nav/WeChat/WeChatBindingDialog.tsx`:

```tsx
import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  OGDialog,
  OGDialogContent,
  OGDialogHeader,
  OGDialogTitle,
} from '@librechat/client';
import { useLocalize } from '~/hooks';

function shouldRenderQrImage(value: string | null): value is string {
  return typeof value === 'string' && value.startsWith('data:image/');
}

type WeChatBindingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  qrCodeDataUrl: string | null;
};

export default function WeChatBindingDialog({
  open,
  onOpenChange,
  qrCodeDataUrl,
}: WeChatBindingDialogProps) {
  const localize = useLocalize();

  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      <OGDialogContent className="w-11/12 max-w-md">
        <OGDialogHeader>
          <OGDialogTitle>{localize('com_ui_wechat_qr_title')}</OGDialogTitle>
        </OGDialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">{localize('com_ui_wechat_qr_help')}</p>
          {qrCodeDataUrl == null ? (
            <p className="text-sm text-text-secondary">{localize('com_ui_initializing')}</p>
          ) : null}
          {shouldRenderQrImage(qrCodeDataUrl) ? (
            <img
              alt={localize('com_ui_wechat_qr_title')}
              className="mx-auto max-h-72 w-full max-w-72 rounded-md border border-border-light object-contain p-2"
              src={qrCodeDataUrl}
            />
          ) : null}
          {qrCodeDataUrl != null && !shouldRenderQrImage(qrCodeDataUrl) ? (
            <div className="mx-auto flex w-full max-w-72 justify-center rounded-md border border-border-light bg-white p-4">
              <QRCodeSVG value={qrCodeDataUrl} size={240} marginSize={2} />
            </div>
          ) : null}
        </div>
      </OGDialogContent>
    </OGDialog>
  );
}
```

Create `client/src/components/Nav/WeChat/WeChatQuickAction.tsx`:

```tsx
import React from 'react';
import { MessageSquare } from 'lucide-react';
import { useLocalize } from '~/hooks';
import WeChatBindingDialog from './WeChatBindingDialog';
import { useWeChatBindingFlow } from './useWeChatBindingFlow';

export default function WeChatQuickAction() {
  const localize = useLocalize();
  const flow = useWeChatBindingFlow({ autoStartOnOpen: true });

  return (
    <>
      <button
        type="button"
        onClick={() => flow.handleDialogOpenChange(true)}
        aria-label={localize('com_nav_wechat_binding')}
        className="account-settings-wechat flex w-full items-center gap-2 rounded-xl p-2 text-sm text-text-primary transition-all duration-200 ease-in-out hover:bg-surface-active-alt"
      >
        <MessageSquare className="icon-md flex-shrink-0" aria-hidden="true" />
        <span className="truncate text-left">{localize('com_nav_wechat_binding')}</span>
      </button>
      <WeChatBindingDialog
        open={flow.isDialogOpen}
        onOpenChange={flow.handleDialogOpenChange}
        qrCodeDataUrl={flow.qrCodeDataUrl}
      />
    </>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd client && npx jest src/components/Nav/WeChat/__tests__/WeChatQuickAction.spec.tsx --runInBand
```

Expected: `PASS` with the single auto-start QR test.

- [ ] **Step 5: Commit**

Run:

```bash
git add client/src/components/Nav/WeChat/useWeChatBindingFlow.ts client/src/components/Nav/WeChat/WeChatBindingDialog.tsx client/src/components/Nav/WeChat/WeChatQuickAction.tsx client/src/components/Nav/WeChat/__tests__/WeChatQuickAction.spec.tsx
git commit -m "feat: add shared wechat quick action flow"
```

---

### Task 2: Add healthy-management and reset behavior to the shared dialog

**Files:**
- Modify: `client/src/components/Nav/WeChat/useWeChatBindingFlow.ts`
- Modify: `client/src/components/Nav/WeChat/WeChatBindingDialog.tsx`
- Test: `client/src/components/Nav/WeChat/__tests__/WeChatQuickAction.spec.tsx`

- [ ] **Step 1: Write the failing tests**

Append these two tests to `client/src/components/Nav/WeChat/__tests__/WeChatQuickAction.spec.tsx`:

```tsx
it('shows connected account management instead of starting a new bind for healthy bindings', () => {
  const unbind = jest.fn();

  mockUseWeChatStatusQuery.mockReturnValue({
    data: { status: 'healthy', hasBinding: true, ilinkUserId: 'wechat-1' },
    isLoading: false,
    isError: false,
  });
  mockUseUnbindWeChatMutation.mockReturnValue({
    mutate: unbind,
    isLoading: false,
  });

  render(<WeChatQuickAction />);

  fireEvent.click(screen.getByRole('button', { name: 'WeChat' }));

  expect(screen.getByText('Connected account: wechat-1')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Unbind WeChat' }));
  expect(unbind).toHaveBeenCalledTimes(1);
});

it('clears transient qr state when the dialog closes so reopen starts cleanly', () => {
  const startBind = jest.fn((_value, options) => {
    options?.onSuccess?.({
      bindSessionId: `bind-session-${startBind.mock.calls.length + 1}`,
      qrCodeDataUrl: 'https://liteapp.weixin.qq.com/q/example',
      expiresAt: '2026-04-13T00:00:00.000Z',
    });
  });

  mockUseStartWeChatBindMutation.mockReturnValue({
    isLoading: false,
    mutate: startBind,
  });

  render(<WeChatQuickAction />);

  fireEvent.click(screen.getByRole('button', { name: 'WeChat' }));
  fireEvent.click(screen.getByRole('button', { name: 'Close WeChat dialog' }));
  fireEvent.click(screen.getByRole('button', { name: 'WeChat' }));

  expect(startBind).toHaveBeenCalledTimes(2);
});
```

Update the dialog mock in this test file so `OGDialog` respects `open` and renders a close button:

```tsx
OGDialog: ({
  children,
  open,
  onOpenChange,
}: {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) =>
  open ? (
    <div>
      <button type="button" aria-label="Close WeChat dialog" onClick={() => onOpenChange?.(false)}>
        close
      </button>
      {children}
    </div>
  ) : null,
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd client && npx jest src/components/Nav/WeChat/__tests__/WeChatQuickAction.spec.tsx --runInBand
```

Expected: `FAIL` because the dialog does not yet render connected-account management or a close/reset cycle.

- [ ] **Step 3: Extend the shared implementation**

Update `client/src/components/Nav/WeChat/useWeChatBindingFlow.ts` so it exposes management-friendly state:

```ts
const hasBinding = statusQuery.data?.hasBinding === true;
const showBindAction = !hasBinding || statusQuery.data?.status === 'reauth_required';

return {
  bindSessionId,
  handleDialogOpenChange,
  hasBinding,
  isBusy: startMutation.isLoading || unbindMutation.isLoading,
  isDialogOpen,
  qrCodeDataUrl,
  showBindAction,
  startBinding,
  status: statusQuery.data,
  statusQuery,
  unbind: () => unbindMutation.mutate(),
};
```

Update `client/src/components/Nav/WeChat/WeChatBindingDialog.tsx` to render healthy-management UI and a close button:

```tsx
import { Button } from '@librechat/client';

type WeChatBindingDialogProps = {
  connectedAccount?: string;
  hasBinding: boolean;
  isBusy: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
  onUnbind: () => void;
  open: boolean;
  qrCodeDataUrl: string | null;
  showBindAction: boolean;
  statusText: string;
};

// Inside the dialog body
{hasBinding && qrCodeDataUrl == null ? (
  <div className="space-y-3">
    <p className="text-sm text-text-secondary">{statusText}</p>
    {connectedAccount ? (
      <p className="text-sm text-text-secondary">
        {localize('com_ui_wechat_connected_account')}: {connectedAccount}
      </p>
    ) : null}
    <div className="flex justify-end gap-2">
      {showBindAction ? (
        <Button onClick={onRetry} disabled={isBusy}>
          {localize('com_ui_wechat_bind')}
        </Button>
      ) : null}
      <Button variant="destructive" onClick={onUnbind} disabled={isBusy}>
        {localize('com_ui_wechat_unbind')}
      </Button>
    </div>
  </div>
) : null}
```

Update `client/src/components/Nav/WeChat/WeChatQuickAction.tsx` to pass the new props:

```tsx
function getWeChatStatusText(status: 'unbound' | 'healthy' | 'reauth_required' | undefined, localize: ReturnType<typeof useLocalize>) {
  if (status === 'healthy') {
    return localize('com_ui_wechat_bound_healthy');
  }

  if (status === 'reauth_required') {
    return localize('com_ui_wechat_reauth_required');
  }

  return localize('com_ui_wechat_unbound');
}

<WeChatBindingDialog
  connectedAccount={flow.status?.ilinkUserId}
  hasBinding={flow.hasBinding}
  isBusy={flow.isBusy}
  onOpenChange={flow.handleDialogOpenChange}
  onRetry={flow.startBinding}
  onUnbind={flow.unbind}
  open={flow.isDialogOpen}
  qrCodeDataUrl={flow.qrCodeDataUrl}
  showBindAction={flow.showBindAction}
  statusText={getWeChatStatusText(flow.status?.status, localize)}
/>
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd client && npx jest src/components/Nav/WeChat/__tests__/WeChatQuickAction.spec.tsx --runInBand
```

Expected: `PASS` for auto-start, healthy-management, and reset-on-close behaviors.

- [ ] **Step 5: Commit**

Run:

```bash
git add client/src/components/Nav/WeChat/useWeChatBindingFlow.ts client/src/components/Nav/WeChat/WeChatBindingDialog.tsx client/src/components/Nav/WeChat/WeChatQuickAction.tsx client/src/components/Nav/WeChat/__tests__/WeChatQuickAction.spec.tsx
git commit -m "feat: add wechat dialog management states"
```

---

### Task 3: Refactor the Settings Account row onto the shared flow

**Files:**
- Modify: `client/src/components/Nav/SettingsTabs/Account/WeChatBinding.tsx`
- Test: `client/src/components/Nav/SettingsTabs/Account/__tests__/WeChatBinding.spec.tsx`

- [ ] **Step 1: Lock the settings surface with a regression test**

Append this test to `client/src/components/Nav/SettingsTabs/Account/__tests__/WeChatBinding.spec.tsx`:

```tsx
it('keeps the inline status row while opening the shared dialog for bind actions', () => {
  const mutate = jest.fn((_value, options) => {
    options?.onSuccess?.({
      bindSessionId: 'bind-session-1',
      qrCodeDataUrl: 'https://liteapp.weixin.qq.com/q/example',
      expiresAt: '2026-04-13T00:00:00.000Z',
    });
  });

  mockUseWeChatStatusQuery.mockReturnValue({
    data: { status: 'unbound', hasBinding: false },
    isLoading: false,
    isError: false,
  });
  mockUseStartWeChatBindMutation.mockReturnValue({
    mutate,
    isLoading: false,
  });

  render(<WeChatBinding />);

  expect(screen.getByText('WeChat binding')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Bind WeChat' }));
  expect(screen.getByText('Scan with WeChat')).toBeInTheDocument();
});
```

This should already pass before the refactor. It is the guardrail for the next step.

- [ ] **Step 2: Run the settings regression suite**

Run:

```bash
cd client && npx jest src/components/Nav/SettingsTabs/Account/__tests__/WeChatBinding.spec.tsx --runInBand
```

Expected: `PASS` before touching implementation. This is the green baseline for the refactor.

- [ ] **Step 3: Replace the self-contained settings implementation with the shared flow**

Rewrite `client/src/components/Nav/SettingsTabs/Account/WeChatBinding.tsx` so it becomes a thin presenter:

```tsx
import React from 'react';
import { Button, Label } from '@librechat/client';
import { useLocalize } from '~/hooks';
import WeChatBindingDialog from '~/components/Nav/WeChat/WeChatBindingDialog';
import { useWeChatBindingFlow } from '~/components/Nav/WeChat/useWeChatBindingFlow';

function getWeChatStatusText(
  status: 'unbound' | 'healthy' | 'reauth_required' | undefined,
  localize: ReturnType<typeof useLocalize>,
) {
  if (status === 'healthy') {
    return localize('com_ui_wechat_bound_healthy');
  }

  if (status === 'reauth_required') {
    return localize('com_ui_wechat_reauth_required');
  }

  return localize('com_ui_wechat_unbound');
}

export default function WeChatBinding() {
  const localize = useLocalize();
  const flow = useWeChatBindingFlow();

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <Label id="wechat-binding-label">{localize('com_nav_wechat_binding')}</Label>
          <p className="text-xs text-text-secondary">
            {getWeChatStatusText(flow.status?.status, localize)}
          </p>
          {flow.status?.ilinkUserId ? (
            <p className="text-xs text-text-secondary">
              {localize('com_ui_wechat_connected_account')}: {flow.status.ilinkUserId}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {flow.showBindAction ? (
            <Button
              aria-label={localize('com_ui_wechat_bind')}
              disabled={flow.isBusy}
              onClick={flow.startBinding}
            >
              {localize('com_ui_wechat_bind')}
            </Button>
          ) : null}
          {flow.hasBinding ? (
            <Button
              aria-label={localize('com_ui_wechat_unbind')}
              disabled={flow.isBusy}
              variant="destructive"
              onClick={flow.unbind}
            >
              {localize('com_ui_wechat_unbind')}
            </Button>
          ) : null}
        </div>
      </div>
      <WeChatBindingDialog
        connectedAccount={flow.status?.ilinkUserId}
        hasBinding={flow.hasBinding}
        isBusy={flow.isBusy}
        onOpenChange={flow.handleDialogOpenChange}
        onRetry={flow.startBinding}
        onUnbind={flow.unbind}
        open={flow.isDialogOpen}
        qrCodeDataUrl={flow.qrCodeDataUrl}
        showBindAction={flow.showBindAction}
        statusText={getWeChatStatusText(flow.status?.status, localize)}
      />
    </>
  );
}
```

- [ ] **Step 4: Run test to verify the refactor stayed green**

Run:

```bash
cd client && npx jest src/components/Nav/SettingsTabs/Account/__tests__/WeChatBinding.spec.tsx --runInBand
```

Expected: `PASS` with the previous QR/success assertions still intact.

- [ ] **Step 5: Commit**

Run:

```bash
git add client/src/components/Nav/SettingsTabs/Account/WeChatBinding.tsx client/src/components/Nav/SettingsTabs/Account/__tests__/WeChatBinding.spec.tsx
git commit -m "refactor: share wechat settings binding flow"
```

---

### Task 4: Surface the WeChat quick action in the home-visible account stack

**Files:**
- Modify: `client/src/components/Nav/AccountSettings.tsx`
- Modify: `client/src/components/Nav/__tests__/AccountSettings.spec.tsx`

- [ ] **Step 1: Write the failing integration tests**

Extend `client/src/components/Nav/__tests__/AccountSettings.spec.tsx` by adding the missing WeChat mocks to the existing `~/data-provider` mock and then append:

```tsx
it('shows the WeChat quick action alongside migrate history', () => {
  render(<AccountSettings />);

  expect(screen.getByRole('button', { name: 'com_ui_import_conversation_info' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'WeChat' })).toBeInTheDocument();
});

it('opens the WeChat dialog from the home quick action', () => {
  render(<AccountSettings />);

  fireEvent.click(screen.getByRole('button', { name: 'WeChat' }));

  expect(screen.getByText('Scan with WeChat')).toBeInTheDocument();
});
```

Add the same WeChat hook defaults used by the quick-action spec to this test file:

```tsx
useWeChatStatusQuery: jest.fn(),
useWeChatBindStatusQuery: jest.fn(),
useStartWeChatBindMutation: jest.fn(),
useUnbindWeChatMutation: jest.fn(),
```

and in `beforeEach`:

```tsx
const mockUseWeChatStatusQuery = jest.requireMock('~/data-provider').useWeChatStatusQuery as jest.Mock;
const mockUseWeChatBindStatusQuery = jest.requireMock('~/data-provider').useWeChatBindStatusQuery as jest.Mock;
const mockUseStartWeChatBindMutation = jest.requireMock('~/data-provider').useStartWeChatBindMutation as jest.Mock;
const mockUseUnbindWeChatMutation = jest.requireMock('~/data-provider').useUnbindWeChatMutation as jest.Mock;

mockUseWeChatStatusQuery.mockReturnValue({
  data: { status: 'unbound', hasBinding: false },
  isLoading: false,
  isError: false,
});
mockUseWeChatBindStatusQuery.mockImplementation((bindSessionId: string | null) => ({
  data:
    bindSessionId == null
      ? undefined
      : {
          bindSessionId,
          status: 'pending',
          qrCodeDataUrl: 'https://liteapp.weixin.qq.com/q/example',
        },
  isError: false,
}));
mockUseStartWeChatBindMutation.mockReturnValue({
  mutate: jest.fn((_value, options) => {
    options?.onSuccess?.({
      bindSessionId: 'bind-session-1',
      qrCodeDataUrl: 'https://liteapp.weixin.qq.com/q/example',
      expiresAt: '2026-04-13T00:00:00.000Z',
    });
  }),
  isLoading: false,
});
mockUseUnbindWeChatMutation.mockReturnValue({
  mutate: jest.fn(),
  isLoading: false,
});
mockUseLocalize.mockReturnValue((key: string) => {
  if (key === 'com_nav_balance') {
    return 'Token Credits';
  }

  if (key === 'com_nav_wechat_binding') {
    return 'WeChat';
  }

  if (key === 'com_ui_wechat_qr_title') {
    return 'Scan with WeChat';
  }

  return key;
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd client && npx jest src/components/Nav/__tests__/AccountSettings.spec.tsx --runInBand
```

Expected: `FAIL` because `AccountSettings` does not render the new quick action yet.

- [ ] **Step 3: Wire the quick action into `AccountSettings`**

Update `client/src/components/Nav/AccountSettings.tsx`:

```tsx
import WeChatQuickAction from './WeChat/WeChatQuickAction';

// Inside the quick-action stack, directly after the existing ImportConversations block
<ImportConversationDialog
  open={showImportDialog}
  onOpenChange={setShowImportDialog}
  onStartImport={(file) => setPendingImportFile(file)}
  isUploading={isImportUploading}
/>
<WeChatQuickAction />
{user?.role === SystemRoles.ADMIN && (
  <button
    type="button"
    onClick={() => navigate('/d/stats')}
    aria-label="Admin Statistics"
    className="account-settings-stats flex w-full items-center gap-2 rounded-xl p-2 text-sm text-text-primary transition-all duration-200 ease-in-out hover:bg-surface-active-alt"
  >
```

Do not move the existing import trigger. The WeChat action belongs in the same quick-action stack, not inside the Select popover.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd client && npx jest src/components/Nav/__tests__/AccountSettings.spec.tsx --runInBand
```

Expected: `PASS` with both the migrate and WeChat actions visible from the home shell.

- [ ] **Step 5: Commit**

Run:

```bash
git add client/src/components/Nav/AccountSettings.tsx client/src/components/Nav/__tests__/AccountSettings.spec.tsx
git commit -m "feat: surface wechat entry in account settings"
```

---

## Final Verification

- [ ] Run the focused frontend suite:

```bash
cd client && npx jest src/components/Nav/WeChat/__tests__/WeChatQuickAction.spec.tsx src/components/Nav/__tests__/AccountSettings.spec.tsx src/components/Nav/SettingsTabs/Account/__tests__/WeChatBinding.spec.tsx --runInBand
```

Expected: all targeted nav / settings WeChat tests pass.

- [ ] Run ESLint on the touched frontend files:

```bash
cd client && npx eslint src/components/Nav/AccountSettings.tsx src/components/Nav/WeChat src/components/Nav/SettingsTabs/Account/WeChatBinding.tsx src/components/Nav/__tests__/AccountSettings.spec.tsx src/components/Nav/SettingsTabs/Account/__tests__/WeChatBinding.spec.tsx --ext .ts,.tsx
```

Expected: no lint errors or warnings.

- [ ] Check the worktree before handoff:

```bash
git status --short
```

Expected: only the intended WeChat home-entry files are modified.

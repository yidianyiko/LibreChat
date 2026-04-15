import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import WeChatQuickAction from '../WeChatQuickAction';

const CLOSE_DIALOG_LABEL = 'Close dialog';
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
  useLocalize: jest.fn(),
}));

jest.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value, title }: { value: string; title?: string }) => (
    <svg data-testid="wechat-qr-svg" data-title={title} data-value={value} />
  ),
}));

jest.mock('~/data-provider', () => ({
  useWeChatStatusQuery: jest.fn(),
  useWeChatBindStatusQuery: jest.fn(),
  useStartWeChatBindMutation: jest.fn(),
  useUnbindWeChatMutation: jest.fn(),
}));

jest.mock(
  '@librechat/client',
  () => ({
    Button: ({ children, ...props }: React.ComponentProps<'button'>) => (
      <button type="button" {...props}>
        {children}
      </button>
    ),
    OGDialog: ({
      children,
      open,
      onOpenChange,
    }: {
      children: React.ReactNode;
      open: boolean;
      onOpenChange: (open: boolean) => void;
    }) =>
      open ? (
        <div>
          <button type="button" aria-label={CLOSE_DIALOG_LABEL} onClick={() => onOpenChange(false)}>
            {CLOSE_DIALOG_LABEL}
          </button>
          {children}
        </div>
      ) : null,
    OGDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    OGDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    OGDialogTitle: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="wechat-dialog-title">{children}</div>
    ),
    useToastContext: () => ({
      showToast: mockShowToast,
    }),
  }),
  { virtual: true },
);

const mockUseLocalize = jest.requireMock('~/hooks').useLocalize as jest.Mock;
const mockUseWeChatStatusQuery = jest.requireMock('~/data-provider')
  .useWeChatStatusQuery as jest.Mock;
const mockUseStartWeChatBindMutation = jest.requireMock('~/data-provider')
  .useStartWeChatBindMutation as jest.Mock;
const mockUseUnbindWeChatMutation = jest.requireMock('~/data-provider')
  .useUnbindWeChatMutation as jest.Mock;
const mockUseWeChatBindStatusQuery = jest.requireMock('~/data-provider')
  .useWeChatBindStatusQuery as jest.Mock;

describe('WeChatQuickAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInvalidateQueries.mockReset();
    mockRefetchQueries.mockReset();
    mockShowToast.mockReset();
    mockUseLocalize.mockReturnValue((key: string) => {
      const translations: Record<string, string> = {
        com_ui_error_connection: 'Error connecting to server, try refreshing the page.',
        com_nav_wechat_binding: 'WeChat',
        com_ui_wechat_bind: 'Bind WeChat',
        com_ui_wechat_bound_healthy: 'Connected',
        com_ui_wechat_connected_account: 'Connected account',
        com_ui_wechat_reauth_required: 'Rebind required',
        com_ui_wechat_unbound: 'Not connected',
        com_ui_wechat_unbind: 'Unbind WeChat',
        com_ui_wechat_qr_help: 'Use WeChat to scan this QR code.',
        com_ui_wechat_qr_title: 'Scan with WeChat',
        com_ui_initializing: 'Initializing...',
      };

      return translations[key] ?? key;
    });
    mockUseWeChatStatusQuery.mockReturnValue({
      data: { status: 'unbound', hasBinding: false },
      isLoading: false,
      isError: false,
    });
    mockUseStartWeChatBindMutation.mockReturnValue({
      mutate: jest.fn((_value, options) =>
        options?.onSuccess?.({
          bindSessionId: 'bind-session-1',
          qrCodeDataUrl: 'https://liteapp.weixin.qq.com/q/example',
          expiresAt: '2026-04-12T00:00:00.000Z',
        }),
      ),
      isLoading: false,
    });
    mockUseUnbindWeChatMutation.mockReturnValue({
      mutate: jest.fn(),
      isLoading: false,
    });
    mockUseWeChatBindStatusQuery.mockReturnValue({
      data: undefined,
      isError: false,
    });
  });

  it('opens WeChat binding dialog and auto-starts QR flow for unbound accounts', () => {
    render(<WeChatQuickAction />);

    fireEvent.click(screen.getByRole('button', { name: 'WeChat' }));

    expect(screen.getByText('Scan with WeChat')).toBeInTheDocument();
    expect(screen.getByTestId('wechat-qr-svg')).toHaveAttribute(
      'data-value',
      'https://liteapp.weixin.qq.com/q/example',
    );
  });

  it('renders a decorative WeChat icon in the quick action button', () => {
    render(<WeChatQuickAction />);

    const wechatButton = screen.getByRole('button', { name: 'WeChat' });

    expect(wechatButton.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it('waits for WeChat status resolution before auto-starting bind flow', async () => {
    const statusState: {
      data:
        | {
            hasBinding: boolean;
            status: 'unbound' | 'healthy' | 'reauth_required';
          }
        | undefined;
    } = {
      data: undefined,
    };
    const mutate = jest.fn((_value, options) =>
      options?.onSuccess?.({
        bindSessionId: 'bind-session-1',
        qrCodeDataUrl: 'https://liteapp.weixin.qq.com/q/example',
        expiresAt: '2026-04-12T00:00:00.000Z',
      }),
    );

    mockUseWeChatStatusQuery.mockImplementation(() => ({
      data: statusState.data,
      isLoading: statusState.data == null,
      isError: false,
    }));
    mockUseStartWeChatBindMutation.mockReturnValue({
      mutate,
      isLoading: false,
    });

    const { rerender } = render(<WeChatQuickAction />);

    fireEvent.click(screen.getByRole('button', { name: 'WeChat' }));

    expect(screen.getByText('Scan with WeChat')).toBeInTheDocument();
    expect(screen.getByText('Initializing...')).toBeInTheDocument();
    expect(screen.queryByTestId('wechat-qr-svg')).not.toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();

    statusState.data = { status: 'unbound', hasBinding: false };
    rerender(<WeChatQuickAction />);

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('wechat-qr-svg')).toHaveAttribute(
      'data-value',
      'https://liteapp.weixin.qq.com/q/example',
    );
  });

  it('keeps WeChat status query passive until dialog opens', () => {
    const statusState: {
      data:
        | {
            hasBinding: boolean;
            status: 'unbound' | 'healthy' | 'reauth_required';
          }
        | undefined;
    } = {
      data: undefined,
    };
    const mutate = jest.fn();

    mockUseWeChatStatusQuery.mockImplementation((config?: { enabled?: boolean }) => {
      statusState.data =
        config?.enabled === true ? { status: 'healthy', hasBinding: true } : undefined;

      return {
        data: statusState.data,
        isLoading: config?.enabled === true ? false : true,
        isError: false,
      };
    });
    mockUseStartWeChatBindMutation.mockReturnValue({
      mutate,
      isLoading: false,
    });

    render(<WeChatQuickAction />);

    expect(mockUseWeChatStatusQuery).toHaveBeenLastCalledWith({ enabled: false });
    expect(mutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'WeChat' }));

    expect(mockUseWeChatStatusQuery).toHaveBeenLastCalledWith({ enabled: true });
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('shows an error toast and closes the dialog when bind start fails', async () => {
    const mutate = jest.fn((_value, options) =>
      options?.onError?.(new Error('bind start failed'), undefined, undefined),
    );

    mockUseStartWeChatBindMutation.mockReturnValue({
      mutate,
      isLoading: false,
    });

    render(<WeChatQuickAction />);

    fireEvent.click(screen.getByRole('button', { name: 'WeChat' }));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith({
        message: 'Error connecting to server, try refreshing the page.',
        status: 'error',
      });
    });

    expect(screen.queryByText('Scan with WeChat')).not.toBeInTheDocument();
    expect(screen.queryByText('Initializing...')).not.toBeInTheDocument();
  });

  it('auto-starts a QR bind flow for direct entry when reauth is required', async () => {
    const mutate = jest.fn((_value, options) =>
      options?.onSuccess?.({
        bindSessionId: 'bind-session-reauth-1',
        qrCodeDataUrl: 'https://liteapp.weixin.qq.com/q/reauth',
        expiresAt: '2026-04-12T00:00:00.000Z',
      }),
    );

    mockUseWeChatStatusQuery.mockReturnValue({
      data: { status: 'reauth_required', hasBinding: true, ilinkUserId: 'wechat-1' },
      isLoading: false,
      isError: false,
    });
    mockUseStartWeChatBindMutation.mockReturnValue({
      mutate,
      isLoading: false,
    });

    render(<WeChatQuickAction />);

    fireEvent.click(screen.getByRole('button', { name: 'WeChat' }));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText('Scan with WeChat')).toBeInTheDocument();
    expect(screen.getByTestId('wechat-qr-svg')).toHaveAttribute(
      'data-value',
      'https://liteapp.weixin.qq.com/q/reauth',
    );
  });

  it('does not auto-start a new bind for healthy accounts and opens in management state', () => {
    const mutate = jest.fn();

    mockUseWeChatStatusQuery.mockReturnValue({
      data: { status: 'healthy', hasBinding: true, ilinkUserId: 'wechat-1' },
      isLoading: false,
      isError: false,
    });
    mockUseStartWeChatBindMutation.mockReturnValue({
      mutate,
      isLoading: false,
    });

    render(<WeChatQuickAction />);

    fireEvent.click(screen.getByRole('button', { name: 'WeChat' }));

    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('Connected account: wechat-1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unbind WeChat' })).toBeInTheDocument();
    expect(screen.getByTestId('wechat-dialog-title')).toHaveTextContent('WeChat');
    expect(screen.queryByText('Scan with WeChat')).not.toBeInTheDocument();
    expect(screen.queryByText('Initializing...')).not.toBeInTheDocument();
  });

  it('shows connected-account unbind action and calls unbind mutation', () => {
    const unbindMutate = jest.fn();

    mockUseWeChatStatusQuery.mockReturnValue({
      data: { status: 'healthy', hasBinding: true, ilinkUserId: 'wechat-1' },
      isLoading: false,
      isError: false,
    });
    mockUseUnbindWeChatMutation.mockReturnValue({
      mutate: unbindMutate,
      isLoading: false,
    });

    render(<WeChatQuickAction />);

    fireEvent.click(screen.getByRole('button', { name: 'WeChat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Unbind WeChat' }));

    expect(unbindMutate).toHaveBeenCalledTimes(1);
  });

  it('resets transient QR session state when dialog closes and reopens', async () => {
    const mutate = jest
      .fn()
      .mockImplementationOnce((_value, options) =>
        options?.onSuccess?.({
          bindSessionId: 'bind-session-1',
          qrCodeDataUrl: 'https://liteapp.weixin.qq.com/q/example-1',
          expiresAt: '2026-04-12T00:00:00.000Z',
        }),
      )
      .mockImplementationOnce(() => undefined);

    mockUseStartWeChatBindMutation.mockReturnValue({
      mutate,
      isLoading: false,
    });

    render(<WeChatQuickAction />);

    fireEvent.click(screen.getByRole('button', { name: 'WeChat' }));
    expect(screen.getByTestId('wechat-qr-svg')).toHaveAttribute(
      'data-value',
      'https://liteapp.weixin.qq.com/q/example-1',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(screen.queryByText('Scan with WeChat')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'WeChat' }));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByText('Not connected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bind WeChat' })).toBeInTheDocument();
    expect(screen.queryByTestId('wechat-qr-svg')).not.toBeInTheDocument();
  });

  it('does not auto-start a new bind after unbinding from management state', async () => {
    const statusState: {
      data:
        | {
            hasBinding: boolean;
            ilinkUserId?: string;
            status: 'unbound' | 'healthy' | 'reauth_required';
          }
        | undefined;
    } = {
      data: { status: 'healthy', hasBinding: true, ilinkUserId: 'wechat-1' },
    };
    const startMutate = jest.fn();
    const unbindMutate = jest.fn(() => {
      statusState.data = { status: 'unbound', hasBinding: false };
    });

    mockUseWeChatStatusQuery.mockImplementation(() => ({
      data: statusState.data,
      isLoading: false,
      isError: false,
    }));
    mockUseStartWeChatBindMutation.mockReturnValue({
      mutate: startMutate,
      isLoading: false,
    });
    mockUseUnbindWeChatMutation.mockReturnValue({
      mutate: unbindMutate,
      isLoading: false,
    });

    const { rerender } = render(<WeChatQuickAction />);

    fireEvent.click(screen.getByRole('button', { name: 'WeChat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Unbind WeChat' }));

    expect(unbindMutate).toHaveBeenCalledTimes(1);

    rerender(<WeChatQuickAction />);

    await waitFor(() => {
      expect(screen.getByText('Not connected')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Bind WeChat' })).toBeInTheDocument();
    expect(startMutate).not.toHaveBeenCalled();
    expect(screen.queryByText('Initializing...')).not.toBeInTheDocument();
  });

  it('keeps dialog open and shows retry state when management bind start fails', async () => {
    const statusState: {
      data:
        | {
            hasBinding: boolean;
            ilinkUserId?: string;
            status: 'unbound' | 'healthy' | 'reauth_required';
          }
        | undefined;
    } = {
      data: { status: 'healthy', hasBinding: true, ilinkUserId: 'wechat-1' },
    };
    const mutate = jest.fn((_value, options) =>
      options?.onError?.(new Error('bind start failed'), undefined, undefined),
    );
    const unbindMutate = jest.fn(() => {
      statusState.data = { status: 'unbound', hasBinding: false };
    });

    mockUseWeChatStatusQuery.mockImplementation(() => ({
      data: statusState.data,
      isLoading: false,
      isError: false,
    }));
    mockUseStartWeChatBindMutation.mockReturnValue({
      mutate,
      isLoading: false,
    });
    mockUseUnbindWeChatMutation.mockReturnValue({
      mutate: unbindMutate,
      isLoading: false,
    });

    const { rerender } = render(<WeChatQuickAction />);

    fireEvent.click(screen.getByRole('button', { name: 'WeChat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Unbind WeChat' }));
    rerender(<WeChatQuickAction />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Bind WeChat' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Bind WeChat' }));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith({
        message: 'Error connecting to server, try refreshing the page.',
        status: 'error',
      });
    });

    expect(screen.getByTestId('wechat-dialog-title')).toHaveTextContent('WeChat');
    expect(screen.getByText('Not connected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bind WeChat' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unbind WeChat' })).not.toBeInTheDocument();
  });

  it('does not auto-start a fresh bind after healthy completion and immediate reopen', async () => {
    const statusState: {
      data:
        | {
            hasBinding: boolean;
            ilinkUserId?: string;
            status: 'unbound' | 'healthy' | 'reauth_required';
          }
        | undefined;
    } = {
      data: { status: 'unbound', hasBinding: false },
    };
    const bindStatusState: {
      data:
        | {
            status: 'pending' | 'healthy';
            qrCodeDataUrl?: string;
          }
        | undefined;
    } = {
      data: undefined,
    };
    let resolveRefetch: (() => void) | undefined;
    const refetchPromise = new Promise<void>((resolve) => {
      resolveRefetch = resolve;
    });
    const startMutate = jest.fn((_value, options) =>
      options?.onSuccess?.({
        bindSessionId: 'bind-session-1',
        qrCodeDataUrl: 'https://liteapp.weixin.qq.com/q/example',
        expiresAt: '2026-04-12T00:00:00.000Z',
      }),
    );

    mockRefetchQueries.mockImplementation(() => refetchPromise);
    mockUseWeChatStatusQuery.mockImplementation(() => ({
      data: statusState.data,
      isLoading: false,
      isError: false,
    }));
    mockUseWeChatBindStatusQuery.mockImplementation(() => ({
      data: bindStatusState.data,
      isError: false,
    }));
    mockUseStartWeChatBindMutation.mockReturnValue({
      mutate: startMutate,
      isLoading: false,
    });

    const { rerender } = render(<WeChatQuickAction />);

    fireEvent.click(screen.getByRole('button', { name: 'WeChat' }));
    await waitFor(() => expect(startMutate).toHaveBeenCalledTimes(1));

    bindStatusState.data = { status: 'healthy' };
    rerender(<WeChatQuickAction />);

    expect(screen.getByText('Scan with WeChat')).toBeInTheDocument();

    statusState.data = { status: 'healthy', hasBinding: true, ilinkUserId: 'wechat-1' };
    resolveRefetch?.();
    rerender(<WeChatQuickAction />);

    await waitFor(() => {
      expect(screen.queryByText('Scan with WeChat')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'WeChat' }));

    expect(startMutate).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('Connected account: wechat-1')).toBeInTheDocument();
  });
});

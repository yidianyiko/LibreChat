import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import WeChatBinding from '../WeChatBinding';

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
    Label: ({ children, ...props }: React.ComponentProps<'label'>) => (
      <label {...props}>{children}</label>
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
    OGDialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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

describe('WeChatBinding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInvalidateQueries.mockReset();
    mockRefetchQueries.mockReset();
    mockShowToast.mockReset();
    mockUseLocalize.mockReturnValue((key: string) => {
      const translations: Record<string, string> = {
        com_nav_wechat_binding: 'WeChat binding',
        com_ui_wechat_bind: 'Bind WeChat',
        com_ui_wechat_bound_healthy: 'Connected',
        com_ui_wechat_bound_success: 'WeChat connected',
        com_ui_wechat_unbound: 'Not connected',
        com_ui_wechat_reauth_required: 'Rebind required',
        com_ui_wechat_unbind: 'Unbind WeChat',
        com_ui_wechat_connected_account: 'Connected account',
        com_ui_wechat_qr_title: 'Scan with WeChat',
        com_ui_wechat_qr_help: 'Use WeChat to scan this QR code.',
      };

      return translations[key] ?? key;
    });
    mockUseStartWeChatBindMutation.mockReturnValue({
      mutate: jest.fn(),
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

  it('shows the bind CTA when the account is unbound', () => {
    mockUseWeChatStatusQuery.mockReturnValue({
      data: { status: 'unbound', hasBinding: false },
      isLoading: false,
      isError: false,
    });

    render(<WeChatBinding />);

    expect(screen.getByRole('button', { name: 'Bind WeChat' })).toBeInTheDocument();
    expect(screen.getByText('Not connected')).toBeInTheDocument();
  });

  it('keeps the inline settings row and opens QR dialog after clicking bind', async () => {
    const mutate = jest.fn((_value, options) => {
      options?.onSuccess?.({
        bindSessionId: 'bind-session-1',
        qrCodeDataUrl: 'https://liteapp.weixin.qq.com/q/example',
        expiresAt: '2026-04-12T00:00:00.000Z',
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
    expect(screen.getByText('Not connected')).toBeInTheDocument();
    expect(screen.queryByText('Scan with WeChat')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Bind WeChat' }));

    await waitFor(() => {
      expect(screen.getByText('Scan with WeChat')).toBeInTheDocument();
    });

    expect(screen.getByText('WeChat binding')).toBeInTheDocument();
    expect(screen.getByText('Not connected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bind WeChat' })).toBeInTheDocument();
  });

  it('shows the healthy status and unbind action when connected', () => {
    mockUseWeChatStatusQuery.mockReturnValue({
      data: { status: 'healthy', hasBinding: true, ilinkUserId: 'wechat-1' },
      isLoading: false,
      isError: false,
    });

    render(<WeChatBinding />);

    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unbind WeChat' })).toBeInTheDocument();
  });

  it('renders a generated QR code when the bind payload contains a WeChat URL', () => {
    const mutate = jest.fn((_value, options) => {
      options?.onSuccess?.({
        bindSessionId: 'bind-session-1',
        qrCodeDataUrl: 'https://liteapp.weixin.qq.com/q/example',
        expiresAt: '2026-04-12T00:00:00.000Z',
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

    fireEvent.click(screen.getByRole('button', { name: 'Bind WeChat' }));

    expect(screen.getByTestId('wechat-qr-svg')).toHaveAttribute(
      'data-value',
      'https://liteapp.weixin.qq.com/q/example',
    );
    expect(screen.queryByRole('img', { name: 'Scan with WeChat' })).not.toBeInTheDocument();
  });

  it('shows the reauth-required warning when the binding has expired', () => {
    mockUseWeChatStatusQuery.mockReturnValue({
      data: { status: 'reauth_required', hasBinding: true, ilinkUserId: 'wechat-1' },
      isLoading: false,
      isError: false,
    });

    render(<WeChatBinding />);

    expect(screen.getByText('Rebind required')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bind WeChat' })).toBeInTheDocument();
  });

  it('shows a success toast and refreshes status after the bind completes', () => {
    const mutate = jest.fn((_value, options) => {
      options?.onSuccess?.({
        bindSessionId: 'bind-session-1',
        qrCodeDataUrl: 'https://liteapp.weixin.qq.com/q/example',
        expiresAt: '2026-04-12T00:00:00.000Z',
      });
    });

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
              qrCodeDataUrl: 'https://liteapp.weixin.qq.com/q/example',
              status: 'healthy',
            },
      isError: false,
    }));
    mockUseStartWeChatBindMutation.mockReturnValue({
      mutate,
      isLoading: false,
    });

    render(<WeChatBinding />);

    fireEvent.click(screen.getByRole('button', { name: 'Bind WeChat' }));

    expect(mockInvalidateQueries).toHaveBeenCalledWith([expect.any(String)]);
    expect(mockRefetchQueries).toHaveBeenCalledWith([expect.any(String)]);
    expect(mockShowToast).toHaveBeenCalledWith({
      message: 'WeChat connected',
      status: 'success',
    });
  });
});

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
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
    }: {
      children: React.ReactNode;
      open: boolean;
      onOpenChange: (open: boolean) => void;
    }) => (open ? <div>{children}</div> : null),
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

describe('WeChatQuickAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInvalidateQueries.mockReset();
    mockRefetchQueries.mockReset();
    mockShowToast.mockReset();
    mockUseLocalize.mockReturnValue((key: string) => {
      const translations: Record<string, string> = {
        com_nav_wechat_binding: 'WeChat',
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
});

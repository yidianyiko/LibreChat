import React from 'react';
import { render, screen } from '@testing-library/react';
import WeChatBinding from '../WeChatBinding';

const mockInvalidateQueries = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

jest.mock('~/hooks', () => ({
  useLocalize: jest.fn(),
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
      <button {...props}>{children}</button>
    ),
    Label: ({ children, ...props }: React.ComponentProps<'label'>) => (
      <label {...props}>{children}</label>
    ),
    OGDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    OGDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    OGDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    OGDialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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
    mockUseLocalize.mockReturnValue((key: string) => {
      const translations: Record<string, string> = {
        com_nav_wechat_binding: 'WeChat binding',
        com_ui_wechat_bind: 'Bind WeChat',
        com_ui_wechat_bound_healthy: 'Connected',
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
});

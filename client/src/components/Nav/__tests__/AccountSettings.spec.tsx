import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AccountSettings from '../AccountSettings';

const mockInvalidateQueries = jest.fn();
const mockRefetchQueries = jest.fn();
const mockShowToast = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
    refetchQueries: mockRefetchQueries,
  }),
}));

jest.mock('@ariakit/react/select', () => {
  const React = require('react');
  return {
    SelectProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Select: React.forwardRef<HTMLDivElement, React.ComponentProps<'div'>>((props, ref) => {
      const { children, ...rest } = props;
      return (
        <div ref={ref} {...rest}>
          {children}
        </div>
      );
    }),
    SelectPopover: ({
      children,
      ...props
    }: React.ComponentProps<'div'> & {
      children: React.ReactNode;
    }) => <div {...props}>{children}</div>,
    SelectItem: ({
      children,
      ...props
    }: React.ComponentProps<'div'> & {
      children: React.ReactNode;
    }) => <div {...props}>{children}</div>,
  };
});

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
    }) => (open ? <div>{children}</div> : null),
    OGDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    OGDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    OGDialogTitle: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="wechat-dialog-title">{children}</div>
    ),
    useToastContext: () => ({
      showToast: mockShowToast,
    }),
    LinkIcon: () => <span data-testid="link-icon" />,
    GearIcon: () => <span data-testid="gear-icon" />,
    DropdownMenuSeparator: () => <div data-testid="separator" />,
    Avatar: () => <div data-testid="avatar" />,
  }),
  { virtual: true },
);

jest.mock('~/components/Chat/Input/Files/MyFilesModal', () => ({
  MyFilesModal: () => null,
}));

jest.mock('../Settings', () => () => null);
jest.mock('../SettingsTabs/Data/ImportConversations', () => ({
  __esModule: true,
  default: ({
    renderTrigger,
  }: {
    renderTrigger?: (args: { isUploading: boolean; importingLabel: string }) => React.ReactNode;
  }) => (
    <div data-testid="shared-import-conversations-flow">
      {renderTrigger?.({
        isUploading: false,
        importingLabel: 'com_ui_importing',
      })}
    </div>
  ),
}));
jest.mock(
  '../SettingsTabs/Data/ImportConversationDialog',
  () => ({
    __esModule: true,
    default: ({ open }: { open: boolean }) => (
      <div data-testid="outer-import-dialog" data-open={String(open)} />
    ),
  }),
);

jest.mock('~/hooks', () => ({
  useLocalize: jest.fn(),
}));

jest.mock('~/hooks/AuthContext', () => ({
  useAuthContext: jest.fn(),
}));

jest.mock('~/data-provider', () => ({
  useGetStartupConfig: jest.fn(),
  useGetUserBalance: jest.fn(),
  useWeChatStatusQuery: jest.fn(),
  useWeChatBindStatusQuery: jest.fn(),
  useStartWeChatBindMutation: jest.fn(),
  useUnbindWeChatMutation: jest.fn(),
  SystemRoles: {
    ADMIN: 'ADMIN',
  },
}));

const mockUseLocalize = jest.requireMock('~/hooks').useLocalize;
const mockUseAuthContext = jest.requireMock('~/hooks/AuthContext').useAuthContext;
const mockUseGetStartupConfig = jest.requireMock('~/data-provider').useGetStartupConfig;
const mockUseGetUserBalance = jest.requireMock('~/data-provider').useGetUserBalance;
const mockUseWeChatStatusQuery = jest.requireMock('~/data-provider').useWeChatStatusQuery;
const mockUseWeChatBindStatusQuery = jest.requireMock('~/data-provider').useWeChatBindStatusQuery;
const mockUseStartWeChatBindMutation = jest.requireMock('~/data-provider').useStartWeChatBindMutation;
const mockUseUnbindWeChatMutation = jest.requireMock('~/data-provider').useUnbindWeChatMutation;

describe('AccountSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInvalidateQueries.mockReset();
    mockRefetchQueries.mockReset();
    mockShowToast.mockReset();
    mockUseAuthContext.mockReturnValue({
      user: { name: 'Test User', email: 'test@example.com' },
      isAuthenticated: true,
      logout: jest.fn(),
    });
    mockUseLocalize.mockReturnValue((key: string) => {
      if (key === 'com_nav_balance') {
        return 'Token Credits';
      }
      return key;
    });
    mockUseGetStartupConfig.mockReturnValue({
      data: {
        balance: { enabled: false },
        helpAndFaqURL: '/',
      },
    });
    mockUseGetUserBalance.mockReturnValue({ data: null });
    mockUseWeChatStatusQuery.mockReturnValue({
      data: { status: 'healthy', hasBinding: true, ilinkUserId: 'wechat-1' },
      isLoading: false,
      isError: false,
    });
    mockUseWeChatBindStatusQuery.mockReturnValue({
      data: undefined,
      isError: false,
    });
    mockUseStartWeChatBindMutation.mockReturnValue({
      mutate: jest.fn(),
      isLoading: false,
    });
    mockUseUnbindWeChatMutation.mockReturnValue({
      mutate: jest.fn(),
      isLoading: false,
    });
  });

  it('always shows the recharge button in the account menu', () => {
    render(<AccountSettings />);

    expect(screen.getByRole('button', { name: /add credits/i })).toBeInTheDocument();
  });

  it('shows token credits with approximate USD hint when balance is enabled', () => {
    mockUseGetStartupConfig.mockReturnValue({
      data: {
        balance: { enabled: true },
      },
    });
    mockUseGetUserBalance.mockReturnValue({
      data: {
        tokenCredits: 2500000,
      },
    });

    render(<AccountSettings />);

    expect(screen.getByText(/Token Credits:\s*2,500,000/)).toBeInTheDocument();
    expect(screen.getByText(/≈ \$2\.50/)).toBeInTheDocument();
  });

  it('uses the shared import flow for migrate history entry', () => {
    render(<AccountSettings />);

    expect(screen.getByTestId('shared-import-conversations-flow')).toBeInTheDocument();
  });

  it('opens outer import dialog before parsed import flow starts', () => {
    render(<AccountSettings />);

    fireEvent.click(screen.getByRole('button', { name: 'com_ui_import_conversation_info' }));

    expect(screen.getByTestId('outer-import-dialog')).toHaveAttribute('data-open', 'true');
  });

  it('shows migrate history and wechat quick actions in the home-visible stack', () => {
    render(<AccountSettings />);

    expect(screen.getByRole('button', { name: 'com_ui_import_conversation_info' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'com_nav_wechat_binding' })).toBeInTheDocument();
  });

  it('opens the shared wechat dialog from account settings quick action', () => {
    render(<AccountSettings />);

    fireEvent.click(screen.getByRole('button', { name: 'com_nav_wechat_binding' }));

    expect(screen.getByTestId('wechat-dialog-title')).toHaveTextContent('com_nav_wechat_binding');
    expect(screen.getByText('com_ui_wechat_connected_account: wechat-1')).toBeInTheDocument();
  });
});

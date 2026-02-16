import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AccountSettings from '../AccountSettings';

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
}));

jest.mock('@ariakit/react/select', () => {
  const React = require('react');
  return {
    SelectProvider: ({ children }) => <div>{children}</div>,
    Select: React.forwardRef((props, ref) => {
      const { children, ...rest } = props;
      return (
        <div ref={ref} {...rest}>
          {children}
        </div>
      );
    }),
    SelectPopover: ({ children, ...props }) => <div {...props}>{children}</div>,
    SelectItem: ({ children, ...props }) => <div {...props}>{children}</div>,
  };
});

jest.mock('@librechat/client', () => ({
  LinkIcon: () => <span data-testid="link-icon" />,
  GearIcon: () => <span data-testid="gear-icon" />,
  DropdownMenuSeparator: () => <div data-testid="separator" />,
  Avatar: () => <div data-testid="avatar" />,
}));

jest.mock('~/components/Chat/Input/Files/MyFilesModal', () => ({
  MyFilesModal: () => null,
}));

jest.mock('../Settings', () => () => null);
jest.mock('../SettingsTabs/Data/ImportConversations', () => (props) => (
  <div data-testid="shared-import-conversations-flow">
    {props.renderTrigger?.({
      onClick: jest.fn(),
      isUploading: false,
      importLabel: 'com_ui_import',
      importingLabel: 'com_ui_importing',
    })}
  </div>
));
jest.mock(
  '../SettingsTabs/Data/ImportConversationDialog',
  () => ({ open }) => <div data-testid="outer-import-dialog" data-open={String(open)} />,
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
  SystemRoles: {
    ADMIN: 'ADMIN',
  },
}));

const mockUseLocalize = jest.requireMock('~/hooks').useLocalize;
const mockUseAuthContext = jest.requireMock('~/hooks/AuthContext').useAuthContext;
const mockUseGetStartupConfig = jest.requireMock('~/data-provider').useGetStartupConfig;
const mockUseGetUserBalance = jest.requireMock('~/data-provider').useGetUserBalance;

describe('AccountSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});

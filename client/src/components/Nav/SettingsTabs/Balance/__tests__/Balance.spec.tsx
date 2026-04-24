import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Balance from '../Balance';

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
}));

jest.mock('~/hooks', () => ({
  useAuthContext: jest.fn(),
  useLocalize: jest.fn(),
}));

jest.mock('~/data-provider', () => ({
  useGetStartupConfig: jest.fn(),
  useGetUserBalance: jest.fn(),
}));

jest.mock('../TokenCreditsItem', () => ({
  __esModule: true,
  default: () => <div data-testid="token-credits" />,
}));

jest.mock('../AutoRefillSettings', () => ({
  __esModule: true,
  default: () => <div data-testid="auto-refill-settings" />,
}));

const mockUseAuthContext = jest.requireMock('~/hooks').useAuthContext;
const mockUseLocalize = jest.requireMock('~/hooks').useLocalize;
const mockUseGetStartupConfig = jest.requireMock('~/data-provider').useGetStartupConfig;
const mockUseGetUserBalance = jest.requireMock('~/data-provider').useGetUserBalance;

describe('Balance settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthContext.mockReturnValue({ isAuthenticated: true });
    mockUseLocalize.mockReturnValue((key: string) => key);
    mockUseGetStartupConfig.mockReturnValue({
      data: {
        balance: { enabled: false },
      },
    });
    mockUseGetUserBalance.mockReturnValue({ data: null });
  });

  it('always shows the recharge button', () => {
    render(<Balance />);

    expect(screen.getByRole('button', { name: /add credits/i })).toBeInTheDocument();
  });
});

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RechargePage } from '../RechargePage';

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  useSearchParams: () => [new URLSearchParams()],
}));

jest.mock('@librechat/client', () => ({
  useToastContext: () => ({ showToast: jest.fn() }),
}));

jest.mock('~/hooks/Recharge/useRechargeQueries', () => ({
  usePricingQuery: jest.fn(),
  useCreateCheckoutSession: jest.fn(),
}));

const mockUsePricingQuery = jest.requireMock('~/hooks/Recharge/useRechargeQueries').usePricingQuery;
const mockUseCreateCheckoutSession = jest.requireMock(
  '~/hooks/Recharge/useRechargeQueries',
).useCreateCheckoutSession;

describe('RechargePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePricingQuery.mockReturnValue({
      data: {
        enabled: true,
        tiers: [
          {
            id: 'explorer',
            name: 'Explorer',
            description: 'x',
            price: 499,
            credits: 5000000,
            discount: 0,
          },
        ],
      },
      isLoading: false,
      error: null,
    });
    mockUseCreateCheckoutSession.mockReturnValue({
      mutateAsync: jest.fn(),
      isLoading: false,
    });
  });

  it('uses token credits wording consistently in recharge copy', () => {
    render(<RechargePage />);

    expect(screen.getByRole('heading', { name: /recharge your token credits/i })).toBeInTheDocument();
    expect(screen.getByText(/choose a package to add token credits to your account/i)).toBeInTheDocument();
    expect(screen.getByText(/1,000,000 token credits = \$1\.00 usd/i)).toBeInTheDocument();
    expect(screen.getByText(/token credits never expire/i)).toBeInTheDocument();
  });
});

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RechargePage } from '../RechargePage';
import enTranslation from '~/locales/en/translation.json';

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  useSearchParams: () => [new URLSearchParams()],
}));

jest.mock('@librechat/client', () => ({
  useToastContext: () => ({ showToast: jest.fn() }),
}));

jest.mock('~/hooks', () => ({
  useLocalize: jest.fn(),
}));

jest.mock('~/hooks/Recharge/useRechargeQueries', () => ({
  usePricingQuery: jest.fn(),
  useCreateCheckoutSession: jest.fn(),
}));

const mockUseLocalize = jest.requireMock('~/hooks').useLocalize;
const mockUsePricingQuery = jest.requireMock('~/hooks/Recharge/useRechargeQueries').usePricingQuery;
const mockUseCreateCheckoutSession = jest.requireMock(
  '~/hooks/Recharge/useRechargeQueries',
).useCreateCheckoutSession;

describe('RechargePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLocalize.mockReturnValue((key: keyof typeof enTranslation, params?: Record<string, string>) => {
      const template = enTranslation[key] ?? key;
      if (params == null) {
        return template;
      }
      return Object.entries(params).reduce((message, [paramKey, value]) => {
        return message.replace(new RegExp(`\\{\\{${paramKey}\\}\\}`, 'g'), value);
      }, template);
    });
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
    expect(screen.getByText(/one-time recharge of 5 million token credits/i)).toBeInTheDocument();
    expect(
      screen.getByText(/estimated to cover about 150 gpt-4o conversations or about 5,000 gpt-4o-mini conversations/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/the estimates above reflect typical usage patterns/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/token context/i)).not.toBeInTheDocument();
  });
});

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RecoilRoot } from 'recoil';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RechargePage } from '../RechargePage';

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  useSearchParams: () => [new URLSearchParams()],
}));

jest.mock('@librechat/client', () => ({
  useToastContext: () => ({ showToast: jest.fn() }),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

jest.mock('~/hooks/Recharge/useRechargeQueries', () => ({
  usePricingQuery: jest.fn(),
  useCreateSubscription: jest.fn(),
  useCreateTopup: jest.fn(),
}));

jest.mock('~/hooks/Subscriptions', () => ({
  useGetSubscriptionStatus: jest.fn(),
  useCancelSubscription: jest.fn(),
  useResumeSubscription: jest.fn(),
  useChangeSubscriptionTier: jest.fn(),
}));

jest.mock('../SubscriptionTab', () => ({
  SubscriptionTab: ({ tiers }: { tiers: unknown[] }) => (
    <div data-testid="subscription-tab-content">SubscriptionTab ({tiers.length} tiers)</div>
  ),
}));

jest.mock('../TopupTab', () => ({
  TopupTab: ({ tiers }: { tiers: unknown[] }) => (
    <div data-testid="topup-tab-content">TopupTab ({tiers.length} tiers)</div>
  ),
}));

const mockUsePricingQuery = jest.requireMock('~/hooks/Recharge/useRechargeQueries').usePricingQuery;
const mockUseCreateSubscription = jest.requireMock(
  '~/hooks/Recharge/useRechargeQueries',
).useCreateSubscription;
const mockUseCreateTopup = jest.requireMock('~/hooks/Recharge/useRechargeQueries').useCreateTopup;
const mockUseGetSubscriptionStatus =
  jest.requireMock('~/hooks/Subscriptions').useGetSubscriptionStatus;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <RecoilRoot>
      <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>
    </RecoilRoot>,
  );
};

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
    mockUseCreateSubscription.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    });
    mockUseCreateTopup.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    });
    mockUseGetSubscriptionStatus.mockReturnValue({
      data: null,
      isLoading: false,
    });
  });

  it('renders tab switcher with subscription tab active by default', () => {
    renderWithProviders(<RechargePage />);

    const subscriptionTab = screen.getByRole('button', { name: /subscription/i });
    const topupTab = screen.getByRole('button', { name: /topup/i });

    expect(subscriptionTab).toBeInTheDocument();
    expect(topupTab).toBeInTheDocument();
    expect(screen.getByTestId('subscription-tab-panel')).toBeInTheDocument();
    expect(screen.getByTestId('subscription-tab-content')).toBeInTheDocument();
    expect(screen.queryByTestId('topup-tab-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('topup-tab-content')).not.toBeInTheDocument();
  });

  it('switches to topup tab when clicked', () => {
    renderWithProviders(<RechargePage />);

    const topupTab = screen.getByRole('button', { name: /topup/i });
    fireEvent.click(topupTab);

    expect(screen.getByTestId('topup-tab-panel')).toBeInTheDocument();
    expect(screen.getByTestId('topup-tab-content')).toBeInTheDocument();
    expect(screen.queryByTestId('subscription-tab-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('subscription-tab-content')).not.toBeInTheDocument();
  });

  it('uses token credits wording consistently in recharge copy', () => {
    renderWithProviders(<RechargePage />);

    // Check that the localization keys are used (actual translation happens in useLocalize)
    expect(screen.getByText('com_recharge_title')).toBeInTheDocument();
    expect(screen.getByText('com_recharge_choose_package')).toBeInTheDocument();
    expect(screen.getByText('com_recharge_credits_conversion')).toBeInTheDocument();
    expect(screen.getByText('com_recharge_secured_by_stripe')).toBeInTheDocument();
  });
});

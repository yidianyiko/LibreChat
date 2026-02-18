import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RecoilRoot } from 'recoil';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaymentSuccessPage } from '../PaymentSuccessPage';

const mockNavigate = jest.fn();
const mockInvalidateQueries = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams('session_id=test_session_123&type=topup')],
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string, vars?: Record<string, string>) => {
    if (key === 'com_recharge_topup_success_title') return 'Topup Successful!';
    if (key === 'com_recharge_topup_success_desc') return 'Your topup credits have been added.';
    if (key === 'com_recharge_subscription_success_title') return 'Subscription Activated!';
    if (key === 'com_recharge_subscription_success_desc') return 'Your subscription is now active.';
    if (key === 'com_recharge_verifying') return 'Verifying payment...';
    if (key === 'com_recharge_payment_failed_title') return 'Payment Failed';
    if (key === 'com_recharge_payment_failed_desc') return 'We could not verify your payment.';
    if (key === 'com_recharge_credits_added') return 'Credits Added';
    if (key === 'com_recharge_credits_amount') return `${vars?.['0'] ?? '0'} M Credits`;
    if (key === 'com_recharge_amount_paid') return `Amount paid: $${vars?.['0'] ?? '0'}`;
    if (key === 'com_recharge_subscription_tier') return 'Subscription Tier';
    if (key === 'com_recharge_subscription_balance') return 'Subscription Balance';
    if (key === 'com_recharge_start_chatting') return 'Start Chatting';
    if (key === 'com_recharge_manage_subscription') return 'Manage Subscription';
    if (key === 'com_recharge_try_again') return 'Try Again';
    return key;
  },
}));

jest.mock('~/hooks/Recharge/useRechargeQueries', () => ({
  useVerifySessionQuery: jest.fn(),
}));

jest.mock('~/hooks/Subscriptions', () => ({
  useGetSubscriptionStatus: jest.fn(),
}));

const mockUseVerifySessionQuery = jest.requireMock('~/hooks/Recharge/useRechargeQueries').useVerifySessionQuery;
const mockUseGetSubscriptionStatus = jest.requireMock('~/hooks/Subscriptions').useGetSubscriptionStatus;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

// Override invalidateQueries
queryClient.invalidateQueries = mockInvalidateQueries;

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <RecoilRoot>
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    </RecoilRoot>
  );
};

describe('PaymentSuccessPage - Topup mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock URLSearchParams for topup
    jest.spyOn(URLSearchParams.prototype, 'get').mockImplementation((key) => {
      if (key === 'session_id') return 'test_session_123';
      if (key === 'type') return 'topup';
      return null;
    });

    mockUseGetSubscriptionStatus.mockReturnValue({
      data: null,
      isLoading: false,
    });
  });

  it('shows loading state while verifying topup session', () => {
    mockUseVerifySessionQuery.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    renderWithProviders(<PaymentSuccessPage />);
    expect(screen.getByText('Verifying payment...')).toBeInTheDocument();
  });

  it('shows error state when topup verification fails', () => {
    mockUseVerifySessionQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Verification failed'),
    });

    renderWithProviders(<PaymentSuccessPage />);
    expect(screen.getByText('Payment Failed')).toBeInTheDocument();
    expect(screen.getByText('We could not verify your payment.')).toBeInTheDocument();
  });

  it('shows error state when topup payment is not paid', () => {
    mockUseVerifySessionQuery.mockReturnValue({
      data: { isPaid: false, credits: 0, amountTotal: 0 },
      isLoading: false,
      error: null,
    });

    renderWithProviders(<PaymentSuccessPage />);
    expect(screen.getByText('Payment Failed')).toBeInTheDocument();
  });

  it('shows topup success with credits and amount', () => {
    mockUseVerifySessionQuery.mockReturnValue({
      data: {
        isPaid: true,
        credits: 5000000,
        amountTotal: 500,
        sessionId: 'test_session_123',
        paymentStatus: 'paid',
        tierId: 'test',
      },
      isLoading: false,
      error: null,
    });

    renderWithProviders(<PaymentSuccessPage />);

    expect(screen.getByText('Topup Successful!')).toBeInTheDocument();
    expect(screen.getByText('Your topup credits have been added.')).toBeInTheDocument();
    expect(screen.getByText('Credits Added')).toBeInTheDocument();
    expect(screen.getByText('5.0 M Credits')).toBeInTheDocument();
    expect(screen.getByText('Amount paid: $5.00')).toBeInTheDocument();
  });

  it('invalidates balance query on topup success', () => {
    mockUseVerifySessionQuery.mockReturnValue({
      data: {
        isPaid: true,
        credits: 5000000,
        amountTotal: 500,
      },
      isLoading: false,
      error: null,
    });

    renderWithProviders(<PaymentSuccessPage />);

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['balance'] });
  });

  it('navigates to home when Start Chatting is clicked', () => {
    mockUseVerifySessionQuery.mockReturnValue({
      data: { isPaid: true, credits: 5000000, amountTotal: 500 },
      isLoading: false,
      error: null,
    });

    renderWithProviders(<PaymentSuccessPage />);

    const startChattingButton = screen.getByRole('button', { name: /start chatting/i });
    fireEvent.click(startChattingButton);

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('navigates to recharge when Manage Subscription is clicked', () => {
    mockUseVerifySessionQuery.mockReturnValue({
      data: { isPaid: true, credits: 5000000, amountTotal: 500 },
      isLoading: false,
      error: null,
    });

    renderWithProviders(<PaymentSuccessPage />);

    const manageButton = screen.getByRole('button', { name: /manage subscription/i });
    fireEvent.click(manageButton);

    expect(mockNavigate).toHaveBeenCalledWith('/recharge');
  });
});

describe('PaymentSuccessPage - Subscription mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock URLSearchParams for subscription
    jest.spyOn(URLSearchParams.prototype, 'get').mockImplementation((key) => {
      if (key === 'session_id') return 'test_session_456';
      if (key === 'type') return 'subscription';
      return null;
    });
  });

  it('does not call useVerifySessionQuery for subscription', () => {
    mockUseVerifySessionQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });

    mockUseGetSubscriptionStatus.mockReturnValue({
      data: {
        subscriptionStatus: 'active',
        subscriptionTier: 'explorer',
        subscriptionBalance: 5000000,
        topupBalance: 0,
        currentPeriodEnd: '2026-03-19',
        cancelAtPeriodEnd: false,
      },
      isLoading: false,
    });

    renderWithProviders(<PaymentSuccessPage />);

    // useVerifySessionQuery should not be called (or disabled)
    expect(screen.queryByText('Verifying payment...')).not.toBeInTheDocument();
    expect(screen.getByText('Subscription Activated!')).toBeInTheDocument();
  });

  it('shows subscription success with tier and balance', () => {
    mockUseVerifySessionQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });

    mockUseGetSubscriptionStatus.mockReturnValue({
      data: {
        subscriptionStatus: 'active',
        subscriptionTier: 'explorer',
        subscriptionBalance: 5000000,
        topupBalance: 0,
        currentPeriodEnd: '2026-03-19',
        cancelAtPeriodEnd: false,
      },
      isLoading: false,
    });

    renderWithProviders(<PaymentSuccessPage />);

    expect(screen.getByText('Subscription Activated!')).toBeInTheDocument();
    expect(screen.getByText('Your subscription is now active.')).toBeInTheDocument();
    expect(screen.getByText('Subscription Tier')).toBeInTheDocument();
    expect(screen.getByText('EXPLORER')).toBeInTheDocument();
    expect(screen.getByText('Subscription Balance')).toBeInTheDocument();
    expect(screen.getByText('5.0 M Credits')).toBeInTheDocument();
  });

  it('invalidates subscriptionStatus and balance queries on subscription success', () => {
    mockUseVerifySessionQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });

    mockUseGetSubscriptionStatus.mockReturnValue({
      data: {
        subscriptionStatus: 'active',
        subscriptionTier: 'explorer',
        subscriptionBalance: 5000000,
        topupBalance: 0,
      },
      isLoading: false,
    });

    renderWithProviders(<PaymentSuccessPage />);

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['subscriptionStatus'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['balance'] });
  });
});

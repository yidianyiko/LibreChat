import type { ReactNode } from 'react';
import { render, screen } from 'test/layout-test-utils';
import { SystemRoles } from 'librechat-data-provider';
import StatsPage from '../StatsPage';

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

jest.mock('~/hooks/AuthContext', () => ({
  AuthContextProvider: ({ children }: { children: ReactNode }) => children,
  useAuthContext: jest.fn(),
}));

jest.mock('~/data-provider', () => ({
  useGetAdminStats: jest.fn(),
}));

jest.mock('../components/DailyRegistrationChart', () =>
  jest.fn(() => <div>DailyRegistrationChart</div>),
);
jest.mock('../components/ProviderPieChart', () => jest.fn(() => <div>ProviderPieChart</div>));
jest.mock('../components/ActivityTrendChart', () => jest.fn(() => <div>ActivityTrendChart</div>), {
  virtual: true,
});
jest.mock(
  '../components/DistributionBarChart',
  () => jest.fn(({ title }: { title: string }) => <div>{title}</div>),
  { virtual: true },
);
jest.mock('../components/QualityMetricsCard', () => jest.fn(() => <div>QualityMetricsCard</div>), {
  virtual: true,
});

const mockUseAuthContext = jest.requireMock('~/hooks/AuthContext').useAuthContext as jest.Mock;
const mockUseGetAdminStats = jest.requireMock('~/data-provider').useGetAdminStats as jest.Mock;

const statsFixture = {
  overview: {
    totalUsers: 100,
    newUsers: {
      last1Day: 2,
      last7Days: 15,
      last30Days: 40,
    },
    activeUsers: {
      last1Day: 4,
      last7Days: 8,
      last30Days: 20,
    },
    messages: {
      last1Day: 25,
      last7Days: 120,
      last30Days: 420,
    },
    conversations: {
      last1Day: 6,
      last7Days: 32,
      last30Days: 110,
    },
    activeRateLast7Days: 0.08,
    messagesPerActiveUserLast7Days: 15,
    errorRateLast7Days: 0.1,
    negativeFeedbackRateLast7Days: 0.25,
  },
  registration: {
    daily: [],
    byProvider: [],
  },
  usage: {
    daily: [],
    byEndpoint: [],
    byModel: [],
  },
  quality: {
    errorsLast7Days: 9,
    assistantMessagesLast7Days: 90,
    feedbackCountLast7Days: 12,
    negativeFeedbackCountLast7Days: 3,
  },
  payments: {
    payments: {
      last1Day: 1,
      last7Days: 4,
      last30Days: 12,
    },
    payingUsers: {
      last7Days: 3,
      last30Days: 5,
    },
    creditsSold: {
      last7Days: 60000000,
      last30Days: 180000000,
    },
    revenue: {
      last7Days: 5996,
      last30Days: 17988,
    },
    byTier: [
      { key: 'artisan', label: 'artisan', count: 7 },
      { key: 'explorer', label: 'explorer', count: 5 },
    ],
  },
  financials: {
    totalRechargeRevenue: 17988,
    userUsageCharged: 8994,
    unusedPaidBalance: 8994,
    totalCreditsSold: 180000000,
    totalUsageCredits: 90000000,
    centsPerCredit: 0.00009993333333333334,
  },
  pricing: {
    modelRates: [
      {
        model: 'gpt-4o',
        usageCount: 55,
        cost: {
          prompt: 2.5,
          completion: 10,
        },
        user: {
          prompt: 5,
          completion: 20,
        },
        markup: {
          prompt: 2,
          completion: 2,
        },
      },
    ],
  },
};

describe('StatsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthContext.mockReturnValue({
      user: { role: SystemRoles.ADMIN },
    });
  });

  it('renders loading state', () => {
    mockUseGetAdminStats.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    render(<StatsPage />);

    expect(screen.getByText('com_ui_loading')).toBeInTheDocument();
  });

  it('renders access denied for non-admin users', () => {
    mockUseAuthContext.mockReturnValue({
      user: { role: SystemRoles.USER },
    });
    mockUseGetAdminStats.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });

    render(<StatsPage />);

    expect(screen.getByText('com_ui_access_denied')).toBeInTheDocument();
    expect(screen.getByText('com_ui_admin_privilege_required')).toBeInTheDocument();
  });

  it('renders expanded analytics cards and sections', () => {
    mockUseGetAdminStats.mockReturnValue({
      data: statsFixture,
      isLoading: false,
      error: null,
    });

    render(<StatsPage />);

    expect(mockUseGetAdminStats).toHaveBeenCalledWith({ days: 30 });
    expect(screen.getByText('com_ui_messages_7d')).toBeInTheDocument();
    expect(screen.getByText('com_ui_conversations_7d')).toBeInTheDocument();
    expect(screen.getByText('com_ui_active_rate_7d')).toBeInTheDocument();
    expect(screen.getByText('com_ui_error_rate_7d')).toBeInTheDocument();
    expect(screen.getByText('com_ui_payments_7d')).toBeInTheDocument();
    expect(screen.getByText('com_ui_paying_users_30d')).toBeInTheDocument();
    expect(screen.getByText('com_ui_revenue_30d')).toBeInTheDocument();
    expect(screen.getByText('com_ui_credits_sold_30d')).toBeInTheDocument();
    expect(screen.getByText('com_ui_total_recharge_revenue')).toBeInTheDocument();
    expect(screen.getByText('com_ui_user_usage_charged')).toBeInTheDocument();
    expect(screen.getByText('com_ui_unused_paid_balance')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('32')).toBeInTheDocument();
    expect(screen.getByText('8.0%')).toBeInTheDocument();
    expect(screen.getByText('10.0%')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getAllByText('$179.88')).toHaveLength(2);
    expect(screen.getAllByText('$89.94')).toHaveLength(2);
    expect(screen.getByText('180,000,000')).toBeInTheDocument();
    expect(screen.getByText('DailyRegistrationChart')).toBeInTheDocument();
    expect(screen.getByText('ActivityTrendChart')).toBeInTheDocument();
    expect(screen.getByText('com_ui_usage_by_endpoint')).toBeInTheDocument();
    expect(screen.getByText('com_ui_model_usage_frequency')).toBeInTheDocument();
    expect(screen.getByText('com_ui_payments_by_tier')).toBeInTheDocument();
    expect(screen.getByText('com_ui_admin_pricing_table')).toBeInTheDocument();
    expect(screen.getByText('gpt-4o')).toBeInTheDocument();
    expect(screen.getByText('$2.50')).toBeInTheDocument();
    expect(screen.getByText('$5.00')).toBeInTheDocument();
    expect(screen.getAllByText('2.0x')).toHaveLength(2);
    expect(screen.getByText('QualityMetricsCard')).toBeInTheDocument();
  });
});

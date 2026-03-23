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

jest.mock('../components/DailyRegistrationChart', () => jest.fn(() => <div>DailyRegistrationChart</div>));
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
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('32')).toBeInTheDocument();
    expect(screen.getByText('8.0%')).toBeInTheDocument();
    expect(screen.getByText('10.0%')).toBeInTheDocument();
    expect(screen.getByText('DailyRegistrationChart')).toBeInTheDocument();
    expect(screen.getByText('ActivityTrendChart')).toBeInTheDocument();
    expect(screen.getByText('com_ui_usage_by_endpoint')).toBeInTheDocument();
    expect(screen.getByText('com_ui_usage_by_model')).toBeInTheDocument();
    expect(screen.getByText('QualityMetricsCard')).toBeInTheDocument();
  });
});

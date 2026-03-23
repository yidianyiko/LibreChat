import { Activity, AlertTriangle, MessageSquare, UserPlus, Users } from 'lucide-react';
import { SystemRoles } from 'librechat-data-provider';

import { useLocalize } from '~/hooks';
import { useAuthContext } from '~/hooks/AuthContext';
import { useGetAdminStats } from '~/data-provider';

import ActivityTrendChart from './components/ActivityTrendChart';
import DailyRegistrationChart from './components/DailyRegistrationChart';
import DistributionBarChart from './components/DistributionBarChart';
import ProviderPieChart from './components/ProviderPieChart';
import QualityMetricsCard from './components/QualityMetricsCard';
import StatCard from './components/StatCard';

export default function StatsPage() {
  const localize = useLocalize();
  const { user } = useAuthContext();
  const { data: stats, isLoading, error } = useGetAdminStats({ days: 30 });

  if (user?.role !== SystemRoles.ADMIN) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary">
            {localize('com_ui_access_denied')}
          </h1>
          <p className="mt-2 text-text-secondary">{localize('com_ui_admin_privilege_required')}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-text-primary">{localize('com_ui_loading')}</div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-500">{localize('com_ui_error')}</h1>
          <p className="mt-2 text-text-secondary">{localize('com_ui_stats_load_error')}</p>
        </div>
      </div>
    );
  }

  const overviewCards = [
    {
      title: localize('com_ui_total_users'),
      value: stats.overview.totalUsers.toLocaleString(),
      icon: <Users className="h-8 w-8" />,
    },
    {
      title: localize('com_ui_new_users_7d'),
      value: stats.overview.newUsers.last7Days.toLocaleString(),
      icon: <UserPlus className="h-8 w-8" />,
      trend: 'up' as const,
      trendValue: `+${stats.overview.newUsers.last7Days}`,
    },
    {
      title: localize('com_ui_active_users_7d'),
      value: stats.overview.activeUsers.last7Days.toLocaleString(),
      subtitle: `${stats.overview.activeUsers.last30Days} ${localize('com_ui_in_last_30_days')}`,
      icon: <Activity className="h-8 w-8" />,
    },
    {
      title: localize('com_ui_active_users_30d'),
      value: stats.overview.activeUsers.last30Days.toLocaleString(),
      icon: <Activity className="h-8 w-8" />,
    },
    {
      title: localize('com_ui_messages_7d'),
      value: stats.overview.messages.last7Days.toLocaleString(),
      icon: <MessageSquare className="h-8 w-8" />,
    },
    {
      title: localize('com_ui_conversations_7d'),
      value: stats.overview.conversations.last7Days.toLocaleString(),
      icon: <MessageSquare className="h-8 w-8" />,
    },
    {
      title: localize('com_ui_active_rate_7d'),
      value: `${(stats.overview.activeRateLast7Days * 100).toFixed(1)}%`,
      icon: <Users className="h-8 w-8" />,
    },
    {
      title: localize('com_ui_error_rate_7d'),
      value: `${(stats.overview.errorRateLast7Days * 100).toFixed(1)}%`,
      icon: <AlertTriangle className="h-8 w-8" />,
    },
  ];

  return (
    <div className="min-h-screen bg-surface-primary-alt p-6">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-6 text-3xl font-bold text-text-primary">
          {localize('com_ui_admin_stats')}
        </h1>

        <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {overviewCards.map((card) => (
            <StatCard
              key={card.title}
              title={card.title}
              value={card.value}
              subtitle={card.subtitle}
              icon={card.icon}
              trend={card.trend}
              trendValue={card.trendValue}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <DailyRegistrationChart data={stats.registration.daily} />
          <ActivityTrendChart data={stats.usage.daily} />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ProviderPieChart data={stats.registration.byProvider} />
          <DistributionBarChart
            title={localize('com_ui_usage_by_endpoint')}
            data={stats.usage.byEndpoint}
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <DistributionBarChart
            title={localize('com_ui_usage_by_model')}
            data={stats.usage.byModel}
          />
          <QualityMetricsCard overview={stats.overview} quality={stats.quality} />
        </div>
      </div>
    </div>
  );
}

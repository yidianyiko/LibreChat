import {
  Activity,
  AlertTriangle,
  CreditCard,
  DollarSign,
  MessageSquare,
  UserPlus,
  Users,
} from 'lucide-react';
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

const formatCurrency = (amountInCents: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amountInCents / 100);

const formatRate = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);

const formatMultiplier = (value: number) => `${value.toFixed(1)}x`;

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
    {
      title: localize('com_ui_payments_7d'),
      value: stats.payments.payments.last7Days.toLocaleString(),
      subtitle: `${stats.payments.payments.last30Days} ${localize('com_ui_in_last_30_days')}`,
      icon: <CreditCard className="h-8 w-8" />,
    },
    {
      title: localize('com_ui_paying_users_30d'),
      value: stats.payments.payingUsers.last30Days.toLocaleString(),
      subtitle: `${stats.payments.payingUsers.last7Days} ${localize('com_ui_in_last_7_days')}`,
      icon: <Users className="h-8 w-8" />,
    },
    {
      title: localize('com_ui_revenue_30d'),
      value: formatCurrency(stats.payments.revenue.last30Days),
      subtitle: `${formatCurrency(stats.payments.revenue.last7Days)} ${localize('com_ui_in_last_7_days')}`,
      icon: <DollarSign className="h-8 w-8" />,
    },
    {
      title: localize('com_ui_credits_sold_30d'),
      value: stats.payments.creditsSold.last30Days.toLocaleString(),
      subtitle: `${stats.payments.creditsSold.last7Days.toLocaleString()} ${localize('com_ui_in_last_7_days')}`,
      icon: <CreditCard className="h-8 w-8" />,
    },
    {
      title: localize('com_ui_total_recharge_revenue'),
      value: formatCurrency(stats.financials.totalRechargeRevenue),
      icon: <DollarSign className="h-8 w-8" />,
    },
    {
      title: localize('com_ui_user_usage_charged'),
      value: formatCurrency(stats.financials.userUsageCharged),
      subtitle: `${stats.financials.totalUsageCredits.toLocaleString()} ${localize('com_ui_credits_used')}`,
      icon: <Activity className="h-8 w-8" />,
    },
    {
      title: localize('com_ui_unused_paid_balance'),
      value: formatCurrency(stats.financials.unusedPaidBalance),
      subtitle: `${stats.financials.totalCreditsSold.toLocaleString()} ${localize('com_ui_credits_sold')}`,
      icon: <CreditCard className="h-8 w-8" />,
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
            title={localize('com_ui_model_usage_frequency')}
            data={stats.usage.byModel}
          />
          <DistributionBarChart
            title={localize('com_ui_payments_by_tier')}
            data={stats.payments.byTier}
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <QualityMetricsCard overview={stats.overview} quality={stats.quality} />
        </div>

        <div className="mt-6 rounded-xl border border-border-light bg-surface-primary p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-text-primary">
            {localize('com_ui_admin_pricing_table')}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border-light text-left text-text-secondary">
                  <th className="pb-3 pr-4 font-medium">{localize('com_ui_model')}</th>
                  <th className="pb-3 pr-4 text-right font-medium">
                    {localize('com_ui_usage_count')}
                  </th>
                  <th className="pb-3 pr-4 text-right font-medium">
                    {localize('com_ui_cost_prompt_rate')}
                  </th>
                  <th className="pb-3 pr-4 text-right font-medium">
                    {localize('com_ui_user_prompt_rate')}
                  </th>
                  <th className="pb-3 pr-4 text-right font-medium">
                    {localize('com_ui_prompt_markup')}
                  </th>
                  <th className="pb-3 pr-4 text-right font-medium">
                    {localize('com_ui_cost_completion_rate')}
                  </th>
                  <th className="pb-3 pr-4 text-right font-medium">
                    {localize('com_ui_user_completion_rate')}
                  </th>
                  <th className="pb-3 text-right font-medium">
                    {localize('com_ui_completion_markup')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.pricing.modelRates.map((row) => (
                  <tr key={row.model} className="border-b border-border-light last:border-0">
                    <td className="py-3 pr-4 font-medium text-text-primary">{row.model}</td>
                    <td className="py-3 pr-4 text-right text-text-secondary">
                      {row.usageCount.toLocaleString()}
                    </td>
                    <td className="py-3 pr-4 text-right text-text-secondary">
                      {formatRate(row.cost.prompt)}
                    </td>
                    <td className="py-3 pr-4 text-right text-text-primary">
                      {formatRate(row.user.prompt)}
                    </td>
                    <td className="py-3 pr-4 text-right text-text-primary">
                      {formatMultiplier(row.markup.prompt)}
                    </td>
                    <td className="py-3 pr-4 text-right text-text-secondary">
                      {formatRate(row.cost.completion)}
                    </td>
                    <td className="py-3 pr-4 text-right text-text-primary">
                      {formatRate(row.user.completion)}
                    </td>
                    <td className="py-3 text-right text-text-primary">
                      {formatMultiplier(row.markup.completion)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

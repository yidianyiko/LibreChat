import { Users, UserPlus, Activity } from 'lucide-react';
import { useAuthContext } from '~/hooks/AuthContext';
import { SystemRoles } from 'librechat-data-provider';
import { useGetAdminStats } from '~/data-provider';
import { useLocalize } from '~/hooks';
import StatCard from './components/StatCard';
import DailyRegistrationChart from './components/DailyRegistrationChart';
import ProviderPieChart from './components/ProviderPieChart';

export default function StatsPage() {
  const localize = useLocalize();
  const { user } = useAuthContext();
  const { data: stats, isLoading, error } = useGetAdminStats({ days: 30 });

  // Admin role check
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

  return (
    <div className="min-h-screen bg-surface-primary-alt p-6">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-6 text-3xl font-bold text-text-primary">
          {localize('com_ui_admin_stats')}
        </h1>

        {/* Stats Cards Grid */}
        <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title={localize('com_ui_total_users')}
            value={stats.totalUsers.toLocaleString()}
            icon={<Users className="h-8 w-8" />}
          />
          <StatCard
            title={localize('com_ui_new_users_7d')}
            value={stats.recentNewUsers.toLocaleString()}
            icon={<UserPlus className="h-8 w-8" />}
            trend="up"
            trendValue={`+${stats.recentNewUsers}`}
          />
          <StatCard
            title={localize('com_ui_active_users_7d')}
            value={stats.activeUsers.last7Days.toLocaleString()}
            subtitle={`${stats.activeUsers.last30Days} ${localize('com_ui_in_last_30_days')}`}
            icon={<Activity className="h-8 w-8" />}
          />
          <StatCard
            title={localize('com_ui_active_users_30d')}
            value={stats.activeUsers.last30Days.toLocaleString()}
            icon={<Activity className="h-8 w-8" />}
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <DailyRegistrationChart data={stats.dailyRegistrations} />
          <ProviderPieChart data={stats.registrationByProvider} />
        </div>
      </div>
    </div>
  );
}

import { Users, UserPlus, Activity } from 'lucide-react';
import { useAuthContext } from '~/hooks/AuthContext';
import { SystemRoles } from 'librechat-data-provider';
import { useGetAdminStats } from '~/data-provider';
import StatCard from './components/StatCard';
import DailyRegistrationChart from './components/DailyRegistrationChart';
import ProviderPieChart from './components/ProviderPieChart';

export default function StatsPage() {
  const { user } = useAuthContext();
  const { data: stats, isLoading, error } = useGetAdminStats({ days: 30 });

  // Admin role check
  if (user?.role !== SystemRoles.ADMIN) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary">Access Denied</h1>
          <p className="mt-2 text-text-secondary">
            You need administrator privileges to view this page.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-text-primary">Loading statistics...</div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-500">Error</h1>
          <p className="mt-2 text-text-secondary">Failed to load statistics.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-primary-alt p-6">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-6 text-3xl font-bold text-text-primary">Admin Statistics</h1>

        {/* Stats Cards Grid */}
        <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Users"
            value={stats.totalUsers.toLocaleString()}
            icon={<Users className="h-8 w-8" />}
          />
          <StatCard
            title="New Users (7 days)"
            value={stats.recentNewUsers.toLocaleString()}
            icon={<UserPlus className="h-8 w-8" />}
            trend="up"
            trendValue={`+${stats.recentNewUsers}`}
          />
          <StatCard
            title="Active Users (7 days)"
            value={stats.activeUsers.last7Days.toLocaleString()}
            subtitle={`${stats.activeUsers.last30Days} in last 30 days`}
            icon={<Activity className="h-8 w-8" />}
          />
          <StatCard
            title="Active Users (30 days)"
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

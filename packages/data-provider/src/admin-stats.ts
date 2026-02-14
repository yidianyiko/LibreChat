import { useQuery, type UseQueryOptions } from '@tanstack/react-query';

export type AdminStats = {
  totalUsers: number;
  recentNewUsers: number;
  dailyRegistrations: Array<{
    date: string;
    count: number;
    [key: string]: number | string;
  }>;
  registrationByProvider: Record<string, number>;
  activeUsers: {
    last7Days: number;
    last30Days: number;
  };
};

export const useGetAdminStats = (
  params: { days?: number } = {},
  options?: Omit<UseQueryOptions<AdminStats>, 'queryKey' | 'queryFn'>,
) => {
  const days = params.days ?? 30;

  return useQuery<AdminStats>({
    queryKey: ['adminStats', days] as const,
    queryFn: async () => {
      const response = await fetch(`/api/admin/stats?days=${days}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch admin statistics');
      }

      return response.json();
    },
    ...options,
  });
};

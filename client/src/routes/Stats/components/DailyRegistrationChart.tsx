import type { TDailyRegistration } from 'librechat-data-provider';
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { useLocalize } from '~/hooks';

interface DailyRegistrationChartProps {
  data: TDailyRegistration[];
}

export default function DailyRegistrationChart({ data }: DailyRegistrationChartProps) {
  const localize = useLocalize();
  const providerSet = new Set<string>();
  const chartData = data.map((day) => {
    const row: Record<string, number | string> = {
      date: day.date,
      total: day.total,
    };

    for (const provider of day.providers) {
      providerSet.add(provider.key);
      row[provider.key] = provider.count;
    }

    return row;
  });
  const providers = Array.from(providerSet);

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

  return (
    <div className="rounded-xl border border-border-light bg-surface-primary p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-text-primary">
        {localize('com_ui_daily_registrations')}
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="date"
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af' }}
            tickFormatter={(value) => {
              const date = new Date(value);
              return `${date.getMonth() + 1}/${date.getDate()}`;
            }}
          />
          <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '0.5rem',
            }}
            labelStyle={{ color: '#f9fafb' }}
          />
          <Legend />
          {providers.length === 0 && (
            <Bar dataKey="total" fill={colors[0]} name={localize('com_ui_total_users')} />
          )}
          {providers.map((provider, index) => (
            <Bar
              key={provider}
              dataKey={provider}
              stackId="a"
              fill={colors[index % colors.length]}
              name={provider.charAt(0).toUpperCase() + provider.slice(1)}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

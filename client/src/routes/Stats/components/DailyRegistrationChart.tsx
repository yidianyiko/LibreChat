import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface DailyRegistration {
  date: string;
  count: number;
  googleCount?: number;
  localCount?: number;
  [key: string]: number | string | undefined;
}

interface DailyRegistrationChartProps {
  data: DailyRegistration[];
}

export default function DailyRegistrationChart({ data }: DailyRegistrationChartProps) {
  const providers = useMemo(() => {
    const providerSet = new Set<string>();
    data.forEach((day) => {
      Object.keys(day).forEach((key) => {
        if (key.endsWith('Count') && key !== 'count') {
          const provider = key.replace('Count', '');
          providerSet.add(provider);
        }
      });
    });
    return Array.from(providerSet);
  }, [data]);

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

  return (
    <div className="rounded-xl border border-border-light bg-surface-primary p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-text-primary">Daily Registrations</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
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
          {providers.map((provider, index) => (
            <Bar
              key={provider}
              dataKey={`${provider}Count`}
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

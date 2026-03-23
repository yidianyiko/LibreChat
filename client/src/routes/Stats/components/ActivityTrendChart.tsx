import type { TDailyUsage } from 'librechat-data-provider';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useLocalize } from '~/hooks';

interface ActivityTrendChartProps {
  data: TDailyUsage[];
}

export default function ActivityTrendChart({ data }: ActivityTrendChartProps) {
  const localize = useLocalize();

  return (
    <div className="rounded-xl border border-border-light bg-surface-primary p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-text-primary">
        {localize('com_ui_usage_trends')}
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
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
          <Line type="monotone" dataKey="activeUsers" stroke="#3b82f6" strokeWidth={2} />
          <Line type="monotone" dataKey="messages" stroke="#10b981" strokeWidth={2} />
          <Line type="monotone" dataKey="conversations" stroke="#f59e0b" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

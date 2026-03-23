import type { TAdminStatsOverview, TAdminStatsQuality } from 'librechat-data-provider';
import { useLocalize } from '~/hooks';

interface QualityMetricsCardProps {
  overview: TAdminStatsOverview;
  quality: TAdminStatsQuality;
}

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

export default function QualityMetricsCard({ overview, quality }: QualityMetricsCardProps) {
  const localize = useLocalize();

  return (
    <div className="rounded-xl border border-border-light bg-surface-primary p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-text-primary">
        {localize('com_ui_quality_overview')}
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border-medium p-4">
          <p className="text-sm text-text-secondary">{localize('com_ui_error_rate_7d')}</p>
          <p className="mt-2 text-2xl font-semibold text-text-primary">
            {formatPercent(overview.errorRateLast7Days)}
          </p>
          <p className="mt-1 text-xs text-text-tertiary">
            {quality.errorsLast7Days} {localize('com_ui_errors_7d')}
          </p>
        </div>
        <div className="rounded-lg border border-border-medium p-4">
          <p className="text-sm text-text-secondary">
            {localize('com_ui_negative_feedback_rate_7d')}
          </p>
          <p className="mt-2 text-2xl font-semibold text-text-primary">
            {formatPercent(overview.negativeFeedbackRateLast7Days)}
          </p>
          <p className="mt-1 text-xs text-text-tertiary">
            {quality.feedbackCountLast7Days} {localize('com_ui_feedback_count_7d')}
          </p>
        </div>
        <div className="rounded-lg border border-border-medium p-4">
          <p className="text-sm text-text-secondary">
            {localize('com_ui_messages_per_active_user_7d')}
          </p>
          <p className="mt-2 text-2xl font-semibold text-text-primary">
            {overview.messagesPerActiveUserLast7Days.toFixed(1)}
          </p>
        </div>
        <div className="rounded-lg border border-border-medium p-4">
          <p className="text-sm text-text-secondary">{localize('com_ui_active_rate_7d')}</p>
          <p className="mt-2 text-2xl font-semibold text-text-primary">
            {formatPercent(overview.activeRateLast7Days)}
          </p>
        </div>
      </div>
    </div>
  );
}

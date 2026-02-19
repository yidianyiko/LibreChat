import React from 'react';
import { useLocalize } from '~/hooks';
import { PricingCard } from './PricingCard';
import type { PricingTier } from '~/types/recharge';

interface TopupTabProps {
  tiers: PricingTier[];
  hasActiveSubscription: boolean;
  onTopup: (tierId: string) => Promise<void>;
  isLoading: boolean;
  onSwitchToSubscription?: () => void;
}

export const TopupTab: React.FC<TopupTabProps> = ({
  tiers,
  hasActiveSubscription,
  onTopup,
  isLoading,
  onSwitchToSubscription,
}) => {
  const localize = useLocalize();

  return (
    <div className="space-y-6">
      {/* Locked Banner - Only shown when no active subscription */}
      {!hasActiveSubscription && (
        <div
          data-testid="topup-locked-banner"
          className="rounded-lg border border-amber-300 bg-amber-50 p-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">
                {localize('com_recharge_topup_subscribers_only')}
              </p>
            </div>
            {onSwitchToSubscription && (
              <button
                onClick={onSwitchToSubscription}
                className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
              >
                {localize('com_recharge_subscribe_first')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3">
        {tiers.map((tier, index) => (
          <PricingCard
            key={tier.id}
            tier={tier}
            mode="topup"
            onSelect={onTopup}
            isLoading={isLoading}
            isDisabled={!hasActiveSubscription}
            recommended={index === 1} // Middle card (artisan) is recommended
          />
        ))}
      </div>
    </div>
  );
};

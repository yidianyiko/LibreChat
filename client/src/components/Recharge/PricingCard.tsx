import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useLocalize } from '~/hooks';
import type { PricingTier } from '~/types/recharge';

const getTierFeatureKeys = (tierId: string): string[] => {
  const keyBase = `com_recharge_tier_${tierId}_f`;
  const counts = { explorer: 4, artisan: 5, elite: 5 };
  const count = counts[tierId as keyof typeof counts] || 0;
  return Array.from({ length: count }, (_, i) => `${keyBase}${i + 1}`);
};

interface PricingCardProps {
  tier: PricingTier;
  onSelect: (tierId: string) => void;
  isLoading?: boolean;
  recommended?: boolean;
  /** Controls price label suffix and CTA text */
  mode?: 'subscription' | 'topup';
  /** Highlights card as the user's current plan */
  isCurrentPlan?: boolean;
  /** For subscription mode: determines CTA label */
  subscriptionAction?: 'subscribe' | 'upgrade' | 'downgrade';
  /** Greys out card and disables button */
  isDisabled?: boolean;
}

export const PricingCard: React.FC<PricingCardProps> = ({
  tier,
  onSelect,
  isLoading = false,
  recommended = false,
  mode = 'topup',
  isCurrentPlan = false,
  subscriptionAction = 'subscribe',
  isDisabled = false,
}) => {
  const localize = useLocalize();
  const formattedPrice = (tier.price / 100).toFixed(2);
  const subKey = `com_recharge_tier_${tier.id}_sub` as const;
  const subtitle = localize(subKey);
  const featureKeys = getTierFeatureKeys(tier.id);
  const features = featureKeys.map((key) => localize(key));
  const planName = localize('com_recharge_pack', { 0: tier.name.toUpperCase() });

  const priceSuffix =
    mode === 'subscription'
      ? localize('com_recharge_per_month')
      : localize('com_recharge_one_time');

  let ctaText: string;
  if (isLoading) {
    ctaText = localize('com_recharge_processing');
  } else if (isCurrentPlan) {
    ctaText = localize('com_recharge_current_plan');
  } else if (mode === 'subscription') {
    if (subscriptionAction === 'upgrade') ctaText = localize('com_recharge_upgrade');
    else if (subscriptionAction === 'downgrade') ctaText = localize('com_recharge_downgrade');
    else ctaText = localize('com_recharge_subscribe_tier');
  } else {
    ctaText = localize('com_recharge_buy_tier', { 0: tier.name.toUpperCase() });
  }

  const isButtonDisabled = isLoading || isCurrentPlan || isDisabled;

  const isHighlighted = isCurrentPlan || (recommended && !isDisabled);

  return (
    <div
      data-testid="pricing-card"
      className={`flex flex-col rounded-[2rem] border p-5 shadow-sm transition-all duration-500 sm:rounded-[3rem] sm:p-6 md:p-8 lg:p-10 ${
        isCurrentPlan
          ? 'z-10 border-[#10a37f] bg-[#10a37f] text-white shadow-2xl lg:scale-105'
          : recommended && !isDisabled
            ? 'z-10 border-black bg-black text-white shadow-2xl lg:scale-105'
            : 'border-gray-100 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white'
      } ${isDisabled ? 'opacity-50' : ''}`}
    >
      <div className="mb-6 text-left sm:mb-8 md:mb-10">
        <div className="mb-4 flex items-center space-x-2">
          <span
            className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
              isCurrentPlan
                ? 'bg-white/20 text-white'
                : recommended && !isDisabled
                  ? 'bg-[#10a37f] text-white'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            {planName}
          </span>
          {isCurrentPlan && (
            <span className="text-[9px] font-black uppercase tracking-widest text-white/80">
              {localize('com_recharge_current_plan')}
            </span>
          )}
          {!isCurrentPlan && recommended && !isDisabled && (
            <span className="text-[9px] font-black uppercase tracking-widest text-[#10a37f]">
              {localize('com_recharge_most_popular')}
            </span>
          )}
        </div>
        <div className="mt-6 flex items-baseline">
          <span className="text-3xl font-black tracking-tight sm:text-4xl md:text-5xl">
            ${formattedPrice}
          </span>
          <span className="ml-2 text-sm font-medium opacity-50">{priceSuffix}</span>
        </div>
        <p className="mt-4 text-xs font-bold text-gray-400">{subtitle}</p>
      </div>
      <button
        type="button"
        onClick={() => !isButtonDisabled && onSelect(tier.id)}
        disabled={isButtonDisabled}
        className={`mb-6 w-full rounded-2xl py-3 text-sm font-bold uppercase tracking-widest transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:mb-8 sm:py-4 md:mb-10 ${
          isCurrentPlan
            ? 'cursor-default bg-white/20 text-white'
            : recommended && !isDisabled
              ? 'bg-[#10a37f] text-white hover:bg-[#0d8a6a]'
              : 'bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200'
        }`}
      >
        {ctaText}
      </button>
      <ul className="flex-grow space-y-5 text-left">
        {features.map((f, i) => (
          <li key={i} className="flex items-start space-x-3 text-sm font-medium">
            <CheckCircle2
              size={18}
              className={`flex-shrink-0 ${isHighlighted ? 'text-white/70' : 'text-[#10a37f]'}`}
            />
            <span className={isHighlighted ? 'text-gray-300' : 'text-gray-700 dark:text-gray-300'}>
              {f}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

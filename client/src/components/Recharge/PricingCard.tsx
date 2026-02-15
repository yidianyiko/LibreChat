import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useLocalize } from '~/hooks';
import type { PricingTier } from '~/types/recharge';

/** Tier-specific feature key prefixes. */
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
}

export const PricingCard: React.FC<PricingCardProps> = ({
  tier,
  onSelect,
  isLoading = false,
  recommended = false,
}) => {
  const localize = useLocalize();
  const formattedPrice = (tier.price / 100).toFixed(2);
  const subKey = `com_recharge_tier_${tier.id}_sub` as const;
  const subtitle = localize(subKey);
  const featureKeys = getTierFeatureKeys(tier.id);
  const features = featureKeys.map((key) => localize(key));
  const planName = localize('com_recharge_pack', { 0: tier.name.toUpperCase() });
  const ctaText = localize('com_recharge_buy_tier', { 0: tier.name.toUpperCase() });

  return (
    <div
      data-testid="pricing-card"
      className={`flex flex-col rounded-[2rem] border p-5 shadow-sm transition-all duration-500 sm:rounded-[3rem] sm:p-6 md:p-8 lg:p-10 ${
        recommended
          ? 'z-10 border-black bg-black text-white shadow-2xl lg:scale-105'
          : 'border-gray-100 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white'
      }`}
    >
      <div className="mb-6 text-left sm:mb-8 md:mb-10">
        <div className="mb-4 flex items-center space-x-2">
          <span
            className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
              recommended
                ? 'bg-[#10a37f] text-white'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            {planName}
          </span>
          {recommended && (
            <span className="text-[9px] font-black uppercase tracking-widest text-[#10a37f]">
              {localize('com_recharge_most_popular')}
            </span>
          )}
        </div>
        <div className="mt-6 flex items-baseline">
          <span className="text-3xl font-black tracking-tight sm:text-4xl md:text-5xl">
            ${formattedPrice}
          </span>
          <span className="ml-2 text-sm font-medium opacity-50">{localize('com_recharge_one_time')}</span>
        </div>
        <p className="mt-4 text-xs font-bold text-gray-400">{subtitle}</p>
      </div>
      <button
        type="button"
        onClick={() => onSelect(tier.id)}
        disabled={isLoading}
        className={`mb-6 w-full rounded-2xl py-3 text-sm font-bold uppercase tracking-widest transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:mb-8 sm:py-4 md:mb-10 ${
          recommended
            ? 'bg-[#10a37f] text-white hover:bg-[#0d8a6a]'
            : 'bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200'
        }`}
      >
        {isLoading ? localize('com_recharge_processing') : ctaText}
      </button>
      <ul className="flex-grow space-y-5 text-left">
        {features.map((f, i) => (
          <li key={i} className="flex items-start space-x-3 text-sm font-medium">
            <CheckCircle2 size={18} className="flex-shrink-0 text-[#10a37f]" />
            <span className={recommended ? 'text-gray-300' : 'text-gray-700 dark:text-gray-300'}>
              {f}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

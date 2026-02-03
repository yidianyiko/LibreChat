import React from 'react';
import type { PricingTier } from '~/types/recharge';

interface PricingCardProps {
  tier: PricingTier;
  onSelect: (tierId: string) => void;
  isLoading?: boolean;
}

export const PricingCard: React.FC<PricingCardProps> = ({
  tier,
  onSelect,
  isLoading = false,
}) => {
  const formattedPrice = (tier.price / 100).toFixed(2);
  const formattedCredits = (tier.credits / 1000000).toFixed(1);

  return (
    <div
      data-testid="pricing-card"
      className="relative flex flex-col rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
    >
      {tier.discount > 0 && (
        <div className="absolute -top-3 right-4 rounded-full bg-green-500 px-3 py-1 text-xs font-semibold text-white">
          {tier.discount}% OFF
        </div>
      )}

      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {tier.name}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tier.description}
        </p>
      </div>

      <div className="mb-4">
        <span className="text-3xl font-bold text-gray-900 dark:text-white">
          ${formattedPrice}
        </span>
      </div>

      <div className="mb-6 text-sm text-gray-600 dark:text-gray-300">
        <div className="flex items-center justify-between">
          <span>Credits:</span>
          <span className="font-semibold">{formattedCredits}M</span>
        </div>
      </div>

      <button
        onClick={() => onSelect(tier.id)}
        disabled={isLoading}
        className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
      >
        {isLoading ? 'Processing...' : 'Purchase'}
      </button>
    </div>
  );
};

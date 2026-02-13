import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { PricingTier } from '~/types/recharge';

/** Subtitle and feature list per tier, matching LandingPage pricing copy. */
const TIER_DISPLAY: Record<
  string,
  { sub: string; features: string[] }
> = {
  explorer: {
    sub: 'The Minimalist Alternative',
    features: [
      '150 Premium GPT-4o msgs',
      '2,000 Base 4o-mini msgs',
      'Locked Model Guarantee',
      '8,192 Token Context',
    ],
  },
  artisan: {
    sub: "The Creator's Safe Haven",
    features: [
      '700 Premium GPT-4o msgs',
      '15,000 Base 4o-mini msgs',
      'Snapshot Selection',
      '32,768 Token Context',
      '10 Project Folders',
    ],
  },
  elite: {
    sub: 'The Power Productivity Hub',
    features: [
      '2,000 Premium GPT-4o msgs',
      'Unlimited Base 4o-mini msgs',
      'Full 128,000 Context Access',
      'Tier-5 Priority Lane',
      'Unlimited Project Folders',
    ],
  },
};

const DEFAULT_DISPLAY = { sub: '', features: [] as string[] };

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
  const formattedPrice = (tier.price / 100).toFixed(2);
  const { sub, features } = TIER_DISPLAY[tier.id] ?? DEFAULT_DISPLAY;
  const planName = tier.name.toUpperCase() + ' PACK';
  const ctaText = 'BUY ' + tier.name.toUpperCase();

  return (
    <div
      data-testid="pricing-card"
      className={`p-5 sm:p-6 md:p-8 lg:p-10 rounded-[2rem] sm:rounded-[3rem] border transition-all duration-500 flex flex-col shadow-sm ${
        recommended
          ? 'bg-black text-white border-black shadow-2xl lg:scale-105 z-10'
          : 'bg-white border-gray-100 text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-white'
      }`}
    >
      <div className="mb-6 sm:mb-8 md:mb-10 text-left">
        <div className="flex items-center space-x-2 mb-4">
          <span
            className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
              recommended ? 'bg-[#10a37f] text-white' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            {planName}
          </span>
          {recommended && (
            <span className="text-[9px] font-black uppercase tracking-widest text-[#10a37f]">
              MOST POPULAR
            </span>
          )}
        </div>
        <div className="mt-6 flex items-baseline">
          <span className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight">${formattedPrice}</span>
          <span className="text-sm ml-2 font-medium opacity-50">one-time</span>
        </div>
        <p className="text-xs mt-4 font-bold text-gray-400">{sub}</p>
      </div>
      <button
        type="button"
        onClick={() => onSelect(tier.id)}
        disabled={isLoading}
        className={`w-full py-3 sm:py-4 mb-6 sm:mb-8 md:mb-10 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
          recommended
            ? 'bg-[#10a37f] text-white hover:bg-[#0d8a6a]'
            : 'bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200'
        }`}
      >
        {isLoading ? 'Processing...' : ctaText}
      </button>
      <ul className="space-y-5 flex-grow text-left">
        {features.map((f, i) => (
          <li key={i} className="flex items-start space-x-3 text-sm font-medium">
            <CheckCircle2 size={18} className="text-[#10a37f] flex-shrink-0" />
            <span className={recommended ? 'text-gray-300' : 'text-gray-700 dark:text-gray-300'}>
              {f}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

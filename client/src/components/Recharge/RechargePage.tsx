import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToastContext } from '@librechat/client';
import { PricingCard } from './PricingCard';
import {
  usePricingQuery,
  useCreateCheckoutSession,
} from '~/hooks/Recharge/useRechargeQueries';
import type { PricingResponse } from '~/types/recharge';

/** Mock data for UI preview when Stripe is not configured. Matches backend PRICING_TIERS. */
const MOCK_PRICING_RESPONSE: PricingResponse = {
  enabled: true,
  tiers: [
    {
      id: 'explorer',
      name: 'Explorer',
      description:
        'The Minimalist Alternative - 150 Premium GPT-4o msgs, 2,000 Base 4o-mini msgs',
      price: 499,
      credits: 5000000,
      discount: 0,
    },
    {
      id: 'artisan',
      name: 'Artisan',
      description:
        "The Creator's Safe Haven - 700 Premium GPT-4o msgs, 15,000 Base 4o-mini msgs",
      price: 1499,
      credits: 15000000,
      discount: 0,
    },
    {
      id: 'elite',
      name: 'Elite',
      description:
        'The Power Productivity Hub - 2,000 Premium GPT-4o msgs, Unlimited Base 4o-mini msgs',
      price: 3499,
      credits: 35000000,
      discount: 0,
    },
  ],
};

/** True when the API reported recharge disabled (503 or enabled: false). */
function isRechargeDisabled(
  error: unknown,
  data: { enabled?: boolean } | undefined,
): boolean {
  if (data && data.enabled === false) {
    return true;
  }
  const err = error as { response?: { status?: number; data?: { enabled?: boolean } } };
  return (
    err?.response?.status === 503 ||
    err?.response?.data?.enabled === false
  );
}

const isDev = import.meta.env.DEV;

export const RechargePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const uiPreviewParam = searchParams.get('ui_preview') === '1';
  const { showToast } = useToastContext();
  const { data, isLoading, error } = usePricingQuery();
  const createCheckoutMutation = useCreateCheckoutSession();

  const useMockForDisplay =
    (!!error || !data?.enabled) && (uiPreviewParam || isDev);

  const handleSelectTier = async (tierId: string) => {
    if (useMockForDisplay) {
      showToast({
        message: 'Preview mode — payment is not available.',
        status: 'info',
      });
      return;
    }
    try {
      const result = await createCheckoutMutation.mutateAsync({ tierId });

      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : 'Failed to start payment',
        status: 'error',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg text-gray-600 dark:text-gray-300">
          Loading pricing...
        </div>
      </div>
    );
  }

  if (error || !data?.enabled) {
    if (!useMockForDisplay) {
      const disabled = isRechargeDisabled(error, data);
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-2 px-4">
          <div
            className={
              disabled
                ? 'text-lg font-semibold text-amber-600 dark:text-amber-400'
                : 'text-lg font-semibold text-red-600 dark:text-red-400'
            }
          >
            {disabled
              ? 'Recharge is not available at the moment'
              : 'We couldn\'t load the recharge options'}
          </div>
          <p className="max-w-md text-center text-sm text-gray-600 dark:text-gray-400">
            {disabled
              ? 'The payment system has not been enabled. Please contact the administrator or try again later.'
              : 'Please check your connection and try again.'}
          </p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 text-blue-600 hover:underline dark:text-blue-400"
          >
            Return to Home
          </button>
        </div>
      );
    }
    // ui_preview=1 or dev: render main UI with mock data below
  }

  const displayData = data?.enabled ? data : MOCK_PRICING_RESPONSE;

  return (
    <div className="bg-[#fcfcf9] dark:bg-gray-900 py-24 md:py-32 px-6 md:px-10">
      <div className="max-w-6xl mx-auto">
        {useMockForDisplay && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
            UI Preview — payment is disabled.
          </div>
        )}
        <div className="mb-16 md:mb-24 text-center">
          <h1
            className="text-4xl md:text-6xl font-black mb-6 text-gray-900 dark:text-white"
            style={{ letterSpacing: '-0.04em' }}
          >
            Recharge Your Token Credits
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
            Choose a package to add token credits to your account
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left items-stretch">
          {displayData.tiers.map((tier) => (
            <PricingCard
              key={tier.id}
              tier={tier}
              onSelect={handleSelectTier}
              isLoading={useMockForDisplay ? false : createCheckoutMutation.isLoading}
              recommended={tier.id === 'artisan'}
            />
          ))}
        </div>

        <div className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Payments are securely processed by Stripe</p>
          <p className="mt-2">1,000,000 token credits = $1.00 USD • Token credits never expire</p>
        </div>
      </div>
    </div>
  );
};

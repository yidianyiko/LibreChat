import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useToastContext } from '@librechat/client';
import { PricingCard } from './PricingCard';
import {
  usePricingQuery,
  useCreateCheckoutSession,
} from '~/hooks/Recharge/useRechargeQueries';

export const RechargePage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToastContext();
  const { data, isLoading, error } = usePricingQuery();
  const createCheckoutMutation = useCreateCheckoutSession();

  const handleSelectTier = async (tierId: string) => {
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
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <div className="text-lg font-semibold text-red-600">
          Payment system is currently unavailable
        </div>
        <button
          onClick={() => navigate('/')}
          className="mt-4 text-blue-600 hover:underline"
        >
          Return to Home
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Recharge Your Credits
        </h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
          Choose a package to add credits to your account
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {data.tiers.map((tier) => (
          <PricingCard
            key={tier.id}
            tier={tier}
            onSelect={handleSelectTier}
            isLoading={createCheckoutMutation.isLoading}
          />
        ))}
      </div>

      <div className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>Payments are securely processed by Stripe</p>
        <p className="mt-2">1,000,000 credits = $1.00 USD • Credits never expire</p>
      </div>
    </div>
  );
};

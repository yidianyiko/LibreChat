import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToastContext } from '@librechat/client';
import { useLocalize } from '~/hooks';
import { SubscriptionTab } from './SubscriptionTab';
import { TopupTab } from './TopupTab';
import {
  usePricingQuery,
  useCreateSubscription,
  useCreateTopup,
} from '~/hooks/Recharge/useRechargeQueries';
import { useGetSubscriptionStatus } from '~/hooks/Subscriptions';
import type { PricingResponse } from '~/types/recharge';

/** Mock data for UI preview when Stripe is not configured. Matches backend PRICING_TIERS. */
const MOCK_PRICING_RESPONSE: PricingResponse = {
  enabled: true,
  tiers: [
    {
      id: 'explorer',
      name: 'Explorer',
      description: 'The Minimalist Alternative - 150 Premium GPT-4o msgs, 2,000 Base 4o-mini msgs',
      price: 499,
      credits: 5000000,
      discount: 0,
    },
    {
      id: 'artisan',
      name: 'Artisan',
      description: "The Creator's Safe Haven - 700 Premium GPT-4o msgs, 15,000 Base 4o-mini msgs",
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
function isRechargeDisabled(error: unknown, data: { enabled?: boolean } | undefined): boolean {
  if (data && data.enabled === false) {
    return true;
  }
  const err = error as { response?: { status?: number; data?: { enabled?: boolean } } };
  return err?.response?.status === 503 || err?.response?.data?.enabled === false;
}

const isDev = import.meta.env.DEV;

type TabType = 'subscription' | 'topup';

export const RechargePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const uiPreviewParam = searchParams.get('ui_preview') === '1';
  const { showToast } = useToastContext();
  const localize = useLocalize();
  const { data, isLoading, error } = usePricingQuery();
  const createSubscriptionMutation = useCreateSubscription();
  const createTopupMutation = useCreateTopup();
  const { data: subscriptionStatus } = useGetSubscriptionStatus();
  const [activeTab, setActiveTab] = useState<TabType>('subscription');

  const useMockForDisplay = (!!error || !data?.enabled) && (uiPreviewParam || isDev);
  const hasActiveSubscription = subscriptionStatus?.subscriptionStatus === 'active';

  const handleSubscribe = async (tierId: string) => {
    if (useMockForDisplay) {
      showToast({
        message: localize('com_recharge_preview_mode'),
        status: 'info',
      });
      return;
    }
    try {
      const result = await createSubscriptionMutation.mutateAsync({ tierId });

      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : localize('com_recharge_error_payment'),
        status: 'error',
      });
    }
  };

  const handleTopup = async (tierId: string) => {
    if (useMockForDisplay) {
      showToast({
        message: localize('com_recharge_preview_mode'),
        status: 'info',
      });
      return;
    }
    try {
      const result = await createTopupMutation.mutateAsync({ tierId });

      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : localize('com_recharge_error_payment'),
        status: 'error',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-lg text-gray-600 dark:text-gray-300">
          {localize('com_recharge_loading')}
        </div>
      </div>
    );
  }

  if (error || !data?.enabled) {
    if (!useMockForDisplay) {
      const disabled = isRechargeDisabled(error, data);
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-4">
          <div
            className={
              disabled
                ? 'text-lg font-semibold text-amber-600 dark:text-amber-400'
                : 'text-lg font-semibold text-red-600 dark:text-red-400'
            }
          >
            {disabled
              ? localize('com_recharge_not_available')
              : localize('com_recharge_error_load')}
          </div>
          <p className="max-w-md text-center text-sm text-gray-600 dark:text-gray-400">
            {disabled
              ? localize('com_recharge_not_available_desc')
              : localize('com_recharge_error_retry')}
          </p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 text-blue-600 hover:underline dark:text-blue-400"
          >
            {localize('com_recharge_return_home')}
          </button>
        </div>
      );
    }
    // ui_preview=1 or dev: render main UI with mock data below
  }

  const displayData = data?.enabled ? data : MOCK_PRICING_RESPONSE;

  return (
    <div className="h-full overflow-y-auto">
      <div className="bg-[#fcfcf9] px-4 py-12 dark:bg-gray-900 sm:px-6 sm:py-16 md:px-10 md:py-24 lg:py-32">
        <div className="mx-auto max-w-6xl">
          {useMockForDisplay && (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
              {localize('com_recharge_preview_disabled')}
            </div>
          )}

          <div className="mb-8 text-center sm:mb-12 md:mb-16 lg:mb-24">
            <h1
              className="mb-4 text-2xl font-black text-gray-900 dark:text-white sm:mb-6 sm:text-3xl md:text-4xl lg:text-6xl"
              style={{ letterSpacing: '-0.04em' }}
            >
              {localize('com_recharge_title')}
            </h1>
            <p className="text-base font-medium text-gray-500 dark:text-gray-400 sm:text-lg">
              {localize('com_recharge_choose_package')}
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="mb-8 flex justify-center">
            <div className="inline-flex rounded-xl border border-gray-300 bg-white p-1 dark:border-gray-600 dark:bg-gray-800">
              <button
                type="button"
                onClick={() => setActiveTab('subscription')}
                className={`rounded-xl px-6 py-2 text-sm font-semibold transition-all ${
                  activeTab === 'subscription'
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                {localize('com_recharge_subscription')}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('topup')}
                className={`rounded-xl px-6 py-2 text-sm font-semibold transition-all ${
                  activeTab === 'topup'
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                {localize('com_recharge_topup')}
              </button>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'subscription' ? (
            <div data-testid="subscription-tab-panel">
              <SubscriptionTab
                tiers={displayData.tiers}
                subscriptionStatus={subscriptionStatus}
                onSubscribe={handleSubscribe}
                isLoading={useMockForDisplay ? false : createSubscriptionMutation.isPending}
              />
            </div>
          ) : (
            <div data-testid="topup-tab-panel">
              <TopupTab
                tiers={displayData.tiers}
                hasActiveSubscription={hasActiveSubscription}
                onTopup={handleTopup}
                isLoading={useMockForDisplay ? false : createTopupMutation.isPending}
                onSwitchToSubscription={() => setActiveTab('subscription')}
              />
            </div>
          )}

          <div className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400">
            <p>{localize('com_recharge_secured_by_stripe')}</p>
            <p className="mt-2">{localize('com_recharge_credits_conversion')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

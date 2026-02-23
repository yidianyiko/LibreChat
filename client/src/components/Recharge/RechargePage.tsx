import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

type TabType = 'subscription' | 'topup';

export const RechargePage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToastContext();
  const localize = useLocalize();
  const { data, isLoading, error } = usePricingQuery();
  const createSubscriptionMutation = useCreateSubscription();
  const createTopupMutation = useCreateTopup();
  const { data: subscriptionStatus } = useGetSubscriptionStatus();
  const [activeTab, setActiveTab] = useState<TabType>('subscription');

  const hasActiveSubscription = subscriptionStatus?.subscriptionStatus === 'active';

  const handleSubscribe = async (tierId: string) => {
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
    const isDisabled =
      (data && data.enabled === false) ||
      (error as { response?: { status?: number } })?.response?.status === 503;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-4">
        <div
          className={
            isDisabled
              ? 'text-lg font-semibold text-amber-600 dark:text-amber-400'
              : 'text-lg font-semibold text-red-600 dark:text-red-400'
          }
        >
          {isDisabled
            ? localize('com_recharge_not_available')
            : localize('com_recharge_error_load')}
        </div>
        <p className="max-w-md text-center text-sm text-gray-600 dark:text-gray-400">
          {isDisabled
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

  const displayData = data;

  return (
    <div className="h-full overflow-y-auto">
      <div className="bg-[#fcfcf9] px-4 py-12 dark:bg-gray-900 sm:px-6 sm:py-16 md:px-10 md:py-24 lg:py-32">
        <div className="mx-auto max-w-6xl">
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
                {localize('com_recharge_tab_subscription')}
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
                {localize('com_recharge_tab_topup')}
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
                isLoading={createSubscriptionMutation.isPending}
              />
            </div>
          ) : (
            <div data-testid="topup-tab-panel">
              <TopupTab
                tiers={displayData.tiers}
                hasActiveSubscription={hasActiveSubscription}
                onTopup={handleTopup}
                isLoading={createTopupMutation.isPending}
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

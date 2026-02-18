import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { QueryKeys } from 'librechat-data-provider';
import { useLocalize } from '~/hooks';
import { useVerifySessionQuery } from '~/hooks/Recharge/useRechargeQueries';
import { useGetSubscriptionStatus } from '~/hooks/Subscriptions';

export const PaymentSuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const localize = useLocalize();
  const sessionId = searchParams.get('session_id');
  const paymentType = (searchParams.get('type') ?? 'topup') as 'subscription' | 'topup';
  const isSubscription = paymentType === 'subscription';

  // For topup: verify session; For subscription: skip verification (webhook handles it)
  const { data: verifyData, isLoading: isVerifying, error: verifyError } = useVerifySessionQuery(
    isSubscription ? null : sessionId,
  );

  // Get subscription status for both types
  const { data: subscriptionData } = useGetSubscriptionStatus();

  useEffect(() => {
    if (isSubscription) {
      // Subscription: invalidate both queries
      queryClient.invalidateQueries({ queryKey: ['subscriptionStatus'] });
      queryClient.invalidateQueries({ queryKey: [QueryKeys.balance] });
    } else if (verifyData?.isPaid) {
      // Topup: invalidate balance only
      queryClient.invalidateQueries({ queryKey: [QueryKeys.balance] });
    }
  }, [isSubscription, verifyData, queryClient]);

  // Loading state (only for topup)
  if (!isSubscription && isVerifying) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-4xl">⏳</div>
          <div className="text-lg text-gray-600 dark:text-gray-300">{localize('com_recharge_verifying')}</div>
        </div>
      </div>
    );
  }

  // Error state (only for topup)
  if (!isSubscription && (verifyError || !verifyData?.isPaid)) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-5xl sm:text-6xl">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {localize('com_recharge_payment_failed_title')}
          </h1>
          <p className="mt-4 text-gray-600 dark:text-gray-300">
            {localize('com_recharge_payment_failed_desc')}
          </p>
          <button
            onClick={() => navigate('/recharge')}
            className="mt-6 rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
          >
            {localize('com_recharge_try_again')}
          </button>
        </div>
      </div>
    );
  }

  // Success state: render based on payment type
  const renderSuccessContent = () => {
    if (isSubscription) {
      const tier = subscriptionData?.subscriptionTier ?? '';
      const balance = subscriptionData?.subscriptionBalance ?? 0;
      const formattedBalance = (balance / 1000000).toFixed(1);

      return (
        <>
          <h1 className="text-2xl font-bold text-green-600 dark:text-green-400 sm:text-3xl">
            {localize('com_recharge_subscription_success_title')}
          </h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
            {localize('com_recharge_subscription_success_desc')}
          </p>

          <div className="mt-6 rounded-lg bg-gray-100 p-4 dark:bg-gray-800 sm:mt-8 sm:p-6">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {localize('com_recharge_subscription_tier')}
            </div>
            <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
              {tier.toUpperCase()}
            </div>
            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              {localize('com_recharge_subscription_balance')}
            </div>
            <div className="mt-2 text-xl font-bold text-gray-900 dark:text-white">
              {localize('com_recharge_credits_amount', { 0: formattedBalance })}
            </div>
          </div>
        </>
      );
    } else {
      const formattedCredits = (verifyData!.credits / 1000000).toFixed(1);
      const formattedAmount = (verifyData!.amountTotal / 100).toFixed(2);

      return (
        <>
          <h1 className="text-2xl font-bold text-green-600 dark:text-green-400 sm:text-3xl">
            {localize('com_recharge_topup_success_title')}
          </h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
            {localize('com_recharge_topup_success_desc')}
          </p>

          <div className="mt-6 rounded-lg bg-gray-100 p-4 dark:bg-gray-800 sm:mt-8 sm:p-6">
            <div className="text-sm text-gray-500 dark:text-gray-400">{localize('com_recharge_credits_added')}</div>
            <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
              {localize('com_recharge_credits_amount', { 0: formattedCredits })}
            </div>
            <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {localize('com_recharge_amount_paid', { 0: formattedAmount })}
            </div>
          </div>
        </>
      );
    }
  };

  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-md px-4 text-center sm:px-6">
        <div className="mb-4 text-5xl sm:mb-6 sm:text-6xl">✅</div>

        {renderSuccessContent()}

        <button
          onClick={() => navigate('/')}
          className="mt-6 w-full rounded-lg bg-green-600 px-6 py-3 text-white hover:bg-green-700 sm:mt-8"
        >
          {localize('com_recharge_start_chatting')}
        </button>

        <button
          onClick={() => navigate('/recharge')}
          className="mt-3 w-full rounded-lg border border-gray-300 px-6 py-3 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          {localize('com_recharge_manage_subscription')}
        </button>
      </div>
    </div>
  );
};

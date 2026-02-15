import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { QueryKeys } from 'librechat-data-provider';
import { useLocalize } from '~/hooks';
import { useVerifySessionQuery } from '~/hooks/Recharge/useRechargeQueries';

export const PaymentSuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const localize = useLocalize();
  const sessionId = searchParams.get('session_id');

  const { data, isLoading, error } = useVerifySessionQuery(sessionId);

  useEffect(() => {
    if (data?.isPaid) {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.balance] });
    }
  }, [data, queryClient]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-4xl">⏳</div>
          <div className="text-lg text-gray-600 dark:text-gray-300">{localize('com_recharge_verifying')}</div>
        </div>
      </div>
    );
  }

  if (error || !data?.isPaid) {
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

  const formattedCredits = (data.credits / 1000000).toFixed(1);
  const formattedAmount = (data.amountTotal / 100).toFixed(2);

  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-md px-4 text-center sm:px-6">
        <div className="mb-4 text-5xl sm:mb-6 sm:text-6xl">✅</div>
        <h1 className="text-2xl font-bold text-green-600 dark:text-green-400 sm:text-3xl">
          {localize('com_recharge_payment_success')}
        </h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
          {localize('com_recharge_credits_added_desc')}
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

        <button
          onClick={() => navigate('/')}
          className="mt-6 w-full rounded-lg bg-green-600 px-6 py-3 text-white hover:bg-green-700 sm:mt-8"
        >
          {localize('com_recharge_start_chatting')}
        </button>

        <button
          onClick={() => navigate('/recharge/history')}
          className="mt-3 w-full rounded-lg border border-gray-300 px-6 py-3 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          {localize('com_recharge_view_history')}
        </button>
      </div>
    </div>
  );
};

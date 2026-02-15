import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocalize } from '~/hooks';

export const PaymentCancelPage: React.FC = () => {
  const navigate = useNavigate();
  const localize = useLocalize();

  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-md px-4 text-center sm:px-6">
        <div className="mb-4 text-5xl sm:mb-6 sm:text-6xl">❌</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
          {localize('com_recharge_cancelled_title')}
        </h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
          {localize('com_recharge_cancelled_desc')}
        </p>

        <button
          onClick={() => navigate('/recharge')}
          className="mt-6 w-full rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 sm:mt-8"
        >
          {localize('com_recharge_try_again')}
        </button>

        <button
          onClick={() => navigate('/')}
          className="mt-3 w-full rounded-lg border border-gray-300 px-6 py-3 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          {localize('com_recharge_return_home')}
        </button>
      </div>
    </div>
  );
};

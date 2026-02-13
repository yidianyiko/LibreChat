import React from 'react';
import { useNavigate } from 'react-router-dom';

export const PaymentCancelPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="max-w-md px-4 text-center sm:px-6">
        <div className="mb-4 text-5xl sm:mb-6 sm:text-6xl">❌</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
          Payment Cancelled
        </h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
          Your payment was cancelled. No charges were made to your account.
        </p>

        <button
          onClick={() => navigate('/recharge')}
          className="mt-6 w-full rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 sm:mt-8"
        >
          Try Again
        </button>

        <button
          onClick={() => navigate('/')}
          className="mt-3 w-full rounded-lg border border-gray-300 px-6 py-3 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Return to Home
        </button>
      </div>
    </div>
  );
};

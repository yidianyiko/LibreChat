import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useRechargeHistoryQuery } from '~/hooks/Recharge/useRechargeQueries';

export const RechargeHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, error } = useRechargeHistoryQuery();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg text-gray-600 dark:text-gray-300">Loading history...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <div className="text-lg font-semibold text-red-600">Failed to load recharge history</div>
        <button
          onClick={() => navigate('/recharge')}
          className="mt-4 text-blue-600 hover:underline"
        >
          Back to Recharge
        </button>
      </div>
    );
  }

  const history = data?.history || [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
          Recharge History
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">View your past credit purchases</p>
      </div>

      {history.length === 0 ? (
        <div className="py-12 text-center">
          <div className="mb-4 text-4xl sm:text-5xl">📭</div>
          <p className="text-lg text-gray-600 dark:text-gray-300">No recharge history yet</p>
          <button
            onClick={() => navigate('/recharge')}
            className="mt-6 rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
          >
            Purchase Credits
          </button>
        </div>
      ) : (
        <>
          {/* Mobile card layout */}
          <div className="space-y-3 md:hidden">
            {history.map((item) => {
              const formattedCredits = (item.credits / 1000000).toFixed(1);
              const formattedAmount = (item.amount / 100).toFixed(2);
              const date = new Date(item.createdAt).toLocaleDateString();

              return (
                <div
                  key={item.id}
                  className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {formattedCredits}M Credits
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      ${formattedAmount}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{date}</span>
                    <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
                      {item.sessionId.slice(0, 12)}...
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table layout */}
          <div className="hidden overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 md:block">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Credits
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Session ID
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                {history.map((item) => {
                  const formattedCredits = (item.credits / 1000000).toFixed(1);
                  const formattedAmount = (item.amount / 100).toFixed(2);
                  const date = new Date(item.createdAt).toLocaleDateString();

                  return (
                    <tr key={item.id}>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                        {date}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                        {formattedCredits}M
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                        ${formattedAmount}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 font-mono text-sm text-gray-500 dark:text-gray-400">
                        {item.sessionId.slice(0, 20)}...
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="mt-8">
        <button
          onClick={() => navigate('/recharge')}
          className="w-full rounded-lg border border-gray-300 px-6 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 sm:w-auto"
        >
          Back to Recharge
        </button>
      </div>
    </div>
  );
};

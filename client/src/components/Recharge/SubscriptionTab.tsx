import React, { useState } from 'react';
import { PricingCard } from './PricingCard';
import {
  useCancelSubscription,
  useResumeSubscription,
  useChangeSubscriptionTier,
} from '~/hooks/Subscriptions';
import { useToastContext } from '@librechat/client';
import { useLocalize } from '~/hooks';
import type { PricingTier, SubscriptionStatus } from '~/types/recharge';

const TIER_ORDER = ['explorer', 'artisan', 'elite'];

interface SubscriptionTabProps {
  tiers: PricingTier[];
  subscriptionStatus: SubscriptionStatus | null | undefined;
  onSubscribe: (tierId: string) => Promise<void>;
  isLoading: boolean;
}

export const SubscriptionTab: React.FC<SubscriptionTabProps> = ({
  tiers,
  subscriptionStatus,
  onSubscribe,
  isLoading,
}) => {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const cancelMutation = useCancelSubscription();
  const resumeMutation = useResumeSubscription();
  const changeTierMutation = useChangeSubscriptionTier();

  const hasActiveSubscription = subscriptionStatus?.subscriptionStatus === 'active';
  const currentTier = subscriptionStatus?.subscriptionTier;
  const cancelAtPeriodEnd = subscriptionStatus?.cancelAtPeriodEnd ?? false;

  const handleCancelClick = async () => {
    if (!showCancelConfirm) {
      setShowCancelConfirm(true);
      return;
    }

    try {
      await cancelMutation.mutateAsync();
      showToast({
        message: localize('com_recharge_subscription_cancelled'),
        status: 'success',
      });
      setShowCancelConfirm(false);
    } catch (error) {
      console.error('[SubscriptionTab] Cancel subscription failed:', error);
      setShowCancelConfirm(false);
      showToast({
        message: localize('com_recharge_error_occurred'),
        status: 'error',
      });
    }
  };

  const handleResumeClick = async () => {
    try {
      await resumeMutation.mutateAsync();
      showToast({
        message: localize('com_recharge_subscription_resumed'),
        status: 'success',
      });
    } catch (error) {
      console.error('[SubscriptionTab] Resume subscription failed:', error);
      showToast({
        message: localize('com_recharge_error_occurred'),
        status: 'error',
      });
    }
  };

  const handleCardClick = async (tierId: string) => {
    if (!hasActiveSubscription) {
      await onSubscribe(tierId);
      return;
    }

    if (tierId === currentTier) {
      return;
    }

    try {
      await changeTierMutation.mutateAsync(tierId);
      showToast({
        message: localize('com_recharge_tier_changed'),
        status: 'success',
      });
    } catch (error) {
      console.error('[SubscriptionTab] Change tier failed:', error);
      showToast({
        message: localize('com_recharge_error_occurred'),
        status: 'error',
      });
    }
  };

  const getTierAction = (tierId: string): 'subscribe' | 'upgrade' | 'downgrade' => {
    if (!hasActiveSubscription || !currentTier) {
      return 'subscribe';
    }

    const currentIndex = TIER_ORDER.indexOf(currentTier);
    const tierIndex = TIER_ORDER.indexOf(tierId);

    if (tierIndex > currentIndex) {
      return 'upgrade';
    } else if (tierIndex < currentIndex) {
      return 'downgrade';
    }
    return 'subscribe';
  };

  const formatBalance = (balance: number): string => {
    return `$${(balance / 1000000).toFixed(2)}`;
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const isCancelOrResumeLoading = cancelMutation.isPending || resumeMutation.isPending;

  return (
    <div className="space-y-8">
      {hasActiveSubscription && subscriptionStatus && (
        <div
          data-testid="subscription-status-banner"
          className="rounded-2xl border border-[#10a37f] bg-gradient-to-r from-[#10a37f]/10 to-[#10a37f]/5 p-6 shadow-sm"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {localize('com_recharge_active_subscription')}
                </h3>
                <span className="rounded-full bg-[#10a37f] px-3 py-1 text-xs font-black uppercase tracking-widest text-white">
                  {currentTier?.toUpperCase()}
                </span>
              </div>
              {subscriptionStatus.currentPeriodEnd && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {cancelAtPeriodEnd
                    ? localize('com_recharge_cancels_on', {
                        0: formatDate(subscriptionStatus.currentPeriodEnd),
                      })
                    : localize('com_recharge_renews_on', {
                        0: formatDate(subscriptionStatus.currentPeriodEnd),
                      })}
                </p>
              )}
              <div className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
                <span>
                  {localize('com_recharge_subscription_balance', {
                    0: formatBalance(subscriptionStatus.subscriptionBalance),
                  })}
                </span>
                <span>
                  {localize('com_recharge_topup_balance', {
                    0: formatBalance(subscriptionStatus.topupBalance),
                  })}
                </span>
              </div>
            </div>
            <div>
              {cancelAtPeriodEnd ? (
                <button
                  type="button"
                  onClick={handleResumeClick}
                  disabled={isCancelOrResumeLoading}
                  className="rounded-xl bg-[#10a37f] px-6 py-3 text-sm font-bold uppercase tracking-widest text-white transition-all hover:bg-[#0d8a6a] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {localize('com_recharge_resume_subscription')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCancelClick}
                  disabled={isCancelOrResumeLoading}
                  className={`rounded-xl px-6 py-3 text-sm font-bold uppercase tracking-widest transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
                    showCancelConfirm
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {showCancelConfirm
                    ? localize('com_recharge_confirm_cancel')
                    : localize('com_recharge_cancel_subscription')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {tiers.map((tier, index) => {
          const isCurrentPlan = hasActiveSubscription && tier.id === currentTier;
          const subscriptionAction = getTierAction(tier.id);
          const isRecommended = index === 1; // Artisan tier (middle one)

          return (
            <PricingCard
              key={tier.id}
              tier={tier}
              onSelect={handleCardClick}
              isLoading={isLoading || changeTierMutation.isPending}
              recommended={isRecommended}
              mode="subscription"
              isCurrentPlan={isCurrentPlan}
              subscriptionAction={subscriptionAction}
            />
          );
        })}
      </div>
    </div>
  );
};

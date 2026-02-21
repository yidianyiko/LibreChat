import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SubscriptionTab } from '../SubscriptionTab';
import type { PricingTier, SubscriptionStatus } from '~/types/recharge';

const mockTiers: PricingTier[] = [
  {
    id: 'explorer',
    name: 'Explorer',
    description: 'Basic tier',
    price: 999,
    credits: 10000000,
    discount: 0,
  },
  {
    id: 'artisan',
    name: 'Artisan',
    description: 'Mid tier',
    price: 1499,
    credits: 15000000,
    discount: 5,
  },
  {
    id: 'elite',
    name: 'Elite',
    description: 'Premium tier',
    price: 2999,
    credits: 30000000,
    discount: 10,
  },
];

const mockActiveSubscription: SubscriptionStatus = {
  subscriptionStatus: 'active',
  subscriptionTier: 'artisan',
  subscriptionId: 'sub_123',
  currentPeriodEnd: '2026-03-18T10:00:00.000Z',
  cancelAtPeriodEnd: false,
  subscriptionBalance: 15000000,
  topupBalance: 5000000,
  totalBalance: 20000000,
};

const mockCancelingSubscription: SubscriptionStatus = {
  ...mockActiveSubscription,
  cancelAtPeriodEnd: true,
};

const mockCancelMutation = jest.fn();
const mockResumeMutation = jest.fn();
const mockChangeTierMutation = jest.fn();
const mockPreviewMutation = jest.fn();
const mockShowToast = jest.fn();

jest.mock('~/hooks/Subscriptions', () => ({
  useCancelSubscription: () => ({
    mutateAsync: mockCancelMutation,
    isPending: false,
  }),
  useResumeSubscription: () => ({
    mutateAsync: mockResumeMutation,
    isPending: false,
  }),
  useChangeSubscriptionTier: () => ({
    mutateAsync: mockChangeTierMutation,
    isPending: false,
  }),
  usePreviewSubscriptionChange: () => ({
    mutateAsync: mockPreviewMutation,
    isPending: false,
  }),
}));

jest.mock('@librechat/client', () => ({
  useToastContext: () => ({
    showToast: mockShowToast,
  }),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string, vars?: Record<string, string | number>) => {
    if (key === 'com_recharge_active_subscription') return 'Active Subscription';
    if (key === 'com_recharge_renews_on') return `Renews on ${vars?.['0'] ?? ''}`;
    if (key === 'com_recharge_cancels_on') return `Cancels on ${vars?.['0'] ?? ''}`;
    if (key === 'com_recharge_cancel_subscription') return 'Cancel Subscription';
    if (key === 'com_recharge_confirm_cancel') return 'Confirm Cancel';
    if (key === 'com_recharge_resume_subscription') return 'Resume Subscription';
    if (key === 'com_recharge_subscription_balance')
      return `Subscription Balance: ${vars?.['0'] ?? ''}`;
    if (key === 'com_recharge_topup_balance') return `Topup Balance: ${vars?.['0'] ?? ''}`;
    if (key === 'com_recharge_subscription_cancelled') return 'Subscription cancelled';
    if (key === 'com_recharge_subscription_resumed') return 'Subscription resumed';
    if (key === 'com_recharge_tier_changed') return 'Tier changed successfully';
    if (key === 'com_recharge_error_occurred') return 'An error occurred';
    if (key === 'com_recharge_upgrade') return 'UPGRADE';
    if (key === 'com_recharge_downgrade') return 'DOWNGRADE';
    if (key === 'com_recharge_subscribe_tier') return 'SUBSCRIBE';
    if (key === 'com_recharge_current_plan') return 'CURRENT PLAN';
    if (key === 'com_recharge_per_month') return '/mo';
    if (key === 'com_recharge_pack') return `${vars?.['0'] ?? ''} PACK`;
    if (key.includes('_sub')) return 'subtitle';
    if (key.includes('_f')) return 'feature';
    return key;
  },
}));

describe('SubscriptionTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('No active subscription', () => {
    it('should not render status banner when no subscription', () => {
      render(
        <SubscriptionTab
          tiers={mockTiers}
          subscriptionStatus={null}
          onSubscribe={jest.fn()}
          isLoading={false}
        />,
      );
      expect(screen.queryByTestId('subscription-status-banner')).not.toBeInTheDocument();
    });

    it('should render 3 pricing cards in subscription mode', () => {
      render(
        <SubscriptionTab
          tiers={mockTiers}
          subscriptionStatus={null}
          onSubscribe={jest.fn()}
          isLoading={false}
        />,
      );
      const cards = screen.getAllByTestId('pricing-card');
      expect(cards).toHaveLength(3);
    });

    it('should call onSubscribe when clicking subscribe button', async () => {
      const onSubscribe = jest.fn().mockResolvedValue(undefined);
      render(
        <SubscriptionTab
          tiers={mockTiers}
          subscriptionStatus={null}
          onSubscribe={onSubscribe}
          isLoading={false}
        />,
      );
      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[0]);
      await waitFor(() => {
        expect(onSubscribe).toHaveBeenCalledWith('explorer');
      });
    });
  });

  describe('Active subscription', () => {
    it('should render status banner with subscription details', () => {
      render(
        <SubscriptionTab
          tiers={mockTiers}
          subscriptionStatus={mockActiveSubscription}
          onSubscribe={jest.fn()}
          isLoading={false}
        />,
      );
      const banner = screen.getByTestId('subscription-status-banner');
      expect(banner).toBeInTheDocument();
      expect(screen.getByText(/Active Subscription/i)).toBeInTheDocument();
      // Use getAllByText since ARTISAN appears in both banner and card
      const artisanTexts = screen.getAllByText(/ARTISAN/i);
      expect(artisanTexts.length).toBeGreaterThan(0);
    });

    it('should show renews date when not canceling', () => {
      render(
        <SubscriptionTab
          tiers={mockTiers}
          subscriptionStatus={mockActiveSubscription}
          onSubscribe={jest.fn()}
          isLoading={false}
        />,
      );
      expect(screen.getByText(/Renews on/i)).toBeInTheDocument();
    });

    it('should show cancels date when cancelAtPeriodEnd is true', () => {
      render(
        <SubscriptionTab
          tiers={mockTiers}
          subscriptionStatus={mockCancelingSubscription}
          onSubscribe={jest.fn()}
          isLoading={false}
        />,
      );
      expect(screen.getByText(/Cancels on/i)).toBeInTheDocument();
    });

    it('should show subscription and topup balances', () => {
      render(
        <SubscriptionTab
          tiers={mockTiers}
          subscriptionStatus={mockActiveSubscription}
          onSubscribe={jest.fn()}
          isLoading={false}
        />,
      );
      expect(screen.getByText(/Subscription Balance: \$15\.00/i)).toBeInTheDocument();
      expect(screen.getByText(/Topup Balance: \$5\.00/i)).toBeInTheDocument();
    });

    it('should mark current tier card as current plan', () => {
      render(
        <SubscriptionTab
          tiers={mockTiers}
          subscriptionStatus={mockActiveSubscription}
          onSubscribe={jest.fn()}
          isLoading={false}
        />,
      );
      // The artisan tier should be marked as current
      const cards = screen.getAllByTestId('pricing-card');
      expect(cards[1]).toHaveClass('border-[#10a37f]');
    });

    it('should show upgrade action for higher tiers', () => {
      render(
        <SubscriptionTab
          tiers={mockTiers}
          subscriptionStatus={mockActiveSubscription}
          onSubscribe={jest.fn()}
          isLoading={false}
        />,
      );
      // Elite tier should have upgrade button
      expect(screen.getByText('UPGRADE')).toBeInTheDocument();
    });

    it('should show downgrade action for lower tiers', () => {
      render(
        <SubscriptionTab
          tiers={mockTiers}
          subscriptionStatus={mockActiveSubscription}
          onSubscribe={jest.fn()}
          isLoading={false}
        />,
      );
      // Explorer tier should have downgrade button
      expect(screen.getByText('DOWNGRADE')).toBeInTheDocument();
    });
  });

  describe('Cancel/Resume functionality', () => {
    it('should show cancel button when subscription is active', () => {
      render(
        <SubscriptionTab
          tiers={mockTiers}
          subscriptionStatus={mockActiveSubscription}
          onSubscribe={jest.fn()}
          isLoading={false}
        />,
      );
      expect(screen.getByText('Cancel Subscription')).toBeInTheDocument();
    });

    it('should show resume button when subscription is canceling', () => {
      render(
        <SubscriptionTab
          tiers={mockTiers}
          subscriptionStatus={mockCancelingSubscription}
          onSubscribe={jest.fn()}
          isLoading={false}
        />,
      );
      expect(screen.getByText('Resume Subscription')).toBeInTheDocument();
    });

    it('should require confirmation before canceling', async () => {
      render(
        <SubscriptionTab
          tiers={mockTiers}
          subscriptionStatus={mockActiveSubscription}
          onSubscribe={jest.fn()}
          isLoading={false}
        />,
      );

      const cancelButton = screen.getByText('Cancel Subscription');
      fireEvent.click(cancelButton);

      // First click shows confirm button
      expect(screen.getByText('Confirm Cancel')).toBeInTheDocument();
      expect(mockCancelMutation).not.toHaveBeenCalled();
    });

    it('should cancel subscription on second click', async () => {
      mockCancelMutation.mockResolvedValue({});
      render(
        <SubscriptionTab
          tiers={mockTiers}
          subscriptionStatus={mockActiveSubscription}
          onSubscribe={jest.fn()}
          isLoading={false}
        />,
      );

      const cancelButton = screen.getByText('Cancel Subscription');
      fireEvent.click(cancelButton);

      const confirmButton = screen.getByText('Confirm Cancel');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockCancelMutation).toHaveBeenCalled();
        expect(mockShowToast).toHaveBeenCalledWith({
          message: 'Subscription cancelled',
          status: 'success',
        });
      });
    });

    it('should resume subscription when clicking resume button', async () => {
      mockResumeMutation.mockResolvedValue({});
      render(
        <SubscriptionTab
          tiers={mockTiers}
          subscriptionStatus={mockCancelingSubscription}
          onSubscribe={jest.fn()}
          isLoading={false}
        />,
      );

      const resumeButton = screen.getByText('Resume Subscription');
      fireEvent.click(resumeButton);

      await waitFor(() => {
        expect(mockResumeMutation).toHaveBeenCalled();
        expect(mockShowToast).toHaveBeenCalledWith({
          message: 'Subscription resumed',
          status: 'success',
        });
      });
    });

    it('should show error toast on cancel failure', async () => {
      mockCancelMutation.mockRejectedValue(new Error('Network error'));
      render(
        <SubscriptionTab
          tiers={mockTiers}
          subscriptionStatus={mockActiveSubscription}
          onSubscribe={jest.fn()}
          isLoading={false}
        />,
      );

      const cancelButton = screen.getByText('Cancel Subscription');
      fireEvent.click(cancelButton);
      const confirmButton = screen.getByText('Confirm Cancel');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith({
          message: 'An error occurred',
          status: 'error',
        });
      });
    });
  });

  describe('Tier changes', () => {
    const mockPreviewResponse = {
      proratedAmount: 1500,
      currency: 'usd',
      immediateCharge: true,
      newTierPrice: 2999,
      newTierName: 'Elite',
      newTierCredits: 30000000,
      periodEnd: '2026-03-18T10:00:00.000Z',
    };

    it('should show confirmation dialog with preview when upgrading', async () => {
      mockPreviewMutation.mockResolvedValue(mockPreviewResponse);
      render(
        <SubscriptionTab
          tiers={mockTiers}
          subscriptionStatus={mockActiveSubscription}
          onSubscribe={jest.fn()}
          isLoading={false}
        />,
      );

      // Click upgrade button for elite tier
      const upgradeButton = screen.getByText('UPGRADE');
      fireEvent.click(upgradeButton);

      await waitFor(() => {
        expect(mockPreviewMutation).toHaveBeenCalledWith('elite');
      });

      // Confirmation dialog should appear
      expect(screen.getByText('Confirm Upgrade')).toBeInTheDocument();
      expect(screen.getByText(/Immediate charge/)).toBeInTheDocument();
      expect(screen.getByText(/\$29\.99\/mo/)).toBeInTheDocument(); // monthly rate
    });

    it('should call changeSubscriptionTier after confirming upgrade', async () => {
      mockPreviewMutation.mockResolvedValue(mockPreviewResponse);
      mockChangeTierMutation.mockResolvedValue({});
      render(
        <SubscriptionTab
          tiers={mockTiers}
          subscriptionStatus={mockActiveSubscription}
          onSubscribe={jest.fn()}
          isLoading={false}
        />,
      );

      // Click upgrade button for elite tier
      const upgradeButton = screen.getByText('UPGRADE');
      fireEvent.click(upgradeButton);

      await waitFor(() => {
        expect(screen.getByText('Confirm Upgrade')).toBeInTheDocument();
      });

      // Click confirm
      const confirmButton = screen.getByText('Confirm');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockChangeTierMutation).toHaveBeenCalledWith('elite');
        expect(mockShowToast).toHaveBeenCalledWith({
          message: 'Tier changed successfully',
          status: 'success',
        });
      });
    });

    it('should close dialog when clicking cancel', async () => {
      mockPreviewMutation.mockResolvedValue(mockPreviewResponse);
      render(
        <SubscriptionTab
          tiers={mockTiers}
          subscriptionStatus={mockActiveSubscription}
          onSubscribe={jest.fn()}
          isLoading={false}
        />,
      );

      const upgradeButton = screen.getByText('UPGRADE');
      fireEvent.click(upgradeButton);

      await waitFor(() => {
        expect(screen.getByText('Confirm Upgrade')).toBeInTheDocument();
      });

      // Click cancel in dialog
      const cancelDialogButton = screen.getByText('Cancel', { selector: '.fixed button' });
      fireEvent.click(cancelDialogButton);

      await waitFor(() => {
        expect(screen.queryByText('Confirm Upgrade')).not.toBeInTheDocument();
      });
      expect(mockChangeTierMutation).not.toHaveBeenCalled();
    });

    it('should show confirmation dialog with credit when downgrading', async () => {
      const downgradePreview = {
        ...mockPreviewResponse,
        proratedAmount: -500,
        newTierPrice: 999,
        newTierName: 'Explorer',
        newTierCredits: 10000000,
      };
      mockPreviewMutation.mockResolvedValue(downgradePreview);
      render(
        <SubscriptionTab
          tiers={mockTiers}
          subscriptionStatus={mockActiveSubscription}
          onSubscribe={jest.fn()}
          isLoading={false}
        />,
      );

      const downgradeButton = screen.getByText('DOWNGRADE');
      fireEvent.click(downgradeButton);

      await waitFor(() => {
        expect(mockPreviewMutation).toHaveBeenCalledWith('explorer');
      });

      expect(screen.getByText('Confirm Downgrade')).toBeInTheDocument();
      expect(screen.getByText(/Credit applied/)).toBeInTheDocument();
    });

    it('should show error toast when preview fails', async () => {
      mockPreviewMutation.mockRejectedValue(new Error('Network error'));
      render(
        <SubscriptionTab
          tiers={mockTiers}
          subscriptionStatus={mockActiveSubscription}
          onSubscribe={jest.fn()}
          isLoading={false}
        />,
      );

      const upgradeButton = screen.getByText('UPGRADE');
      fireEvent.click(upgradeButton);

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith({
          message: 'An error occurred',
          status: 'error',
        });
      });
    });
  });
});

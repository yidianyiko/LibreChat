# Recharge UI Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign `/recharge` page into a tab-based UI that clearly separates monthly subscription and one-time topup flows, supports subscription management (upgrade/downgrade/cancel/resume), and unifies the payment success page.

**Architecture:** `RechargePage` hosts two tabs — `SubscriptionTab` (subscription signup + upgrade/downgrade) and `TopupTab` (one-time credits, subscribers-only). `PricingCard` is extended with `mode` and `isCurrentPlan` props. Backend success URLs gain a `type` query param so `PaymentSuccessPage` renders contextually.

**Tech Stack:** React 18, TypeScript, TanStack Query, Tailwind CSS, existing `useRechargeQueries` hooks, `useCancelSubscription`/`useResumeSubscription`/`useChangeSubscriptionTier` from `Subscriptions.ts`.

---

## Task 1: Add locale strings

**Files:**
- Modify: `client/src/locales/en/translation.json` (after line 664)
- Modify: `client/src/locales/zh-Hans/translation.json` (after line 634)

### Step 1: Add English strings

Find the line `"com_recharge_view_history": "View Recharge History",` and add after it:

```json
  "com_recharge_tab_subscription": "Monthly Subscription",
  "com_recharge_tab_topup": "One-time Topup",
  "com_recharge_per_month": "/mo",
  "com_recharge_monthly": "monthly",
  "com_recharge_subscribe_tier": "SUBSCRIBE",
  "com_recharge_current_plan": "CURRENT PLAN",
  "com_recharge_upgrade": "UPGRADE",
  "com_recharge_downgrade": "DOWNGRADE",
  "com_recharge_topup_subscribers_only": "Topup is only available to active subscribers.",
  "com_recharge_subscribe_first": "Subscribe First",
  "com_recharge_subscription_active": "Active Subscription",
  "com_recharge_subscription_renews": "Renews",
  "com_recharge_subscription_cancels": "Cancels on",
  "com_recharge_cancel_subscription": "Cancel Subscription",
  "com_recharge_resume_subscription": "Resume Subscription",
  "com_recharge_subscription_balance": "Subscription Balance",
  "com_recharge_topup_balance": "Topup Balance",
  "com_recharge_subscription_success_title": "Subscription Activated!",
  "com_recharge_subscription_success_desc": "Your subscription is now active. Monthly credits have been added to your account.",
  "com_recharge_topup_success_title": "Topup Successful!",
  "com_recharge_topup_success_desc": "Your topup credits have been added to your account.",
  "com_recharge_manage_subscription": "Manage Subscription",
  "com_recharge_canceling": "Canceling...",
  "com_recharge_resuming": "Resuming...",
  "com_recharge_cancel_confirm": "Cancel at period end?",
  "com_recharge_tier": "Tier"
```

### Step 2: Add Chinese strings

Find the line `"com_recharge_view_history": "查看充值记录",` and add after it:

```json
  "com_recharge_tab_subscription": "月付订阅",
  "com_recharge_tab_topup": "一次性充值",
  "com_recharge_per_month": "/月",
  "com_recharge_monthly": "月付",
  "com_recharge_subscribe_tier": "订阅",
  "com_recharge_current_plan": "当前计划",
  "com_recharge_upgrade": "升级",
  "com_recharge_downgrade": "降级",
  "com_recharge_topup_subscribers_only": "一次性充值仅限活跃订阅用户使用。",
  "com_recharge_subscribe_first": "先去订阅",
  "com_recharge_subscription_active": "订阅中",
  "com_recharge_subscription_renews": "续期时间",
  "com_recharge_subscription_cancels": "取消时间",
  "com_recharge_cancel_subscription": "取消订阅",
  "com_recharge_resume_subscription": "恢复订阅",
  "com_recharge_subscription_balance": "订阅额度",
  "com_recharge_topup_balance": "充值额度",
  "com_recharge_subscription_success_title": "订阅已激活！",
  "com_recharge_subscription_success_desc": "您的订阅已成功激活，月度额度已添加至您的账户。",
  "com_recharge_topup_success_title": "充值成功！",
  "com_recharge_topup_success_desc": "您的充值额度已到账。",
  "com_recharge_manage_subscription": "管理订阅",
  "com_recharge_canceling": "取消中...",
  "com_recharge_resuming": "恢复中...",
  "com_recharge_cancel_confirm": "确认在周期结束时取消？",
  "com_recharge_tier": "套餐"
```

### Step 3: Commit

```bash
git add client/src/locales/en/translation.json client/src/locales/zh-Hans/translation.json
git commit -m "feat(i18n): add locale strings for subscription UI redesign

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Extend PricingCard component

**Files:**
- Modify: `client/src/components/Recharge/PricingCard.tsx`
- Test: `client/src/components/Recharge/__tests__/PricingCard.spec.tsx` (create)

### Step 1: Write failing tests

Create `client/src/components/Recharge/__tests__/PricingCard.spec.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { PricingCard } from '../PricingCard';

const baseTier = {
  id: 'artisan',
  name: 'Artisan',
  description: 'Test',
  price: 1499,
  credits: 15000000,
  discount: 0,
};

vi.mock('~/hooks', () => ({
  useLocalize: () => (key: string, vars?: Record<string, string>) => {
    if (key === 'com_recharge_current_plan') return 'CURRENT PLAN';
    if (key === 'com_recharge_upgrade') return 'UPGRADE';
    if (key === 'com_recharge_downgrade') return 'DOWNGRADE';
    if (key === 'com_recharge_subscribe_tier') return 'SUBSCRIBE';
    if (key === 'com_recharge_buy_tier') return `BUY ${vars?.[0] ?? ''}`;
    if (key === 'com_recharge_per_month') return '/mo';
    if (key === 'com_recharge_one_time') return 'one-time';
    if (key === 'com_recharge_processing') return 'Processing...';
    return key;
  },
}));

describe('PricingCard subscription mode', () => {
  it('shows /mo suffix when mode=subscription', () => {
    render(<PricingCard tier={baseTier} onSelect={vi.fn()} mode="subscription" />);
    expect(screen.getByText('/mo')).toBeInTheDocument();
  });

  it('shows CURRENT PLAN badge when isCurrentPlan', () => {
    render(<PricingCard tier={baseTier} onSelect={vi.fn()} mode="subscription" isCurrentPlan />);
    expect(screen.getByText('CURRENT PLAN')).toBeInTheDocument();
  });

  it('shows UPGRADE button for higher-value plan', () => {
    render(
      <PricingCard tier={baseTier} onSelect={vi.fn()} mode="subscription" subscriptionAction="upgrade" />,
    );
    expect(screen.getByRole('button', { name: /upgrade/i })).toBeInTheDocument();
  });

  it('shows DOWNGRADE button for lower-value plan', () => {
    render(
      <PricingCard tier={baseTier} onSelect={vi.fn()} mode="subscription" subscriptionAction="downgrade" />,
    );
    expect(screen.getByRole('button', { name: /downgrade/i })).toBeInTheDocument();
  });

  it('disables button when isDisabled=true', () => {
    render(<PricingCard tier={baseTier} onSelect={vi.fn()} mode="topup" isDisabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('does not call onSelect when disabled', () => {
    const onSelect = vi.fn();
    render(<PricingCard tier={baseTier} onSelect={onSelect} mode="topup" isDisabled />);
    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
```

### Step 2: Run tests to verify they fail

```bash
cd /home/ydyk/workspace/refers/AWS-server/LibreChat
npm run test:client -- --testPathPattern="PricingCard.spec" 2>&1 | tail -20
```

Expected: FAIL — props not recognized.

### Step 3: Update PricingCard

Replace the entire content of `client/src/components/Recharge/PricingCard.tsx`:

```tsx
import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useLocalize } from '~/hooks';
import type { PricingTier } from '~/types/recharge';

const getTierFeatureKeys = (tierId: string): string[] => {
  const keyBase = `com_recharge_tier_${tierId}_f`;
  const counts = { explorer: 4, artisan: 5, elite: 5 };
  const count = counts[tierId as keyof typeof counts] || 0;
  return Array.from({ length: count }, (_, i) => `${keyBase}${i + 1}`);
};

interface PricingCardProps {
  tier: PricingTier;
  onSelect: (tierId: string) => void;
  isLoading?: boolean;
  recommended?: boolean;
  /** Controls price label suffix and CTA text */
  mode?: 'subscription' | 'topup';
  /** Highlights card as the user's current plan */
  isCurrentPlan?: boolean;
  /** For subscription mode: determines CTA label */
  subscriptionAction?: 'subscribe' | 'upgrade' | 'downgrade';
  /** Greys out card and disables button */
  isDisabled?: boolean;
}

export const PricingCard: React.FC<PricingCardProps> = ({
  tier,
  onSelect,
  isLoading = false,
  recommended = false,
  mode = 'topup',
  isCurrentPlan = false,
  subscriptionAction = 'subscribe',
  isDisabled = false,
}) => {
  const localize = useLocalize();
  const formattedPrice = (tier.price / 100).toFixed(2);
  const subKey = `com_recharge_tier_${tier.id}_sub` as const;
  const subtitle = localize(subKey);
  const featureKeys = getTierFeatureKeys(tier.id);
  const features = featureKeys.map((key) => localize(key));
  const planName = localize('com_recharge_pack', { 0: tier.name.toUpperCase() });

  const priceSuffix =
    mode === 'subscription'
      ? localize('com_recharge_per_month')
      : localize('com_recharge_one_time');

  let ctaText: string;
  if (isLoading) {
    ctaText = localize('com_recharge_processing');
  } else if (isCurrentPlan) {
    ctaText = localize('com_recharge_current_plan');
  } else if (mode === 'subscription') {
    if (subscriptionAction === 'upgrade') ctaText = localize('com_recharge_upgrade');
    else if (subscriptionAction === 'downgrade') ctaText = localize('com_recharge_downgrade');
    else ctaText = localize('com_recharge_subscribe_tier');
  } else {
    ctaText = localize('com_recharge_buy_tier', { 0: tier.name.toUpperCase() });
  }

  const isButtonDisabled = isLoading || isCurrentPlan || isDisabled;

  return (
    <div
      data-testid="pricing-card"
      className={`flex flex-col rounded-[2rem] border p-5 shadow-sm transition-all duration-500 sm:rounded-[3rem] sm:p-6 md:p-8 lg:p-10 ${
        isCurrentPlan
          ? 'z-10 border-[#10a37f] bg-[#10a37f] text-white shadow-2xl lg:scale-105'
          : recommended && !isDisabled
            ? 'z-10 border-black bg-black text-white shadow-2xl lg:scale-105'
            : 'border-gray-100 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white'
      } ${isDisabled ? 'opacity-50' : ''}`}
    >
      <div className="mb-6 text-left sm:mb-8 md:mb-10">
        <div className="mb-4 flex items-center space-x-2">
          <span
            className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
              isCurrentPlan
                ? 'bg-white/20 text-white'
                : recommended && !isDisabled
                  ? 'bg-[#10a37f] text-white'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            {planName}
          </span>
          {isCurrentPlan && (
            <span className="text-[9px] font-black uppercase tracking-widest text-white/80">
              {localize('com_recharge_current_plan')}
            </span>
          )}
          {!isCurrentPlan && recommended && !isDisabled && (
            <span className="text-[9px] font-black uppercase tracking-widest text-[#10a37f]">
              {localize('com_recharge_most_popular')}
            </span>
          )}
        </div>
        <div className="mt-6 flex items-baseline">
          <span className="text-3xl font-black tracking-tight sm:text-4xl md:text-5xl">
            ${formattedPrice}
          </span>
          <span className="ml-2 text-sm font-medium opacity-50">{priceSuffix}</span>
        </div>
        <p className="mt-4 text-xs font-bold text-gray-400">{subtitle}</p>
      </div>
      <button
        type="button"
        onClick={() => !isButtonDisabled && onSelect(tier.id)}
        disabled={isButtonDisabled}
        className={`mb-6 w-full rounded-2xl py-3 text-sm font-bold uppercase tracking-widest transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:mb-8 sm:py-4 md:mb-10 ${
          isCurrentPlan
            ? 'bg-white/20 text-white cursor-default'
            : recommended && !isDisabled
              ? 'bg-[#10a37f] text-white hover:bg-[#0d8a6a]'
              : 'bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200'
        }`}
      >
        {ctaText}
      </button>
      <ul className="flex-grow space-y-5 text-left">
        {features.map((f, i) => (
          <li key={i} className="flex items-start space-x-3 text-sm font-medium">
            <CheckCircle2
              size={18}
              className={`flex-shrink-0 ${isCurrentPlan || (recommended && !isDisabled) ? 'text-white/70' : 'text-[#10a37f]'}`}
            />
            <span
              className={
                isCurrentPlan || (recommended && !isDisabled)
                  ? 'text-gray-300'
                  : 'text-gray-700 dark:text-gray-300'
              }
            >
              {f}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
```

### Step 4: Run tests to verify they pass

```bash
npm run test:client -- --testPathPattern="PricingCard.spec" 2>&1 | tail -20
```

Expected: PASS

### Step 5: Commit

```bash
git add client/src/components/Recharge/PricingCard.tsx \
        client/src/components/Recharge/__tests__/PricingCard.spec.tsx
git commit -m "feat(recharge): extend PricingCard with mode, isCurrentPlan, isDisabled props

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Add useCreateSubscription + useCreateTopup hooks

**Files:**
- Modify: `client/src/hooks/Recharge/useRechargeQueries.ts`
- Test: `client/src/hooks/Recharge/__tests__/useRechargeQueries.test.ts`

### Step 1: Write failing tests

Open `client/src/hooks/Recharge/__tests__/useRechargeQueries.test.ts` and add at the end:

```typescript
import { useCreateSubscription, useCreateTopup } from '../useRechargeQueries';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useCreateSubscription', () => {
  it('exports a useMutation hook', () => {
    const { result } = renderHook(() => useCreateSubscription(), {
      wrapper: createWrapper(),
    });
    expect(typeof result.current.mutateAsync).toBe('function');
  });
});

describe('useCreateTopup', () => {
  it('exports a useMutation hook', () => {
    const { result } = renderHook(() => useCreateTopup(), {
      wrapper: createWrapper(),
    });
    expect(typeof result.current.mutateAsync).toBe('function');
  });
});
```

### Step 2: Run to verify failure

```bash
npm run test:client -- --testPathPattern="useRechargeQueries.test" 2>&1 | tail -20
```

Expected: FAIL — `useCreateSubscription` not exported.

### Step 3: Add hooks to useRechargeQueries.ts

Append to the end of `client/src/hooks/Recharge/useRechargeQueries.ts`:

```typescript
export const useCreateSubscription = () => {
  return useMutation<CreateCheckoutSessionResponse, Error, { tierId: string }>({
    mutationFn: async ({ tierId }) => {
      return request.post(`${BASE_URL}/create-subscription`, { tierId });
    },
  });
};

export const useCreateTopup = () => {
  return useMutation<CreateCheckoutSessionResponse, Error, { tierId: string }>({
    mutationFn: async ({ tierId }) => {
      return request.post(`${BASE_URL}/create-topup`, { tierId });
    },
  });
};
```

### Step 4: Run tests to verify pass

```bash
npm run test:client -- --testPathPattern="useRechargeQueries.test" 2>&1 | tail -20
```

Expected: PASS

### Step 5: Commit

```bash
git add client/src/hooks/Recharge/useRechargeQueries.ts \
        client/src/hooks/Recharge/__tests__/useRechargeQueries.test.ts
git commit -m "feat(recharge): add useCreateSubscription and useCreateTopup hooks

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Create SubscriptionTab component

**Files:**
- Create: `client/src/components/Recharge/SubscriptionTab.tsx`
- Create: `client/src/components/Recharge/__tests__/SubscriptionTab.spec.tsx`

### Step 1: Write failing tests

Create `client/src/components/Recharge/__tests__/SubscriptionTab.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { SubscriptionTab } from '../SubscriptionTab';
import type { PricingTier } from '~/types/recharge';

const tiers: PricingTier[] = [
  { id: 'explorer', name: 'Explorer', description: '', price: 499, credits: 5000000, discount: 0 },
  { id: 'artisan', name: 'Artisan', description: '', price: 1499, credits: 15000000, discount: 0 },
  { id: 'elite', name: 'Elite', description: '', price: 3499, credits: 35000000, discount: 0 },
];

vi.mock('~/hooks', () => ({
  useLocalize: () => (key: string, vars?: Record<string, string>) => key,
}));
vi.mock('~/hooks/Subscriptions', () => ({
  useCancelSubscription: () => ({ mutateAsync: vi.fn(), isLoading: false }),
  useResumeSubscription: () => ({ mutateAsync: vi.fn(), isLoading: false }),
  useChangeSubscriptionTier: () => ({ mutateAsync: vi.fn(), isLoading: false }),
}));
vi.mock('@librechat/client', () => ({
  useToastContext: () => ({ showToast: vi.fn() }),
}));

describe('SubscriptionTab', () => {
  it('renders 3 pricing cards', () => {
    render(
      <SubscriptionTab
        tiers={tiers}
        subscriptionStatus={null}
        onSubscribe={vi.fn()}
        isLoading={false}
      />,
    );
    expect(screen.getAllByTestId('pricing-card')).toHaveLength(3);
  });

  it('shows subscription status banner when user has active subscription', () => {
    render(
      <SubscriptionTab
        tiers={tiers}
        subscriptionStatus={{
          subscriptionStatus: 'active',
          subscriptionTier: 'artisan',
          currentPeriodEnd: '2026-03-18T00:00:00Z',
          cancelAtPeriodEnd: false,
          subscriptionBalance: 15000000,
          topupBalance: 0,
        }}
        onSubscribe={vi.fn()}
        isLoading={false}
      />,
    );
    expect(screen.getByTestId('subscription-status-banner')).toBeInTheDocument();
  });

  it('highlights the current plan card', () => {
    render(
      <SubscriptionTab
        tiers={tiers}
        subscriptionStatus={{
          subscriptionStatus: 'active',
          subscriptionTier: 'artisan',
          currentPeriodEnd: '2026-03-18T00:00:00Z',
          cancelAtPeriodEnd: false,
          subscriptionBalance: 15000000,
          topupBalance: 0,
        }}
        onSubscribe={vi.fn()}
        isLoading={false}
      />,
    );
    // The artisan card should have CURRENT PLAN label
    expect(screen.getByText('com_recharge_current_plan')).toBeInTheDocument();
  });
});
```

### Step 2: Run to verify failure

```bash
npm run test:client -- --testPathPattern="SubscriptionTab.spec" 2>&1 | tail -20
```

Expected: FAIL — component not found.

### Step 3: Create SubscriptionTab.tsx

Create `client/src/components/Recharge/SubscriptionTab.tsx`:

```tsx
import React, { useState } from 'react';
import { useLocalize } from '~/hooks';
import { useToastContext } from '@librechat/client';
import { PricingCard } from './PricingCard';
import {
  useCancelSubscription,
  useResumeSubscription,
  useChangeSubscriptionTier,
} from '~/hooks/Subscriptions';
import type { PricingTier } from '~/types/recharge';
import type { SubscriptionStatus } from '~/types/recharge';

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
  const [confirmCancel, setConfirmCancel] = useState(false);

  const cancelMutation = useCancelSubscription();
  const resumeMutation = useResumeSubscription();
  const changeTierMutation = useChangeSubscriptionTier();

  const hasActiveSubscription = subscriptionStatus?.subscriptionStatus === 'active';
  const currentTierId = subscriptionStatus?.subscriptionTier;

  const getSubscriptionAction = (tierId: string): 'subscribe' | 'upgrade' | 'downgrade' => {
    if (!hasActiveSubscription || !currentTierId) return 'subscribe';
    const currentIdx = TIER_ORDER.indexOf(currentTierId);
    const tierIdx = TIER_ORDER.indexOf(tierId);
    if (tierIdx > currentIdx) return 'upgrade';
    if (tierIdx < currentIdx) return 'downgrade';
    return 'subscribe'; // same tier — shouldn't be reachable (isCurrentPlan guards it)
  };

  const handleSelect = async (tierId: string) => {
    if (tierId === currentTierId) return;
    if (hasActiveSubscription) {
      try {
        await changeTierMutation.mutateAsync(tierId);
        showToast({ message: localize('com_recharge_manage_subscription'), status: 'success' });
      } catch (err) {
        showToast({
          message: err instanceof Error ? err.message : localize('com_recharge_error_payment'),
          status: 'error',
        });
      }
    } else {
      await onSubscribe(tierId);
    }
  };

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync();
      setConfirmCancel(false);
      showToast({ message: localize('com_recharge_cancel_subscription'), status: 'info' });
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : localize('com_recharge_error_payment'),
        status: 'error',
      });
    }
  };

  const handleResume = async () => {
    try {
      await resumeMutation.mutateAsync();
      showToast({ message: localize('com_recharge_resume_subscription'), status: 'success' });
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : localize('com_recharge_error_payment'),
        status: 'error',
      });
    }
  };

  return (
    <div>
      {/* Status banner for active subscribers */}
      {hasActiveSubscription && subscriptionStatus && (
        <div
          data-testid="subscription-status-banner"
          className="mb-8 rounded-xl border border-[#10a37f]/30 bg-[#10a37f]/5 p-5 dark:bg-[#10a37f]/10"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[#10a37f]">
                {localize('com_recharge_subscription_active')} · {currentTierId?.toUpperCase()}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {subscriptionStatus.cancelAtPeriodEnd
                  ? `${localize('com_recharge_subscription_cancels')}: ${new Date(subscriptionStatus.currentPeriodEnd!).toLocaleDateString()}`
                  : `${localize('com_recharge_subscription_renews')}: ${new Date(subscriptionStatus.currentPeriodEnd!).toLocaleDateString()}`}
              </p>
              <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span>
                  {localize('com_recharge_subscription_balance')}:{' '}
                  {subscriptionStatus.subscriptionBalance?.toLocaleString()}
                </span>
                <span>
                  {localize('com_recharge_topup_balance')}:{' '}
                  {subscriptionStatus.topupBalance?.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              {subscriptionStatus.cancelAtPeriodEnd ? (
                <button
                  onClick={handleResume}
                  disabled={resumeMutation.isLoading}
                  className="rounded-lg border border-[#10a37f] px-4 py-2 text-xs font-semibold text-[#10a37f] hover:bg-[#10a37f]/10 disabled:opacity-50"
                >
                  {resumeMutation.isLoading
                    ? localize('com_recharge_resuming')
                    : localize('com_recharge_resume_subscription')}
                </button>
              ) : confirmCancel ? (
                <>
                  <button
                    onClick={handleCancel}
                    disabled={cancelMutation.isLoading}
                    className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {cancelMutation.isLoading
                      ? localize('com_recharge_canceling')
                      : localize('com_recharge_cancel_confirm')}
                  </button>
                  <button
                    onClick={() => setConfirmCancel(false)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    {localize('com_recharge_try_again')}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmCancel(true)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  {localize('com_recharge_cancel_subscription')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pricing cards */}
      <div className="grid grid-cols-1 items-stretch gap-6 text-left sm:gap-8 lg:grid-cols-3">
        {tiers.map((tier) => (
          <PricingCard
            key={tier.id}
            tier={tier}
            onSelect={handleSelect}
            mode="subscription"
            isCurrentPlan={hasActiveSubscription && tier.id === currentTierId}
            subscriptionAction={getSubscriptionAction(tier.id)}
            recommended={tier.id === 'artisan'}
            isLoading={
              isLoading ||
              changeTierMutation.isLoading
            }
          />
        ))}
      </div>
    </div>
  );
};
```

### Step 4: Add SubscriptionStatus type to types/recharge.ts

Open `client/src/types/recharge.ts` and add the `SubscriptionStatus` export if it doesn't exist:

```typescript
export interface SubscriptionStatus {
  subscriptionStatus: string | null;
  subscriptionTier: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  subscriptionBalance: number;
  topupBalance: number;
}
```

### Step 5: Run tests

```bash
npm run test:client -- --testPathPattern="SubscriptionTab.spec" 2>&1 | tail -20
```

Expected: PASS

### Step 6: Commit

```bash
git add client/src/components/Recharge/SubscriptionTab.tsx \
        client/src/components/Recharge/__tests__/SubscriptionTab.spec.tsx \
        client/src/types/recharge.ts
git commit -m "feat(recharge): add SubscriptionTab component with status banner and upgrade/downgrade

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Create TopupTab component

**Files:**
- Create: `client/src/components/Recharge/TopupTab.tsx`
- Create: `client/src/components/Recharge/__tests__/TopupTab.spec.tsx`

### Step 1: Write failing tests

Create `client/src/components/Recharge/__tests__/TopupTab.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { TopupTab } from '../TopupTab';
import type { PricingTier } from '~/types/recharge';

const tiers: PricingTier[] = [
  { id: 'explorer', name: 'Explorer', description: '', price: 499, credits: 5000000, discount: 0 },
  { id: 'artisan', name: 'Artisan', description: '', price: 1499, credits: 15000000, discount: 0 },
  { id: 'elite', name: 'Elite', description: '', price: 3499, credits: 35000000, discount: 0 },
];

vi.mock('~/hooks', () => ({
  useLocalize: () => (key: string, vars?: Record<string, string>) => key,
}));
vi.mock('@librechat/client', () => ({
  useToastContext: () => ({ showToast: vi.fn() }),
}));

describe('TopupTab', () => {
  it('renders 3 pricing cards', () => {
    render(<TopupTab tiers={tiers} hasActiveSubscription={true} onTopup={vi.fn()} isLoading={false} />);
    expect(screen.getAllByTestId('pricing-card')).toHaveLength(3);
  });

  it('shows subscriber-only banner when no active subscription', () => {
    render(
      <TopupTab tiers={tiers} hasActiveSubscription={false} onTopup={vi.fn()} isLoading={false} />,
    );
    expect(screen.getByTestId('topup-locked-banner')).toBeInTheDocument();
  });

  it('disables all cards when no active subscription', () => {
    render(
      <TopupTab tiers={tiers} hasActiveSubscription={false} onTopup={vi.fn()} isLoading={false} />,
    );
    const buttons = screen.getAllByRole('button');
    // All 3 pricing card buttons should be disabled (the subscribe-first link is not a button)
    const disabledButtons = buttons.filter((b) => b.hasAttribute('disabled'));
    expect(disabledButtons.length).toBeGreaterThanOrEqual(3);
  });
});
```

### Step 2: Run to verify failure

```bash
npm run test:client -- --testPathPattern="TopupTab.spec" 2>&1 | tail -20
```

Expected: FAIL — component not found.

### Step 3: Create TopupTab.tsx

Create `client/src/components/Recharge/TopupTab.tsx`:

```tsx
import React from 'react';
import { useLocalize } from '~/hooks';
import { PricingCard } from './PricingCard';
import type { PricingTier } from '~/types/recharge';

interface TopupTabProps {
  tiers: PricingTier[];
  hasActiveSubscription: boolean;
  onTopup: (tierId: string) => Promise<void>;
  isLoading: boolean;
  onSwitchToSubscription?: () => void;
}

export const TopupTab: React.FC<TopupTabProps> = ({
  tiers,
  hasActiveSubscription,
  onTopup,
  isLoading,
  onSwitchToSubscription,
}) => {
  const localize = useLocalize();

  return (
    <div>
      {/* Locked banner for non-subscribers */}
      {!hasActiveSubscription && (
        <div
          data-testid="topup-locked-banner"
          className="mb-8 flex flex-col items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-6 py-4 text-center dark:border-amber-700 dark:bg-amber-900/20 sm:flex-row sm:text-left"
        >
          <p className="flex-1 text-sm text-amber-800 dark:text-amber-200">
            {localize('com_recharge_topup_subscribers_only')}
          </p>
          {onSwitchToSubscription && (
            <button
              onClick={onSwitchToSubscription}
              className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700"
            >
              {localize('com_recharge_subscribe_first')}
            </button>
          )}
        </div>
      )}

      {/* Pricing cards */}
      <div className="grid grid-cols-1 items-stretch gap-6 text-left sm:gap-8 lg:grid-cols-3">
        {tiers.map((tier) => (
          <PricingCard
            key={tier.id}
            tier={tier}
            onSelect={onTopup}
            mode="topup"
            recommended={tier.id === 'artisan'}
            isDisabled={!hasActiveSubscription}
            isLoading={isLoading}
          />
        ))}
      </div>
    </div>
  );
};
```

### Step 4: Run tests

```bash
npm run test:client -- --testPathPattern="TopupTab.spec" 2>&1 | tail -20
```

Expected: PASS

### Step 5: Commit

```bash
git add client/src/components/Recharge/TopupTab.tsx \
        client/src/components/Recharge/__tests__/TopupTab.spec.tsx
git commit -m "feat(recharge): add TopupTab component with subscriber-only gate

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Refactor RechargePage with tab switching

**Files:**
- Modify: `client/src/components/Recharge/RechargePage.tsx`
- Modify: `client/src/components/Recharge/__tests__/RechargePage.spec.tsx`

### Step 1: Write failing tests

Replace the content of `client/src/components/Recharge/__tests__/RechargePage.spec.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock all data hooks
vi.mock('~/hooks/Recharge/useRechargeQueries', () => ({
  usePricingQuery: () => ({
    data: {
      enabled: true,
      tiers: [
        { id: 'explorer', name: 'Explorer', description: '', price: 499, credits: 5000000, discount: 0 },
        { id: 'artisan', name: 'Artisan', description: '', price: 1499, credits: 15000000, discount: 0 },
        { id: 'elite', name: 'Elite', description: '', price: 3499, credits: 35000000, discount: 0 },
      ],
    },
    isLoading: false,
    error: null,
  }),
  useCreateCheckoutSession: () => ({ mutateAsync: vi.fn(), isLoading: false }),
  useCreateSubscription: () => ({ mutateAsync: vi.fn(), isLoading: false }),
  useCreateTopup: () => ({ mutateAsync: vi.fn(), isLoading: false }),
}));

vi.mock('~/hooks/Subscriptions', () => ({
  useGetSubscriptionStatus: () => ({ data: null }),
  useCancelSubscription: () => ({ mutateAsync: vi.fn(), isLoading: false }),
  useResumeSubscription: () => ({ mutateAsync: vi.fn(), isLoading: false }),
  useChangeSubscriptionTier: () => ({ mutateAsync: vi.fn(), isLoading: false }),
}));

vi.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

vi.mock('@librechat/client', () => ({
  useToastContext: () => ({ showToast: vi.fn() }),
}));

import { RechargePage } from '../RechargePage';

const renderPage = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <RechargePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('RechargePage tabs', () => {
  it('renders two tabs', () => {
    renderPage();
    expect(screen.getByText('com_recharge_tab_subscription')).toBeInTheDocument();
    expect(screen.getByText('com_recharge_tab_topup')).toBeInTheDocument();
  });

  it('defaults to subscription tab', () => {
    renderPage();
    expect(screen.getByTestId('subscription-tab-panel')).toBeInTheDocument();
  });

  it('switches to topup tab on click', () => {
    renderPage();
    fireEvent.click(screen.getByText('com_recharge_tab_topup'));
    expect(screen.getByTestId('topup-tab-panel')).toBeInTheDocument();
  });
});
```

### Step 2: Run to verify failure

```bash
npm run test:client -- --testPathPattern="RechargePage.spec" 2>&1 | tail -20
```

Expected: FAIL — tabs not rendered.

### Step 3: Rewrite RechargePage.tsx

Replace the full content of `client/src/components/Recharge/RechargePage.tsx`:

```tsx
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

/** Mock data for UI preview when Stripe is not configured. */
const MOCK_PRICING_RESPONSE: PricingResponse = {
  enabled: true,
  tiers: [
    { id: 'explorer', name: 'Explorer', description: 'The Minimalist Alternative', price: 499, credits: 5000000, discount: 0 },
    { id: 'artisan', name: 'Artisan', description: "The Creator's Safe Haven", price: 1499, credits: 15000000, discount: 0 },
    { id: 'elite', name: 'Elite', description: 'The Power Productivity Hub', price: 3499, credits: 35000000, discount: 0 },
  ],
};

function isRechargeDisabled(error: unknown, data: { enabled?: boolean } | undefined): boolean {
  if (data && data.enabled === false) return true;
  const err = error as { response?: { status?: number; data?: { enabled?: boolean } } };
  return err?.response?.status === 503 || err?.response?.data?.enabled === false;
}

const isDev = import.meta.env.DEV;

type Tab = 'subscription' | 'topup';

export const RechargePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const uiPreviewParam = searchParams.get('ui_preview') === '1';
  const { showToast } = useToastContext();
  const localize = useLocalize();

  const [activeTab, setActiveTab] = useState<Tab>('subscription');

  const { data, isLoading, error } = usePricingQuery();
  const createSubscriptionMutation = useCreateSubscription();
  const createTopupMutation = useCreateTopup();
  const { data: subscriptionStatus } = useGetSubscriptionStatus();

  const useMockForDisplay = (!!error || !data?.enabled) && (uiPreviewParam || isDev);

  const handleSubscribe = async (tierId: string) => {
    if (useMockForDisplay) {
      showToast({ message: localize('com_recharge_preview_mode'), status: 'info' });
      return;
    }
    try {
      const result = await createSubscriptionMutation.mutateAsync({ tierId });
      if (result.url) window.location.href = result.url;
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : localize('com_recharge_error_payment'),
        status: 'error',
      });
    }
  };

  const handleTopup = async (tierId: string) => {
    if (useMockForDisplay) {
      showToast({ message: localize('com_recharge_preview_mode'), status: 'info' });
      return;
    }
    try {
      const result = await createTopupMutation.mutateAsync({ tierId });
      if (result.url) window.location.href = result.url;
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
        <div className="text-lg text-gray-600 dark:text-gray-300">{localize('com_recharge_loading')}</div>
      </div>
    );
  }

  if ((error || !data?.enabled) && !useMockForDisplay) {
    const disabled = isRechargeDisabled(error, data);
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-4">
        <div className={disabled ? 'text-lg font-semibold text-amber-600 dark:text-amber-400' : 'text-lg font-semibold text-red-600 dark:text-red-400'}>
          {disabled ? localize('com_recharge_not_available') : localize('com_recharge_error_load')}
        </div>
        <p className="max-w-md text-center text-sm text-gray-600 dark:text-gray-400">
          {disabled ? localize('com_recharge_not_available_desc') : localize('com_recharge_error_retry')}
        </p>
        <button onClick={() => navigate('/')} className="mt-4 text-blue-600 hover:underline dark:text-blue-400">
          {localize('com_recharge_return_home')}
        </button>
      </div>
    );
  }

  const displayData = data?.enabled ? data : MOCK_PRICING_RESPONSE;
  const hasActiveSubscription = subscriptionStatus?.subscriptionStatus === 'active';

  return (
    <div className="h-full overflow-y-auto">
      <div className="bg-[#fcfcf9] px-4 py-12 dark:bg-gray-900 sm:px-6 sm:py-16 md:px-10 md:py-24 lg:py-32">
        <div className="mx-auto max-w-6xl">
          {useMockForDisplay && (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
              {localize('com_recharge_preview_disabled')}
            </div>
          )}

          {/* Page title */}
          <div className="mb-8 text-center sm:mb-12 md:mb-16">
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

          {/* Tabs */}
          <div className="mb-10 flex justify-center">
            <div className="flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              {(['subscription', 'topup'] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-lg px-6 py-2.5 text-sm font-semibold transition-all ${
                    activeTab === tab
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                      : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                  }`}
                >
                  {localize(tab === 'subscription' ? 'com_recharge_tab_subscription' : 'com_recharge_tab_topup')}
                </button>
              ))}
            </div>
          </div>

          {/* Tab panels */}
          {activeTab === 'subscription' ? (
            <div data-testid="subscription-tab-panel">
              <SubscriptionTab
                tiers={displayData.tiers}
                subscriptionStatus={subscriptionStatus ?? null}
                onSubscribe={handleSubscribe}
                isLoading={createSubscriptionMutation.isLoading}
              />
            </div>
          ) : (
            <div data-testid="topup-tab-panel">
              <TopupTab
                tiers={displayData.tiers}
                hasActiveSubscription={hasActiveSubscription}
                onTopup={handleTopup}
                isLoading={createTopupMutation.isLoading}
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
```

### Step 4: Run tests

```bash
npm run test:client -- --testPathPattern="RechargePage.spec" 2>&1 | tail -20
```

Expected: PASS

### Step 5: Commit

```bash
git add client/src/components/Recharge/RechargePage.tsx \
        client/src/components/Recharge/__tests__/RechargePage.spec.tsx
git commit -m "feat(recharge): refactor RechargePage with subscription/topup tab switching

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Update backend success URLs to include type param

**Files:**
- Modify: `api/server/routes/recharge.js` (lines 181, 257)

### Step 1: Change subscription success URL

Find line 181 in `api/server/routes/recharge.js`:
```javascript
    const successUrl = `${baseUrl}/recharge/subscription-success?session_id={CHECKOUT_SESSION_ID}`;
```

Replace with:
```javascript
    const successUrl = `${baseUrl}/recharge/success?session_id={CHECKOUT_SESSION_ID}&type=subscription`;
```

### Step 2: Change topup success URL

Find line 257 in `api/server/routes/recharge.js`:
```javascript
    const successUrl = `${baseUrl}/recharge/topup-success?session_id={CHECKOUT_SESSION_ID}`;
```

Replace with:
```javascript
    const successUrl = `${baseUrl}/recharge/success?session_id={CHECKOUT_SESSION_ID}&type=topup`;
```

### Step 3: Verify the one-time checkout URL already uses /recharge/success

Check line 111 is already:
```javascript
    const successUrl = `${baseUrl}/recharge/success?session_id={CHECKOUT_SESSION_ID}`;
```

If so, update it to add `&type=topup` for consistency:
```javascript
    const successUrl = `${baseUrl}/recharge/success?session_id={CHECKOUT_SESSION_ID}&type=topup`;
```

### Step 4: Commit

```bash
git add api/server/routes/recharge.js
git commit -m "feat(api): unify success URLs with type param (subscription|topup)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Refactor PaymentSuccessPage to handle subscription and topup

**Files:**
- Modify: `client/src/components/Recharge/PaymentSuccessPage.tsx`
- Create: `client/src/components/Recharge/__tests__/PaymentSuccessPage.spec.tsx`

### Step 1: Write failing tests

Create `client/src/components/Recharge/__tests__/PaymentSuccessPage.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

vi.mock('~/hooks/Recharge/useRechargeQueries', () => ({
  useVerifySessionQuery: (sessionId: string | null) => ({
    data: sessionId
      ? { isPaid: true, credits: 15000000, amountTotal: 1499, tierId: 'artisan' }
      : null,
    isLoading: false,
    error: null,
  }),
}));

vi.mock('~/hooks/Subscriptions', () => ({
  useGetSubscriptionStatus: () => ({
    data: { subscriptionStatus: 'active', subscriptionTier: 'artisan' },
  }),
}));

vi.mock('~/hooks', () => ({
  useLocalize: () => (key: string, vars?: Record<string, string>) => {
    if (key === 'com_recharge_subscription_success_title') return 'Subscription Activated!';
    if (key === 'com_recharge_topup_success_title') return 'Topup Successful!';
    return key;
  },
}));

import { PaymentSuccessPage } from '../PaymentSuccessPage';

const renderPage = (search: string) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/recharge/success${search}`]}>
        <Routes>
          <Route path="/recharge/success" element={<PaymentSuccessPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('PaymentSuccessPage', () => {
  it('shows subscription success title for type=subscription', () => {
    renderPage('?session_id=cs_test_123&type=subscription');
    expect(screen.getByText('Subscription Activated!')).toBeInTheDocument();
  });

  it('shows topup success title for type=topup', () => {
    renderPage('?session_id=cs_test_123&type=topup');
    expect(screen.getByText('Topup Successful!')).toBeInTheDocument();
  });
});
```

### Step 2: Run to verify failure

```bash
npm run test:client -- --testPathPattern="PaymentSuccessPage.spec" 2>&1 | tail -20
```

Expected: FAIL — page doesn't check `type` param.

### Step 3: Rewrite PaymentSuccessPage.tsx

Replace the full content of `client/src/components/Recharge/PaymentSuccessPage.tsx`:

```tsx
import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { QueryKeys } from 'librechat-data-provider';
import { useLocalize } from '~/hooks';
import { useVerifySessionQuery } from '~/hooks/Recharge/useRechargeQueries';
import { useGetSubscriptionStatus } from '~/hooks/Subscriptions';

type PaymentType = 'subscription' | 'topup';

export const PaymentSuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const localize = useLocalize();

  const sessionId = searchParams.get('session_id');
  const paymentType = (searchParams.get('type') ?? 'topup') as PaymentType;
  const isSubscription = paymentType === 'subscription';

  // For topup we verify the session; for subscription the webhook handles it
  const { data, isLoading, error } = useVerifySessionQuery(isSubscription ? null : sessionId);
  const { data: subscriptionStatus } = useGetSubscriptionStatus();

  useEffect(() => {
    if (isSubscription) {
      queryClient.invalidateQueries({ queryKey: ['subscriptionStatus'] });
      queryClient.invalidateQueries({ queryKey: [QueryKeys.balance] });
    } else if (data?.isPaid) {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.balance] });
    }
  }, [isSubscription, data, queryClient]);

  if (!isSubscription && isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-4xl">⏳</div>
          <div className="text-lg text-gray-600 dark:text-gray-300">{localize('com_recharge_verifying')}</div>
        </div>
      </div>
    );
  }

  if (!isSubscription && (error || !data?.isPaid)) {
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

  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-md px-4 text-center sm:px-6">
        <div className="mb-4 text-5xl sm:mb-6 sm:text-6xl">✅</div>

        <h1 className="text-2xl font-bold text-green-600 dark:text-green-400 sm:text-3xl">
          {isSubscription
            ? localize('com_recharge_subscription_success_title')
            : localize('com_recharge_topup_success_title')}
        </h1>

        <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
          {isSubscription
            ? localize('com_recharge_subscription_success_desc')
            : localize('com_recharge_topup_success_desc')}
        </p>

        {/* Subscription details */}
        {isSubscription && subscriptionStatus?.subscriptionTier && (
          <div className="mt-6 rounded-lg bg-gray-100 p-4 dark:bg-gray-800 sm:mt-8 sm:p-6">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {localize('com_recharge_tier')}
            </div>
            <div className="mt-2 text-2xl font-bold uppercase text-gray-900 dark:text-white">
              {subscriptionStatus.subscriptionTier}
            </div>
            {subscriptionStatus.subscriptionBalance != null && (
              <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {localize('com_recharge_subscription_balance')}:{' '}
                {subscriptionStatus.subscriptionBalance.toLocaleString()}
              </div>
            )}
          </div>
        )}

        {/* Topup credit details */}
        {!isSubscription && data && (
          <div className="mt-6 rounded-lg bg-gray-100 p-4 dark:bg-gray-800 sm:mt-8 sm:p-6">
            <div className="text-sm text-gray-500 dark:text-gray-400">{localize('com_recharge_credits_added')}</div>
            <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
              {localize('com_recharge_credits_amount', { 0: (data.credits / 1000000).toFixed(1) })}
            </div>
            <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {localize('com_recharge_amount_paid', { 0: (data.amountTotal / 100).toFixed(2) })}
            </div>
          </div>
        )}

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
```

### Step 4: Run tests

```bash
npm run test:client -- --testPathPattern="PaymentSuccessPage.spec" 2>&1 | tail -20
```

Expected: PASS

### Step 5: Commit

```bash
git add client/src/components/Recharge/PaymentSuccessPage.tsx \
        client/src/components/Recharge/__tests__/PaymentSuccessPage.spec.tsx
git commit -m "feat(recharge): unify PaymentSuccessPage to handle subscription and topup types

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Update index.ts exports and run all tests

**Files:**
- Modify: `client/src/components/Recharge/index.ts`

### Step 1: Add new exports

Open `client/src/components/Recharge/index.ts` and add:

```typescript
export { SubscriptionTab } from './SubscriptionTab';
export { TopupTab } from './TopupTab';
```

### Step 2: Run all recharge tests

```bash
npm run test:client -- --testPathPattern="Recharge" 2>&1 | tail -30
```

Expected: All PASS

### Step 3: Run full client test suite

```bash
npm run test:client 2>&1 | tail -20
```

Expected: No regressions.

### Step 4: Build to verify no TypeScript errors

```bash
npm run build:packages 2>&1 | tail -10
```

Expected: Build succeeds with no errors.

### Step 5: Final commit

```bash
git add client/src/components/Recharge/index.ts
git commit -m "feat(recharge): complete recharge UI redesign with subscription/topup tabs

- Tab-based UI: Monthly Subscription | One-time Topup
- SubscriptionTab: 3 cards with current plan highlight, upgrade/downgrade, cancel/resume
- TopupTab: 3 cards, disabled with banner for non-subscribers
- PricingCard: extended with mode, isCurrentPlan, isDisabled, subscriptionAction props
- PaymentSuccessPage: unified for subscription + topup flows
- Backend success URLs unified with type param

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Verification Checklist

After all tasks complete, manually test these flows in browser (`http://localhost:3090/recharge`):

1. **Non-subscriber — Subscription tab (default)**
   - [ ] Shows 3 cards with `/mo` suffix
   - [ ] No status banner
   - [ ] Click "SUBSCRIBE" → redirects to Stripe Checkout (or preview toast in dev)

2. **Non-subscriber — Topup tab**
   - [ ] Shows amber banner "Topup is only available to active subscribers"
   - [ ] "Subscribe First" button switches back to Subscription tab
   - [ ] All 3 cards are greyed out / buttons disabled

3. **Active subscriber — Subscription tab**
   - [ ] Green status banner shows tier, renewal date, balances
   - [ ] Current plan card is highlighted in green
   - [ ] Other cards show UPGRADE / DOWNGRADE
   - [ ] Cancel button → confirm prompt → calls API

4. **Active subscriber — Topup tab**
   - [ ] No locked banner
   - [ ] All 3 cards active, clicking → Stripe Checkout

5. **Success page — subscription**
   - [ ] Visit `/recharge/success?session_id=xxx&type=subscription`
   - [ ] Shows "Subscription Activated!" heading
   - [ ] Shows tier and subscription balance

6. **Success page — topup**
   - [ ] Visit `/recharge/success?session_id=xxx&type=topup`
   - [ ] Shows "Topup Successful!" heading
   - [ ] Shows credits amount and amount paid

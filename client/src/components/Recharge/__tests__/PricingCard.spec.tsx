import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PricingCard } from '../PricingCard';

const baseTier = {
  id: 'artisan',
  name: 'Artisan',
  description: 'Test',
  price: 1499,
  credits: 15000000,
  discount: 0,
};

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string, vars?: Record<string, string>) => {
    if (key === 'com_recharge_current_plan') return 'CURRENT PLAN';
    if (key === 'com_recharge_upgrade') return 'UPGRADE';
    if (key === 'com_recharge_downgrade') return 'DOWNGRADE';
    if (key === 'com_recharge_subscribe_tier') return 'SUBSCRIBE';
    if (key === 'com_recharge_buy_tier') return `BUY ${vars?.['0'] ?? ''}`;
    if (key === 'com_recharge_per_month') return '/mo';
    if (key === 'com_recharge_one_time') return 'one-time';
    if (key === 'com_recharge_processing') return 'Processing...';
    if (key === 'com_recharge_most_popular') return 'MOST POPULAR';
    if (key === 'com_recharge_pack') return `${vars?.['0'] ?? ''} PACK`;
    if (key.includes('_sub')) return 'subtitle';
    if (key.includes('_f')) return 'feature';
    return key;
  },
}));

describe('PricingCard - subscription mode', () => {
  it('shows /mo suffix when mode=subscription', () => {
    render(<PricingCard tier={baseTier} onSelect={jest.fn()} mode="subscription" />);
    expect(screen.getByText('/mo')).toBeInTheDocument();
  });

  it('shows one-time suffix when mode=topup', () => {
    render(<PricingCard tier={baseTier} onSelect={jest.fn()} mode="topup" />);
    expect(screen.getByText('one-time')).toBeInTheDocument();
  });

  it('shows CURRENT PLAN text in button when isCurrentPlan', () => {
    render(<PricingCard tier={baseTier} onSelect={jest.fn()} mode="subscription" isCurrentPlan />);
    expect(screen.getByRole('button', { name: /current plan/i })).toBeInTheDocument();
  });

  it('shows UPGRADE button for upgrade action', () => {
    render(
      <PricingCard tier={baseTier} onSelect={jest.fn()} mode="subscription" subscriptionAction="upgrade" />,
    );
    expect(screen.getByRole('button', { name: /upgrade/i })).toBeInTheDocument();
  });

  it('shows DOWNGRADE button for downgrade action', () => {
    render(
      <PricingCard tier={baseTier} onSelect={jest.fn()} mode="subscription" subscriptionAction="downgrade" />,
    );
    expect(screen.getByRole('button', { name: /downgrade/i })).toBeInTheDocument();
  });

  it('disables button when isDisabled=true', () => {
    render(<PricingCard tier={baseTier} onSelect={jest.fn()} mode="topup" isDisabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('does not call onSelect when disabled', () => {
    const onSelect = jest.fn();
    render(<PricingCard tier={baseTier} onSelect={onSelect} mode="topup" isDisabled />);
    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('disables button when isCurrentPlan', () => {
    render(<PricingCard tier={baseTier} onSelect={jest.fn()} mode="subscription" isCurrentPlan />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});

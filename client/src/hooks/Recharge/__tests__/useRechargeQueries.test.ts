import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  usePricingQuery,
  useCreateCheckoutSession,
  useCreateSubscription,
  useCreateTopup,
} from '../useRechargeQueries';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useRechargeQueries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn() as any;
  });

  describe('usePricingQuery', () => {
    it('should fetch pricing tiers successfully', async () => {
      const mockResponse = {
        enabled: true,
        tiers: [{ id: 'tier_5', name: '$5', credits: 5000000, price: 500, discount: 0 }],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() => usePricingQuery(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });

    it('should handle fetch errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { result } = renderHook(() => usePricingQuery(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe('useCreateCheckoutSession', () => {
    it('should create checkout session successfully', async () => {
      const mockResponse = {
        sessionId: 'cs_test_123',
        url: 'https://checkout.stripe.com/c/pay/cs_test_123',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() => useCreateCheckoutSession(), {
        wrapper: createWrapper(),
      });

      const session = await result.current.mutateAsync({ tierId: 'tier_5' });
      expect(session).toEqual(mockResponse);
    });
  });
});

describe('useCreateSubscription', () => {
  it('returns a mutation hook', () => {
    const { result } = renderHook(() => useCreateSubscription(), {
      wrapper: createWrapper(),
    });
    expect(typeof result.current.mutate).toBe('function');
    expect(typeof result.current.mutateAsync).toBe('function');
  });
});

describe('useCreateTopup', () => {
  it('returns a mutation hook', () => {
    const { result } = renderHook(() => useCreateTopup(), {
      wrapper: createWrapper(),
    });
    expect(typeof result.current.mutate).toBe('function');
    expect(typeof result.current.mutateAsync).toBe('function');
  });
});

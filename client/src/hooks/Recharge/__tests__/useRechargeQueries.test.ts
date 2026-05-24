import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePricingQuery, useCreateCheckoutSession } from '../useRechargeQueries';

jest.mock('librechat-data-provider', () => ({
  request: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockRequest = jest.requireMock('librechat-data-provider').request as {
  get: jest.Mock;
  post: jest.Mock;
};

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
    mockRequest.get.mockReset();
    mockRequest.post.mockReset();
  });

  describe('usePricingQuery', () => {
    it('should fetch pricing tiers successfully', async () => {
      const mockResponse = {
        enabled: true,
        tiers: [{ id: 'tier_5', name: '$5', credits: 5000000, price: 500, discount: 0 }],
      };

      mockRequest.get.mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => usePricingQuery(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockRequest.get).toHaveBeenCalledWith('/api/recharge/pricing');
    });

    it('should handle fetch errors', async () => {
      mockRequest.get.mockRejectedValueOnce(new Error('pricing failed'));

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

      mockRequest.post.mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useCreateCheckoutSession(), {
        wrapper: createWrapper(),
      });

      const session = await result.current.mutateAsync({ tierId: 'tier_5' });
      expect(session).toEqual(mockResponse);
      expect(mockRequest.post).toHaveBeenCalledWith('/api/recharge/create-checkout-session', {
        tierId: 'tier_5',
      });
    });
  });
});

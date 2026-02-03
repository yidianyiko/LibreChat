import { useQuery, useMutation } from '@tanstack/react-query';
import type {
  PricingResponse,
  CreateCheckoutSessionResponse,
  RechargeHistory,
  VerifySessionResponse,
} from '~/types/recharge';

const BASE_URL = '/api/recharge';

export const RechargeKeys = {
  all: ['recharge'] as const,
  pricing: () => [...RechargeKeys.all, 'pricing'] as const,
  history: () => [...RechargeKeys.all, 'history'] as const,
  verifySession: (sessionId: string) =>
    [...RechargeKeys.all, 'verify', sessionId] as const,
};

export const usePricingQuery = () => {
  return useQuery<PricingResponse>({
    queryKey: RechargeKeys.pricing(),
    queryFn: async () => {
      const response = await fetch(`${BASE_URL}/pricing`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch pricing');
      }
      return response.json();
    },
  });
};

export const useCreateCheckoutSession = () => {
  return useMutation<CreateCheckoutSessionResponse, Error, { tierId: string }>({
    mutationFn: async ({ tierId }) => {
      const response = await fetch(`${BASE_URL}/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ tierId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create checkout session');
      }
      return response.json();
    },
  });
};

export const useRechargeHistoryQuery = (limit = 10) => {
  return useQuery<{ history: RechargeHistory[] }>({
    queryKey: [...RechargeKeys.history(), limit],
    queryFn: async () => {
      const response = await fetch(`${BASE_URL}/history?limit=${limit}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch recharge history');
      }
      return response.json();
    },
  });
};

export const useVerifySessionQuery = (sessionId: string | null) => {
  return useQuery<VerifySessionResponse>({
    queryKey: RechargeKeys.verifySession(sessionId || ''),
    queryFn: async () => {
      if (!sessionId) {
        throw new Error('No session ID provided');
      }
      const response = await fetch(`${BASE_URL}/verify-session/${sessionId}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to verify session');
      }
      return response.json();
    },
    enabled: !!sessionId,
  });
};

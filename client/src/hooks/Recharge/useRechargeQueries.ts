import { useQuery, useMutation } from '@tanstack/react-query';
import { request } from 'librechat-data-provider';
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
  verifySession: (sessionId: string) => [...RechargeKeys.all, 'verify', sessionId] as const,
};

export const usePricingQuery = () => {
  return useQuery<PricingResponse>({
    queryKey: RechargeKeys.pricing(),
    queryFn: async () => {
      return request.get<PricingResponse>(`${BASE_URL}/pricing`);
    },
  });
};

export const useCreateCheckoutSession = () => {
  return useMutation<CreateCheckoutSessionResponse, Error, { tierId: string }>({
    mutationFn: async ({ tierId }) => {
      return request.post(`${BASE_URL}/create-checkout-session`, { tierId });
    },
  });
};

export const useRechargeHistoryQuery = (limit = 10) => {
  return useQuery<{ history: RechargeHistory[] }>({
    queryKey: [...RechargeKeys.history(), limit],
    queryFn: async () => {
      return request.get<{ history: RechargeHistory[] }>(`${BASE_URL}/history?limit=${limit}`);
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
      return request.get<VerifySessionResponse>(`${BASE_URL}/verify-session/${sessionId}`);
    },
    enabled: !!sessionId,
  });
};

const createMutationHook = (endpoint: string) => () => {
  return useMutation<CreateCheckoutSessionResponse, Error, { tierId: string }>({
    mutationFn: async ({ tierId }) => {
      return request.post(`${BASE_URL}/${endpoint}`, { tierId });
    },
  });
};

/** Creates a Stripe checkout session for monthly subscription */
export const useCreateSubscription = createMutationHook('create-subscription');

/** Creates a Stripe checkout session for one-time topup purchase (subscribers only) */
export const useCreateTopup = createMutationHook('create-topup');

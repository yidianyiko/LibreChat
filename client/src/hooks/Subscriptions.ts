import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getSubscriptionStatus,
  createSubscription,
  createTopup,
  cancelSubscription,
  resumeSubscription,
  changeSubscriptionTier,
} from 'librechat-data-provider';

export const useGetSubscriptionStatus = () => {
  return useQuery({
    queryKey: ['subscriptionStatus'],
    queryFn: () => getSubscriptionStatus(),
    refetchOnWindowFocus: false,
  });
};

export const useCreateSubscription = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tierId: string) => createSubscription(tierId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptionStatus'] });
    },
  });
};

export const useCreateTopup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tierId: string) => createTopup(tierId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptionStatus'] });
    },
  });
};

export const useCancelSubscription = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => cancelSubscription(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptionStatus'] });
    },
  });
};

export const useResumeSubscription = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => resumeSubscription(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptionStatus'] });
    },
  });
};

export const useChangeSubscriptionTier = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newTierId: string) => changeSubscriptionTier(newTierId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptionStatus'] });
    },
  });
};

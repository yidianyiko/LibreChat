import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService, MutationKeys, QueryKeys } from 'librechat-data-provider';
import type { UseMutationResult } from '@tanstack/react-query';
import type { TWeChatBindStartResponse } from 'librechat-data-provider';

export const useStartWeChatBindMutation = (): UseMutationResult<TWeChatBindStartResponse> =>
  useMutation([MutationKeys.bindWeChat], () => dataService.startWeChatBind());

export const useUnbindWeChatMutation = (): UseMutationResult<void> => {
  const queryClient = useQueryClient();

  return useMutation([MutationKeys.unbindWeChat], () => dataService.unbindWeChat(), {
    onSuccess: () => {
      queryClient.invalidateQueries([QueryKeys.wechatStatus]);
    },
  });
};

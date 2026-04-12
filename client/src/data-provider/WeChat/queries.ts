import { useQuery } from '@tanstack/react-query';
import { QueryKeys, dataService } from 'librechat-data-provider';
import type { QueryObserverResult, UseQueryOptions } from '@tanstack/react-query';
import type { TWeChatBindStatusResponse, TWeChatStatusResponse } from 'librechat-data-provider';

export const useWeChatStatusQuery = (
  config?: UseQueryOptions<TWeChatStatusResponse>,
): QueryObserverResult<TWeChatStatusResponse> =>
  useQuery([QueryKeys.wechatStatus], () => dataService.getWeChatStatus(), {
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    ...config,
  });

export const useWeChatBindStatusQuery = (
  bindSessionId: string | null,
  enabled: boolean,
  config?: UseQueryOptions<TWeChatBindStatusResponse>,
): QueryObserverResult<TWeChatBindStatusResponse> =>
  useQuery(
    [QueryKeys.wechatStatus, 'bindStatus', bindSessionId],
    () => dataService.getWeChatBindStatus(bindSessionId ?? ''),
    {
      enabled: enabled && bindSessionId != null,
      refetchInterval: (data) => (data?.status === 'pending' ? 2000 : false),
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      ...config,
    },
  );

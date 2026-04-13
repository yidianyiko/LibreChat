import { useCallback, useEffect, useState } from 'react';
import { useToastContext } from '@librechat/client';
import { useQueryClient } from '@tanstack/react-query';
import { QueryKeys } from 'librechat-data-provider';
import type { QueryObserverResult, UseMutationResult } from '@tanstack/react-query';
import type {
  TWeChatBindStartResponse,
  TWeChatBindStatusResponse,
  TWeChatStatusResponse,
} from 'librechat-data-provider';
import {
  useStartWeChatBindMutation,
  useUnbindWeChatMutation,
  useWeChatBindStatusQuery,
  useWeChatStatusQuery,
} from '~/data-provider';
import { useLocalize } from '~/hooks';

type TUseWeChatBindingFlowOptions = {
  autoStartOnOpen?: boolean;
  lazyStatusQuery?: boolean;
};

type TUseWeChatBindingFlowParams = {
  autoStartOnOpen: boolean;
};

type TStartBindingOptions = {
  closeDialogOnError?: boolean;
};

type TUseWeChatBindingFlowReturn = TUseWeChatBindingFlowParams & {
  bindSessionId: string | null;
  connectedAccount: string | undefined;
  hasBinding: boolean;
  isBusy: boolean;
  isDialogOpen: boolean;
  qrCodeDataUrl: string | null;
  showBindAction: boolean;
  status: TWeChatStatusResponse['status'] | undefined;
  bindStartMutation: UseMutationResult<TWeChatBindStartResponse>;
  bindStatusQuery: QueryObserverResult<TWeChatBindStatusResponse>;
  statusQuery: QueryObserverResult<TWeChatStatusResponse>;
  unbindMutation: UseMutationResult<void>;
  onDialogOpenChange: (open: boolean) => void;
  openDialog: () => void;
  resetBindingFlow: () => void;
  startBinding: (options?: TStartBindingOptions) => void;
};

export function useWeChatBindingFlow(
  options?: TUseWeChatBindingFlowOptions,
): TUseWeChatBindingFlowReturn {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const { showToast } = useToastContext();
  const [bindSessionId, setBindSessionId] = useState<string | null>(null);
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [shouldAutoStartCurrentOpen, setShouldAutoStartCurrentOpen] = useState(false);
  const lazyStatusQuery = options?.lazyStatusQuery === true;
  const statusQuery = useWeChatStatusQuery({ enabled: lazyStatusQuery ? isDialogOpen : true });
  const bindStartMutation = useStartWeChatBindMutation();
  const unbindMutation = useUnbindWeChatMutation();
  const bindStatusQuery = useWeChatBindStatusQuery(bindSessionId, isDialogOpen);
  const autoStartOnOpen = options?.autoStartOnOpen === true;
  const status = statusQuery.data;
  const hasBinding = status?.hasBinding === true;
  const showBindAction = !hasBinding || status?.status === 'reauth_required';
  const isBusy = bindStartMutation.isLoading || unbindMutation.isLoading;

  const resetBindingFlow = useCallback(() => {
    setBindSessionId(null);
    setQrCodeDataUrl(null);
    setShouldAutoStartCurrentOpen(false);
  }, []);

  const onDialogOpenChange = useCallback(
    (open: boolean) => {
      setDialogOpen(open);
      if (!open) {
        resetBindingFlow();
        return;
      }

      const currentStatus = status?.status;
      const canAutoStartFromOpen =
        currentStatus == null || currentStatus === 'unbound' || currentStatus === 'reauth_required';
      setShouldAutoStartCurrentOpen(autoStartOnOpen && canAutoStartFromOpen);
    },
    [autoStartOnOpen, resetBindingFlow, status?.status],
  );

  const startBinding = useCallback(
    (options?: TStartBindingOptions) => {
      if (bindStartMutation.isLoading) {
        return;
      }

      const closeDialogOnError = options?.closeDialogOnError === true;

      bindStartMutation.mutate(undefined, {
        onSuccess: (data) => {
          setBindSessionId(data.bindSessionId);
          setQrCodeDataUrl(data.qrCodeDataUrl);
        },
        onError: () => {
          showToast({
            message: localize('com_ui_error_connection'),
            status: 'error',
          });
          if (closeDialogOnError) {
            onDialogOpenChange(false);
          }
        },
      });
    },
    [bindStartMutation, localize, onDialogOpenChange, showToast],
  );

  const openDialog = useCallback(() => {
    onDialogOpenChange(true);
  }, [onDialogOpenChange]);

  useEffect(() => {
    if (bindSessionId == null) {
      return;
    }

    const bindStatus = bindStatusQuery.data;
    if (bindStatus?.qrCodeDataUrl) {
      setQrCodeDataUrl(bindStatus.qrCodeDataUrl);
    }

    if (bindStatus == null || bindStatus.status === 'pending') {
      return;
    }

    const queryKey = [QueryKeys.wechatStatus];
    let cancelled = false;
    const closeWithSuccess = () => {
      if (cancelled) {
        return;
      }

      showToast({
        message: localize('com_ui_wechat_bound_success'),
        status: 'success',
      });
      onDialogOpenChange(false);
    };

    void queryClient.invalidateQueries(queryKey);

    if (bindStatus.status === 'healthy') {
      const refetchResult = queryClient.refetchQueries(queryKey) as Promise<void> | undefined;
      if (refetchResult == null) {
        closeWithSuccess();
      } else {
        void refetchResult.finally(closeWithSuccess);
      }

      return () => {
        cancelled = true;
      };
    }

    void queryClient.refetchQueries(queryKey);
    onDialogOpenChange(false);

    return () => {
      cancelled = true;
    };
  }, [bindSessionId, bindStatusQuery.data, localize, onDialogOpenChange, queryClient, showToast]);

  useEffect(() => {
    const currentStatus = status?.status;
    const canStartBinding = currentStatus === 'unbound' || currentStatus === 'reauth_required';

    if (!autoStartOnOpen || !isDialogOpen || !shouldAutoStartCurrentOpen || bindSessionId != null) {
      return;
    }

    if (currentStatus == null) {
      return;
    }

    if (!canStartBinding) {
      setShouldAutoStartCurrentOpen(false);
      return;
    }

    setShouldAutoStartCurrentOpen(false);
    startBinding({ closeDialogOnError: true });
  }, [
    autoStartOnOpen,
    bindSessionId,
    isDialogOpen,
    shouldAutoStartCurrentOpen,
    startBinding,
    status?.status,
  ]);

  return {
    autoStartOnOpen,
    bindSessionId,
    bindStartMutation,
    bindStatusQuery,
    connectedAccount: status?.ilinkUserId,
    hasBinding,
    isBusy,
    isDialogOpen,
    onDialogOpenChange,
    openDialog,
    qrCodeDataUrl,
    resetBindingFlow,
    showBindAction,
    status: status?.status,
    statusQuery,
    startBinding,
    unbindMutation,
  };
}

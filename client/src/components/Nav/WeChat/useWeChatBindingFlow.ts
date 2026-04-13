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
};

type TUseWeChatBindingFlowParams = {
  autoStartOnOpen: boolean;
};

type TUseWeChatBindingFlowReturn = TUseWeChatBindingFlowParams & {
  bindSessionId: string | null;
  isDialogOpen: boolean;
  qrCodeDataUrl: string | null;
  bindStartMutation: UseMutationResult<TWeChatBindStartResponse>;
  bindStatusQuery: QueryObserverResult<TWeChatBindStatusResponse>;
  statusQuery: QueryObserverResult<TWeChatStatusResponse>;
  unbindMutation: UseMutationResult<void>;
  onDialogOpenChange: (open: boolean) => void;
  openDialog: () => void;
  resetBindingFlow: () => void;
  startBinding: () => void;
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
  const statusQuery = useWeChatStatusQuery();
  const bindStartMutation = useStartWeChatBindMutation();
  const unbindMutation = useUnbindWeChatMutation();
  const bindStatusQuery = useWeChatBindStatusQuery(bindSessionId, isDialogOpen);
  const autoStartOnOpen = options?.autoStartOnOpen === true;

  const resetBindingFlow = useCallback(() => {
    setBindSessionId(null);
    setQrCodeDataUrl(null);
  }, []);

  const onDialogOpenChange = useCallback(
    (open: boolean) => {
      setDialogOpen(open);
      if (!open) {
        resetBindingFlow();
      }
    },
    [resetBindingFlow],
  );

  const startBinding = useCallback(() => {
    if (bindStartMutation.isLoading) {
      return;
    }

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
        onDialogOpenChange(false);
      },
    });
  }, [bindStartMutation, localize, onDialogOpenChange, showToast]);

  const openDialog = useCallback(() => {
    setDialogOpen(true);
  }, []);

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

    void queryClient.invalidateQueries([QueryKeys.wechatStatus]);
    void queryClient.refetchQueries([QueryKeys.wechatStatus]);

    if (bindStatus.status === 'healthy') {
      showToast({
        message: localize('com_ui_wechat_bound_success'),
        status: 'success',
      });
    }

    onDialogOpenChange(false);
  }, [bindSessionId, bindStatusQuery.data, localize, onDialogOpenChange, queryClient, showToast]);

  useEffect(() => {
    const status = statusQuery.data?.status;
    const canStartBinding = status === 'unbound' || status === 'reauth_required';

    if (!autoStartOnOpen || !isDialogOpen || bindSessionId != null || !canStartBinding) {
      return;
    }

    startBinding();
  }, [autoStartOnOpen, bindSessionId, isDialogOpen, startBinding, statusQuery.data]);

  return {
    autoStartOnOpen,
    bindSessionId,
    bindStartMutation,
    bindStatusQuery,
    isDialogOpen,
    onDialogOpenChange,
    openDialog,
    qrCodeDataUrl,
    resetBindingFlow,
    statusQuery,
    startBinding,
    unbindMutation,
  };
}

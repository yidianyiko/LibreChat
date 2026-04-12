import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Label,
  OGDialog,
  OGDialogContent,
  OGDialogHeader,
  OGDialogTitle,
  useToastContext,
} from '@librechat/client';
import { QueryKeys } from 'librechat-data-provider';
import {
  useStartWeChatBindMutation,
  useUnbindWeChatMutation,
  useWeChatBindStatusQuery,
  useWeChatStatusQuery,
} from '~/data-provider';
import { useLocalize } from '~/hooks';

function getWeChatStatusText(
  status: 'unbound' | 'healthy' | 'reauth_required' | undefined,
  localize: ReturnType<typeof useLocalize>,
) {
  if (status === 'healthy') {
    return localize('com_ui_wechat_bound_healthy');
  }

  if (status === 'reauth_required') {
    return localize('com_ui_wechat_reauth_required');
  }

  return localize('com_ui_wechat_unbound');
}

function shouldRenderQrImage(value: string | null): value is string {
  return typeof value === 'string' && value.startsWith('data:image/');
}

export default function WeChatBinding() {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const queryClient = useQueryClient();
  const [bindSessionId, setBindSessionId] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [isDialogOpen, setDialogOpen] = useState(false);
  const statusQuery = useWeChatStatusQuery();
  const bindStartMutation = useStartWeChatBindMutation();
  const unbindMutation = useUnbindWeChatMutation();
  const bindStatusQuery = useWeChatBindStatusQuery(bindSessionId, isDialogOpen);

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

    setDialogOpen(false);
    setBindSessionId(null);
    setQrCodeDataUrl(null);
  }, [bindSessionId, bindStatusQuery.data, localize, queryClient, showToast]);

  const status = statusQuery.data;
  const hasBinding = status?.hasBinding === true;
  const showBindAction = !hasBinding || status?.status === 'reauth_required';
  const isBusy = bindStartMutation.isLoading || unbindMutation.isLoading;

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <Label id="wechat-binding-label">{localize('com_nav_wechat_binding')}</Label>
          <p className="text-xs text-text-secondary">
            {getWeChatStatusText(status?.status, localize)}
          </p>
          {status?.ilinkUserId ? (
            <p className="text-xs text-text-secondary">
              {localize('com_ui_wechat_connected_account')}: {status.ilinkUserId}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {showBindAction ? (
            <Button
              aria-label={localize('com_ui_wechat_bind')}
              disabled={isBusy}
              onClick={() =>
                bindStartMutation.mutate(undefined, {
                  onSuccess: (data) => {
                    setBindSessionId(data.bindSessionId);
                    setQrCodeDataUrl(data.qrCodeDataUrl);
                    setDialogOpen(true);
                  },
                })
              }
            >
              {localize('com_ui_wechat_bind')}
            </Button>
          ) : null}
          {hasBinding ? (
            <Button
              aria-label={localize('com_ui_wechat_unbind')}
              disabled={isBusy}
              variant="destructive"
              onClick={() => unbindMutation.mutate()}
            >
              {localize('com_ui_wechat_unbind')}
            </Button>
          ) : null}
        </div>
      </div>
      <OGDialog
        open={isDialogOpen}
        onOpenChange={(open: boolean) => {
          setDialogOpen(open);
          if (!open) {
            setBindSessionId(null);
            setQrCodeDataUrl(null);
          }
        }}
      >
        <OGDialogContent className="w-11/12 max-w-md">
          <OGDialogHeader>
            <OGDialogTitle>{localize('com_ui_wechat_qr_title')}</OGDialogTitle>
          </OGDialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">{localize('com_ui_wechat_qr_help')}</p>
            {shouldRenderQrImage(qrCodeDataUrl) ? (
              <img
                alt={localize('com_ui_wechat_qr_title')}
                className="mx-auto max-h-72 w-full max-w-72 rounded-md border border-border-light object-contain p-2"
                src={qrCodeDataUrl}
              />
            ) : null}
            {qrCodeDataUrl != null && !shouldRenderQrImage(qrCodeDataUrl) ? (
              <div className="mx-auto flex w-full max-w-72 justify-center rounded-md border border-border-light bg-white p-4">
                <QRCodeSVG
                  value={qrCodeDataUrl}
                  size={240}
                  marginSize={2}
                  title={localize('com_ui_wechat_qr_title')}
                />
              </div>
            ) : null}
          </div>
        </OGDialogContent>
      </OGDialog>
    </>
  );
}

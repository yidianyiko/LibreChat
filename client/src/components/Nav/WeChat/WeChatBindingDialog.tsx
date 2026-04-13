import { QRCodeSVG } from 'qrcode.react';
import {
  Button,
  OGDialog,
  OGDialogContent,
  OGDialogHeader,
  OGDialogTitle,
} from '@librechat/client';
import { useLocalize } from '~/hooks';

type TWeChatBindingDialogProps = {
  connectedAccount: string | undefined;
  hasBinding: boolean;
  isBusy: boolean;
  onOpenChange: (open: boolean) => void;
  onBind: () => void;
  onUnbind: () => void;
  open: boolean;
  qrCodeDataUrl: string | null;
  showBindAction: boolean;
  showManagementState: boolean;
  statusText: string;
};

function shouldRenderQrImage(value: string | null): value is string {
  return typeof value === 'string' && value.startsWith('data:image/');
}

export default function WeChatBindingDialog({
  connectedAccount,
  hasBinding,
  isBusy,
  onOpenChange,
  onBind,
  onUnbind,
  open,
  qrCodeDataUrl,
  showBindAction,
  showManagementState,
  statusText,
}: TWeChatBindingDialogProps) {
  const localize = useLocalize();

  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      <OGDialogContent className="w-11/12 max-w-md">
        <OGDialogHeader>
          <OGDialogTitle>{localize('com_ui_wechat_qr_title')}</OGDialogTitle>
        </OGDialogHeader>
        {showManagementState ? (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">{statusText}</p>
            {connectedAccount ? (
              <p className="text-sm text-text-secondary">
                {localize('com_ui_wechat_connected_account')}: {connectedAccount}
              </p>
            ) : null}
            <div className="flex items-center justify-end gap-2">
              {showBindAction ? (
                <Button
                  aria-label={localize('com_ui_wechat_bind')}
                  disabled={isBusy}
                  onClick={onBind}
                >
                  {localize('com_ui_wechat_bind')}
                </Button>
              ) : null}
              {hasBinding ? (
                <Button
                  aria-label={localize('com_ui_wechat_unbind')}
                  disabled={isBusy}
                  onClick={onUnbind}
                  variant="destructive"
                >
                  {localize('com_ui_wechat_unbind')}
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">{localize('com_ui_wechat_qr_help')}</p>
            {qrCodeDataUrl == null ? (
              <p className="text-sm text-text-secondary">{localize('com_ui_initializing')}</p>
            ) : null}
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
                  marginSize={2}
                  size={240}
                  title={localize('com_ui_wechat_qr_title')}
                />
              </div>
            ) : null}
          </div>
        )}
      </OGDialogContent>
    </OGDialog>
  );
}

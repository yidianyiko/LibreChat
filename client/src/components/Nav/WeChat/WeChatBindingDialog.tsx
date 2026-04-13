import { QRCodeSVG } from 'qrcode.react';
import {
  OGDialog,
  OGDialogContent,
  OGDialogHeader,
  OGDialogTitle,
} from '@librechat/client';
import { useLocalize } from '~/hooks';

type TWeChatBindingDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  qrCodeDataUrl: string | null;
};

function shouldRenderQrImage(value: string | null): value is string {
  return typeof value === 'string' && value.startsWith('data:image/');
}

export default function WeChatBindingDialog({
  onOpenChange,
  open,
  qrCodeDataUrl,
}: TWeChatBindingDialogProps) {
  const localize = useLocalize();

  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      <OGDialogContent className="w-11/12 max-w-md">
        <OGDialogHeader>
          <OGDialogTitle>{localize('com_ui_wechat_qr_title')}</OGDialogTitle>
        </OGDialogHeader>
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
      </OGDialogContent>
    </OGDialog>
  );
}

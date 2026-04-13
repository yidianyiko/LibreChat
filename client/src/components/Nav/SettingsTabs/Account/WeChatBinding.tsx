import { Button, Label } from '@librechat/client';
import { useWeChatBindingFlow } from '../../WeChat/useWeChatBindingFlow';
import WeChatBindingDialog from '../../WeChat/WeChatBindingDialog';
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

export default function WeChatBinding() {
  const localize = useLocalize();
  const {
    bindSessionId,
    bindStartMutation,
    connectedAccount,
    hasBinding,
    isBusy,
    isDialogOpen,
    onDialogOpenChange,
    openDialog,
    qrCodeDataUrl,
    showBindAction,
    startBinding,
    status,
    unbindMutation,
  } = useWeChatBindingFlow();
  const showManagementState =
    status != null &&
    bindSessionId == null &&
    qrCodeDataUrl == null &&
    !bindStartMutation.isLoading;
  const statusText = getWeChatStatusText(status, localize);

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <Label id="wechat-binding-label">{localize('com_nav_wechat_binding')}</Label>
          <p className="text-xs text-text-secondary">{statusText}</p>
          {connectedAccount ? (
            <p className="text-xs text-text-secondary">
              {localize('com_ui_wechat_connected_account')}: {connectedAccount}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {showBindAction ? (
            <Button
              aria-label={localize('com_ui_wechat_bind')}
              disabled={isBusy}
              onClick={() => {
                openDialog();
                startBinding();
              }}
            >
              {localize('com_ui_wechat_bind')}
            </Button>
          ) : null}
          {hasBinding ? (
            <Button
              aria-label={localize('com_ui_wechat_unbind')}
              disabled={isBusy}
              onClick={() => unbindMutation.mutate()}
              variant="destructive"
            >
              {localize('com_ui_wechat_unbind')}
            </Button>
          ) : null}
        </div>
      </div>
      <WeChatBindingDialog
        connectedAccount={connectedAccount}
        hasBinding={hasBinding}
        isBusy={isBusy}
        onBind={startBinding}
        onOpenChange={onDialogOpenChange}
        onUnbind={() => unbindMutation.mutate()}
        open={isDialogOpen}
        qrCodeDataUrl={qrCodeDataUrl}
        showBindAction={showBindAction}
        showManagementState={showManagementState}
        statusText={statusText}
      />
    </>
  );
}

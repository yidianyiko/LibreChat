import { Button } from '@librechat/client';
import { useLocalize } from '~/hooks';
import { useWeChatBindingFlow } from './useWeChatBindingFlow';
import WeChatBindingDialog from './WeChatBindingDialog';

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

export default function WeChatQuickAction() {
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
  } = useWeChatBindingFlow({ autoStartOnOpen: true });
  const showManagementState =
    hasBinding && bindSessionId == null && qrCodeDataUrl == null && !bindStartMutation.isLoading;
  const statusText = getWeChatStatusText(status, localize);

  return (
    <>
      <Button aria-label={localize('com_nav_wechat_binding')} onClick={openDialog}>
        {localize('com_nav_wechat_binding')}
      </Button>
      <WeChatBindingDialog
        open={isDialogOpen}
        onOpenChange={onDialogOpenChange}
        connectedAccount={connectedAccount}
        hasBinding={hasBinding}
        isBusy={isBusy}
        onBind={startBinding}
        onUnbind={() => unbindMutation.mutate()}
        qrCodeDataUrl={qrCodeDataUrl}
        showBindAction={showBindAction}
        showManagementState={showManagementState}
        statusText={statusText}
      />
    </>
  );
}

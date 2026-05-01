import { Button } from '@librechat/client';
import { useLocalize } from '~/hooks';
import { useWeChatBindingFlow } from './useWeChatBindingFlow';
import WeChatBindingDialog from './WeChatBindingDialog';

function WeChatIcon() {
  return (
    <svg
      aria-hidden="true"
      className="icon-md flex-shrink-0 text-[#07C160]"
      fill="currentColor"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d="M9.23 4C5.24 4 2 6.76 2 10.17c0 1.95 1.04 3.69 2.66 4.83l-.82 3.12 3.28-1.65c.69.16 1.4.24 2.11.24 3.99 0 7.23-2.76 7.23-6.17S13.22 4 9.23 4Z" />
      <path d="M15.88 9.11c-3.38 0-6.12 2.34-6.12 5.23 0 1.53.77 2.94 2.1 3.93l-.53 2.73 2.83-1.41c.57.11 1.14.16 1.72.16 3.38 0 6.12-2.34 6.12-5.23s-2.74-5.41-6.12-5.41Z" />
      <circle cx="7.16" cy="9.69" r="0.82" fill="white" />
      <circle cx="11.18" cy="9.69" r="0.82" fill="white" />
      <circle cx="13.83" cy="14.28" r="0.74" fill="white" />
      <circle cx="17.42" cy="14.28" r="0.74" fill="white" />
    </svg>
  );
}

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
  } = useWeChatBindingFlow({ autoStartOnOpen: true, lazyStatusQuery: true });
  const showManagementState =
    status != null &&
    bindSessionId == null &&
    qrCodeDataUrl == null &&
    !bindStartMutation.isLoading;
  const statusText = getWeChatStatusText(status, localize);

  return (
    <>
      <Button aria-label={localize('com_nav_wechat_binding')} onClick={openDialog}>
        <WeChatIcon />
        <span>{localize('com_nav_wechat_binding')}</span>
      </Button>
      <WeChatBindingDialog
        open={isDialogOpen}
        onOpenChange={onDialogOpenChange}
        connectedAccount={connectedAccount}
        hasBinding={hasBinding}
        isBusy={isBusy}
        onBind={startBinding}
        onUnbind={() => unbindMutation.mutate(undefined)}
        qrCodeDataUrl={qrCodeDataUrl}
        showBindAction={showBindAction}
        showManagementState={showManagementState}
        statusText={statusText}
      />
    </>
  );
}

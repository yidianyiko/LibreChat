import { Button } from '@librechat/client';
import { useLocalize } from '~/hooks';
import { useWeChatBindingFlow } from './useWeChatBindingFlow';
import WeChatBindingDialog from './WeChatBindingDialog';

export default function WeChatQuickAction() {
  const localize = useLocalize();
  const { isDialogOpen, onDialogOpenChange, openDialog, qrCodeDataUrl } = useWeChatBindingFlow({
    autoStartOnOpen: true,
  });

  return (
    <>
      <Button aria-label={localize('com_nav_wechat_binding')} onClick={openDialog}>
        {localize('com_nav_wechat_binding')}
      </Button>
      <WeChatBindingDialog
        open={isDialogOpen}
        onOpenChange={onDialogOpenChange}
        qrCodeDataUrl={qrCodeDataUrl}
      />
    </>
  );
}

import { useEffect, useState } from 'react';
import { Button } from '@librechat/client';
import useLocalize from '~/hooks/useLocalize';
import { applyPWAUpdate, PWA_UPDATE_AVAILABLE_EVENT } from '~/utils/pwaUpdate';

export default function PWAUpdatePrompt() {
  const localize = useLocalize();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleUpdateAvailable = () => setIsVisible(true);

    window.addEventListener(PWA_UPDATE_AVAILABLE_EVENT, handleUpdateAvailable);

    return () => {
      window.removeEventListener(PWA_UPDATE_AVAILABLE_EVENT, handleUpdateAvailable);
    };
  }, []);

  if (!isVisible) {
    return null;
  }

  const handleRefresh = async () => {
    await applyPWAUpdate();
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[1010] flex justify-center px-4">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex w-full max-w-xl items-center justify-between gap-4 rounded-xl border border-border-light bg-surface-primary px-4 py-3 shadow-lg"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary">
            {localize('com_ui_update_available_title')}
          </p>
          <p className="text-sm text-text-secondary">
            {localize('com_ui_update_available_description')}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" onClick={() => setIsVisible(false)}>
            {localize('com_ui_cancel')}
          </Button>
          <Button onClick={() => void handleRefresh()}>{localize('com_ui_refresh_page')}</Button>
        </div>
      </div>
    </div>
  );
}

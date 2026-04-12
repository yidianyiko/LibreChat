export const PWA_UPDATE_AVAILABLE_EVENT = 'librechat:pwa-update-available';

type UpdateSW = (reloadPage?: boolean) => Promise<void>;

type RegisterSWOptions = {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
};

type RegisterSW = (options: RegisterSWOptions) => UpdateSW;

let updateServiceWorker: UpdateSW | null = null;

export function notifyPWAUpdateAvailable() {
  window.dispatchEvent(new Event(PWA_UPDATE_AVAILABLE_EVENT));
}

export function initializePWAUpdateRegistration(registerSW: RegisterSW) {
  updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh: notifyPWAUpdateAvailable,
    onOfflineReady: () => undefined,
  });
}

export async function applyPWAUpdate() {
  if (updateServiceWorker) {
    await updateServiceWorker(true);
    return;
  }

  window.location.reload();
}

export function isDynamicImportFailure(reason: unknown) {
  if (!(reason instanceof Error)) {
    return false;
  }

  return reason.message.includes('Failed to fetch dynamically imported module');
}

export function handlePWAUnhandledRejection(reason: unknown) {
  if (!isDynamicImportFailure(reason)) {
    return false;
  }

  notifyPWAUpdateAvailable();
  return true;
}

export function resetPWAUpdateStateForTests() {
  updateServiceWorker = null;
}

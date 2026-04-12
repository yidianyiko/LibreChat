import {
  PWA_UPDATE_AVAILABLE_EVENT,
  applyPWAUpdate,
  handlePWAUnhandledRejection,
  initializePWAUpdateRegistration,
  resetPWAUpdateStateForTests,
} from '../pwaUpdate';

type RegisterSWOptions = {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
};

type RegisterSW = (options: RegisterSWOptions) => (reloadPage?: boolean) => Promise<void>;

describe('pwaUpdate', () => {
  beforeEach(() => {
    resetPWAUpdateStateForTests();
  });

  it('dispatches an update event when the service worker reports new content', () => {
    let capturedOptions: RegisterSWOptions | undefined;
    const updateSW = jest.fn().mockResolvedValue(undefined);
    const registerSW = jest.fn<ReturnType<RegisterSW>, Parameters<RegisterSW>>((options) => {
      capturedOptions = options;
      return updateSW;
    });
    const onUpdateAvailable = jest.fn();

    window.addEventListener(PWA_UPDATE_AVAILABLE_EVENT, onUpdateAvailable);

    initializePWAUpdateRegistration(registerSW);
    capturedOptions?.onNeedRefresh?.();

    expect(registerSW).toHaveBeenCalledTimes(1);
    expect(capturedOptions?.immediate).toBe(true);
    expect(onUpdateAvailable).toHaveBeenCalledTimes(1);
  });

  it('applies the stored service worker update only when explicitly requested', async () => {
    const updateSW = jest.fn().mockResolvedValue(undefined);
    const registerSW: RegisterSW = () => updateSW;

    initializePWAUpdateRegistration(registerSW);
    expect(updateSW).not.toHaveBeenCalled();

    await applyPWAUpdate();

    expect(updateSW).toHaveBeenCalledWith(true);
  });

  it('routes dynamic import failures into the update prompt flow', () => {
    const onUpdateAvailable = jest.fn();

    window.addEventListener(PWA_UPDATE_AVAILABLE_EVENT, onUpdateAvailable);

    const handled = handlePWAUnhandledRejection(
      new Error('Failed to fetch dynamically imported module: /assets/ChatRoute.oldhash.js'),
    );

    expect(handled).toBe(true);
    expect(onUpdateAvailable).toHaveBeenCalledTimes(1);
  });

  it('ignores unrelated promise rejection errors', () => {
    const onUpdateAvailable = jest.fn();

    window.addEventListener(PWA_UPDATE_AVAILABLE_EVENT, onUpdateAvailable);

    const handled = handlePWAUnhandledRejection(new Error('Network request failed'));

    expect(handled).toBe(false);
    expect(onUpdateAvailable).not.toHaveBeenCalled();
  });
});

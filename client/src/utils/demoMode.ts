export const isDemoMode = () =>
  typeof globalThis !== 'undefined' &&
  (globalThis as { __LIBRECHAT_DEMO_MODE__?: boolean }).__LIBRECHAT_DEMO_MODE__ === true;

export const initializeDemoMode = () => {
  if (typeof window !== 'undefined') {
    window.__LIBRECHAT_DEMO_MODE__ = import.meta.env.VITE_DEMO_MODE === 'true';
  }
};

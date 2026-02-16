declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

type ScheduleOptions = {
  delayMs?: number;
};

const ANALYTICS_SCRIPT_SELECTOR = 'script[data-analytics-loader="ga4"]';

export function loadGoogleAnalytics(measurementId?: string): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  if (!measurementId) {
    return false;
  }

  if (document.querySelector(ANALYTICS_SCRIPT_SELECTOR) != null || typeof window.gtag === 'function') {
    return false;
  }

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  script.dataset.analyticsLoader = 'ga4';
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = (...args: unknown[]) => {
    window.dataLayer?.push(args);
  };

  window.gtag('js', new Date());
  window.gtag('config', measurementId);

  return true;
}

export function scheduleGoogleAnalyticsLoad(
  measurementId?: string,
  options: ScheduleOptions = {},
): void {
  if (!measurementId || typeof window === 'undefined') {
    return;
  }

  const delayMs = options.delayMs ?? 2500;
  window.setTimeout(() => {
    loadGoogleAnalytics(measurementId);
  }, delayMs);
}

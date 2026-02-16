import * as analyticsLoader from '../analyticsLoader';

describe('analyticsLoader', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    // @ts-expect-error test cleanup
    delete window.dataLayer;
    // @ts-expect-error test cleanup
    delete window.gtag;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should not load analytics when measurement id is empty', () => {
    const loaded = analyticsLoader.loadGoogleAnalytics('');
    expect(loaded).toBe(false);
    expect(document.querySelector('script[src*="googletagmanager.com/gtag/js"]')).toBeNull();
  });

  it('should inject analytics script only once', () => {
    const loadedFirst = analyticsLoader.loadGoogleAnalytics('G-TEST123');
    const loadedSecond = analyticsLoader.loadGoogleAnalytics('G-TEST123');

    expect(loadedFirst).toBe(true);
    expect(loadedSecond).toBe(false);
    expect(document.querySelectorAll('script[src*="googletagmanager.com/gtag/js"]').length).toBe(1);
  });

  it('should schedule analytics loading with delay', () => {
    analyticsLoader.scheduleGoogleAnalyticsLoad('G-TEST123', { delayMs: 1500 });

    expect(document.querySelector('script[src*="googletagmanager.com/gtag/js"]')).toBeNull();
    jest.advanceTimersByTime(1500);
    expect(document.querySelector('script[src*="googletagmanager.com/gtag/js"]')).not.toBeNull();
  });
});

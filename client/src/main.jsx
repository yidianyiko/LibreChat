import 'regenerator-runtime/runtime';
import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';
import './mobile.css';
import { ApiErrorBoundaryProvider } from './hooks/ApiErrorBoundaryContext';
import { initializeI18n } from './locales/i18n';
import { scheduleGoogleAnalyticsLoad } from './utils/analyticsLoader';
import 'katex/dist/katex.min.css';
import 'katex/dist/contrib/copy-tex.js';

const DEFAULT_GA_MEASUREMENT_ID = 'G-5EWVZE1XVD';

const bootstrap = async () => {
  await initializeI18n();

  const container = document.getElementById('root');
  const root = createRoot(container);

  root.render(
    <ApiErrorBoundaryProvider>
      <App />
    </ApiErrorBoundaryProvider>,
  );

  if (import.meta.env.PROD) {
    scheduleGoogleAnalyticsLoad(import.meta.env.VITE_GA_MEASUREMENT_ID ?? DEFAULT_GA_MEASUREMENT_ID);
  }

  // Service Worker 自动刷新逻辑：当检测到新版本时自动刷新页面
  if ('serviceWorker' in navigator) {
    let refreshing = false;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }
};

void bootstrap();

import 'regenerator-runtime/runtime';
import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';
import './mobile.css';
import { ApiErrorBoundaryProvider } from './hooks/ApiErrorBoundaryContext';
import { initializeDemoMode } from './utils/demoMode';
import { initializeI18n } from './locales/i18n';
import { scheduleGoogleAnalyticsLoad } from './utils/analyticsLoader';
import 'katex/dist/katex.min.css';
import 'katex/dist/contrib/copy-tex.js';

const DEFAULT_GA_MEASUREMENT_ID = 'G-5EWVZE1XVD';

const bootstrap = async () => {
  initializeDemoMode();
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
};

void bootstrap();

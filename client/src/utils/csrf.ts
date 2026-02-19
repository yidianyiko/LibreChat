/**
 * CSRF Token Integration for Frontend
 *
 * This module provides CSRF token handling that:
 * 1. Only activates when CSRF is enabled on the server
 * 2. Automatically fetches and caches CSRF tokens
 * 3. Adds tokens to state-changing requests (POST, PUT, DELETE, PATCH)
 *
 * Usage:
 *   import { initCSRFProtection } from './csrf';
 *   initCSRFProtection(); // Call once at app startup
 */

import axios from 'axios';

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

/**
 * Get CSRF token from cookie
 */
export function getCSRFToken(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === CSRF_COOKIE_NAME) {
      return decodeURIComponent(value);
    }
  }
  return null;
}

/**
 * Check if a request method requires CSRF protection
 */
function isStateChangingMethod(method: string): boolean {
  const methodsToProtect = ['post', 'put', 'delete', 'patch'];
  return methodsToProtect.includes(method.toLowerCase());
}

/**
 * Fetch a fresh CSRF token from the server
 * Returns null if CSRF is not enabled on the server
 */
export async function fetchCSRFToken(): Promise<string | null> {
  try {
    const response = await axios.get('/api/csrf-token');
    if (response.data.enabled) {
      return response.data.token;
    }
    return null;
  } catch (error) {
    console.warn('[CSRF] Failed to fetch CSRF token:', error);
    return null;
  }
}

/**
 * Initialize CSRF protection
 * Adds an axios interceptor that automatically includes CSRF tokens
 *
 * @returns A cleanup function to remove the interceptor
 */
export function initCSRFProtection(): () => void {
  const interceptorId = axios.interceptors.request.use(
    (config) => {
      // Only add CSRF token for state-changing requests
      if (config.method && isStateChangingMethod(config.method)) {
        const token = getCSRFToken();
        if (token) {
          config.headers.set(CSRF_HEADER_NAME, token);
        }
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    },
  );

  // Add response interceptor to handle CSRF token errors
  const responseInterceptorId = axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      // If we get a 403 with CSRF error, try to refresh the token
      if (error.response?.status === 403 && error.response?.data?.message?.includes('CSRF')) {
        console.warn('[CSRF] Token validation failed, fetching new token...');

        // Fetch a new token
        const newToken = await fetchCSRFToken();

        if (newToken && error.config && !error.config._csrfRetry) {
          // Retry the original request with the new token
          error.config._csrfRetry = true;
          error.config.headers.set(CSRF_HEADER_NAME, newToken);
          return axios(error.config);
        }
      }

      return Promise.reject(error);
    },
  );

  // Return cleanup function
  return () => {
    axios.interceptors.request.eject(interceptorId);
    axios.interceptors.response.eject(responseInterceptorId);
  };
}

/**
 * Check if CSRF protection is enabled on the server
 */
export async function isCSRFEnabled(): Promise<boolean> {
  try {
    const response = await axios.get('/api/csrf-token');
    return response.data.enabled === true;
  } catch {
    return false;
  }
}

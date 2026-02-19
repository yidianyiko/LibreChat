/**
 * CSRF Protection Middleware using Double Submit Cookie Pattern
 *
 * This middleware provides CSRF protection that:
 * 1. Is disabled by default (enable via ENABLE_CSRF=true)
 * 2. Exempts certain paths (webhooks, health checks)
 * 3. Only protects state-changing methods (POST, PUT, DELETE, PATCH)
 * 4. Works with SPA applications using the Double Submit Cookie pattern
 */

const crypto = require('crypto');
const { logger } = require('@librechat/data-schemas');

// Configuration
const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_TOKEN_LENGTH = 32;

// Paths that should be exempt from CSRF protection
const EXEMPT_PATHS = [
  '/api/recharge/webhook', // Stripe webhook - verified by Stripe signature
  '/health', // Health check endpoint
  '/oauth', // OAuth callbacks
];

// Path prefixes that should be exempt
const EXEMPT_PATH_PREFIXES = [
  '/oauth/', // All OAuth routes
];

/**
 * Check if CSRF protection is enabled via environment variable
 */
const isCSRFEnabled = () => {
  return process.env.ENABLE_CSRF === 'true';
};

/**
 * Check if a path should be exempt from CSRF protection
 */
const isExemptPath = (path) => {
  // Check exact matches
  if (EXEMPT_PATHS.includes(path)) {
    return true;
  }

  // Check prefix matches
  for (const prefix of EXEMPT_PATH_PREFIXES) {
    if (path.startsWith(prefix)) {
      return true;
    }
  }

  return false;
};

/**
 * Generate a cryptographically secure CSRF token
 */
const generateCSRFToken = () => {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
};

/**
 * Timing-safe comparison of tokens
 */
const verifyToken = (token1, token2) => {
  if (!token1 || !token2) {
    return false;
  }

  try {
    // Ensure both are strings of the same length
    const t1 = String(token1);
    const t2 = String(token2);

    if (t1.length !== t2.length) {
      return false;
    }

    return crypto.timingSafeEqual(Buffer.from(t1), Buffer.from(t2));
  } catch {
    return false;
  }
};

/**
 * Middleware to set CSRF token cookie
 * Should be called on initial page load or login
 */
const setCSRFToken = (req, res, next) => {
  if (!isCSRFEnabled()) {
    return next();
  }

  // Only set if not already present or if it's a fresh session
  if (!req.cookies[CSRF_COOKIE_NAME]) {
    const token = generateCSRFToken();
    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false, // Must be readable by JavaScript
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
    });
  }

  next();
};

/**
 * Middleware to verify CSRF token
 * Compares the token from cookie with the token from header
 */
const verifyCSRFToken = (req, res, next) => {
  // Skip if CSRF protection is disabled
  if (!isCSRFEnabled()) {
    return next();
  }

  // Only check state-changing methods
  const methodsToProtect = ['POST', 'PUT', 'DELETE', 'PATCH'];
  if (!methodsToProtect.includes(req.method)) {
    return next();
  }

  // Check if path is exempt
  if (isExemptPath(req.path)) {
    return next();
  }

  // Get tokens
  const cookieToken = req.cookies[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME];

  // Verify tokens match
  if (!verifyToken(cookieToken, headerToken)) {
    logger.warn('[CSRF] Token validation failed', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      hasCookie: !!cookieToken,
      hasHeader: !!headerToken,
    });

    return res.status(403).json({
      message: 'CSRF token validation failed',
      error: 'Invalid or missing CSRF token',
    });
  }

  next();
};

/**
 * Endpoint handler to get a fresh CSRF token
 * Frontend can call this to get a new token
 */
const getCSRFToken = (req, res) => {
  if (!isCSRFEnabled()) {
    return res.json({
      enabled: false,
      message: 'CSRF protection is not enabled',
    });
  }

  const token = generateCSRFToken();
  const isProduction = process.env.NODE_ENV === 'production';

  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  });

  res.json({
    enabled: true,
    token,
    headerName: CSRF_HEADER_NAME,
    message: 'Include this token in the X-CSRF-Token header for all state-changing requests',
  });
};

module.exports = {
  setCSRFToken,
  verifyCSRFToken,
  getCSRFToken,
  isCSRFEnabled,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
};

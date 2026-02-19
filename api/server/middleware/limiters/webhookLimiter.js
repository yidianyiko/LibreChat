const rateLimit = require('express-rate-limit');
const { limiterCache } = require('@librechat/api');
const { logger } = require('~/config');

/**
 * Webhook Rate Limiter
 *
 * Protects webhook endpoints from abuse while allowing legitimate traffic.
 * Default: 100 requests per minute per IP (generous for legitimate services)
 *
 * Note: Stripe has retry logic built-in, so we don't want to be too restrictive.
 * If a webhook is rate-limited, Stripe will retry with exponential backoff.
 */
const {
  WEBHOOK_WINDOW = 1, // 1 minute
  WEBHOOK_MAX = 100, // 100 requests per minute
} = process.env;

const windowMs = WEBHOOK_WINDOW * 60 * 1000;
const max = parseInt(WEBHOOK_MAX, 10);
const windowInMinutes = windowMs / 60000;

const handler = async (req, res) => {
  logger.warn('[WebhookLimiter] Rate limit exceeded', {
    ip: req.ip,
    path: req.path,
    userAgent: req.get('user-agent'),
  });

  return res.status(429).json({
    message: `Too many webhook requests, please try again after ${windowInMinutes} minute(s)`,
    retryAfter: windowMs / 1000,
  });
};

const limiterOptions = {
  windowMs,
  max,
  handler,
  // Skip rate limiting for requests with valid Stripe signature (they're already authenticated)
  skip: (req) => {
    // If the request has a valid Stripe signature header, we can be more lenient
    // The actual signature verification happens in the route handler
    return false; // Don't skip for now, let all requests go through the limiter
  },
  // Use default keyGenerator which properly handles IPv6 addresses
  store: limiterCache('webhook_limiter'),
  // Don't count successful requests against the limit
  skipSuccessfulRequests: false,
  // Include headers in response
  standardHeaders: true,
  legacyHeaders: false,
  // Validate option to allow the default IP-based keyGenerator
  validate: { xForwardedForHeader: false },
};

const webhookLimiter = rateLimit(limiterOptions);

module.exports = webhookLimiter;

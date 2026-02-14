const { z } = require('zod');

const MIN_PASSWORD_LENGTH = parseInt(process.env.MIN_PASSWORD_LENGTH, 10) || 6;

// Password complexity requirements (disabled by default for better user experience)
const REQUIRE_PASSWORD_COMPLEXITY = process.env.REQUIRE_PASSWORD_COMPLEXITY === 'true';

const allowedCharactersRegex = new RegExp(
  '^[' +
    'a-zA-Z0-9_.@#$%&*()' + // Basic Latin characters and symbols
    '\\p{Script=Latin}' + // Latin script characters
    '\\p{Script=Common}' + // Characters common across scripts
    '\\p{Script=Cyrillic}' + // Cyrillic script for Russian, etc.
    '\\p{Script=Devanagari}' + // Devanagari script for Hindi, etc.
    '\\p{Script=Han}' + // Han script for Chinese characters, etc.
    '\\p{Script=Arabic}' + // Arabic script
    '\\p{Script=Hiragana}' + // Hiragana script for Japanese
    '\\p{Script=Katakana}' + // Katakana script for Japanese
    '\\p{Script=Hangul}' + // Hangul script for Korean
    ']+$', // End of string
  'u', // Use Unicode mode
);
const injectionPatternsRegex = /('|--|\$ne|\$gt|\$lt|\$or|\{|\}|\*|;|<|>|\/|=)/i;

/**
 * Password complexity validation
 * Requires at least: 1 uppercase, 1 lowercase, 1 number, 1 special character
 */
const passwordComplexityCheck = (password) => {
  if (!REQUIRE_PASSWORD_COMPLEXITY) {
    return { valid: true, errors: [] };
  }

  const errors = [];

  // Check for uppercase letter
  if (!/[A-Z]/.test(password)) {
    errors.push('at least one uppercase letter');
  }

  // Check for lowercase letter
  if (!/[a-z]/.test(password)) {
    errors.push('at least one lowercase letter');
  }

  // Check for number
  if (!/[0-9]/.test(password)) {
    errors.push('at least one number');
  }

  // Check for special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
    errors.push('at least one special character (!@#$%^&*()_+-=[]{};\':"|,.<>/?`~)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Create password schema with optional complexity validation
 */
const createPasswordSchema = () => {
  let schema = z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
    .max(128, 'Password must be at most 128 characters')
    .refine((value) => value.trim().length > 0, {
      message: 'Password cannot be only spaces',
    });

  // Add complexity check if enabled
  if (REQUIRE_PASSWORD_COMPLEXITY) {
    schema = schema.refine(
      (value) => passwordComplexityCheck(value).valid,
      (value) => {
        const { errors } = passwordComplexityCheck(value);
        return {
          message: `Password must contain ${errors.join(', ')}`,
        };
      },
    );
  }

  return schema;
};

const usernameSchema = z
  .string()
  .min(2)
  .max(80)
  .refine((value) => allowedCharactersRegex.test(value), {
    message: 'Invalid characters in username',
  })
  .refine((value) => !injectionPatternsRegex.test(value), {
    message: 'Potential injection attack detected',
  });

const passwordSchema = createPasswordSchema();

const loginSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH)
    .max(128)
    .refine((value) => value.trim().length > 0, {
      message: 'Password cannot be only spaces',
    }),
});

const registerSchema = z
  .object({
    name: z.string().min(3).max(80),
    username: z
      .union([z.literal(''), usernameSchema])
      .transform((value) => (value === '' ? null : value))
      .optional()
      .nullable(),
    email: z.string().email(),
    password: passwordSchema,
    confirm_password: passwordSchema,
  })
  .superRefine(({ confirm_password, password }, ctx) => {
    if (confirm_password !== password) {
      ctx.addIssue({
        code: 'custom',
        message: 'The passwords did not match',
      });
    }
  });

module.exports = {
  loginSchema,
  registerSchema,
  passwordComplexityCheck,
  REQUIRE_PASSWORD_COMPLEXITY,
};

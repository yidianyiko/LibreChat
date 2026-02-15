# Token Pricing Database Configuration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move token pricing from hardcoded `tx.js` values into a MongoDB collection with admin CRUD UI, while keeping `tx.js` as fallback, and ensuring the existing model selector inline rate display works with DB-sourced rates.

**Architecture:** New `TokenPricing` Mongoose model stores per-model rates. A `TokenPricingCache` singleton loads all records on startup and invalidates on admin writes. `tx.js` functions (`getMultiplier`, `getCacheMultiplier`, `getPremiumRate`) are modified to check the cache first, falling back to hardcoded values. Admin Panel gets a new "Token Pricing" page under `/d/token-pricing`. The existing `GET /api/models/rates` endpoint automatically serves DB rates because it already calls `getMultiplier()`.

**Tech Stack:** MongoDB/Mongoose, Express.js, React 18, TypeScript, TanStack Query, Tailwind CSS

---

## Task 1: Create TokenPricing Schema & Model

**Files:**
- Create: `packages/data-schemas/src/schema/tokenPricing.ts`
- Create: `packages/data-schemas/src/models/tokenPricing.ts`
- Modify: `packages/data-schemas/src/schema/index.ts`
- Modify: `packages/data-schemas/src/models/index.ts`
- Create: `packages/data-schemas/src/types/tokenPricing.ts`
- Modify: `api/db/models.js` (auto — via `createModels`)
- Test: `packages/data-schemas/src/schema/__tests__/tokenPricing.spec.ts`

### Step 1: Write the failing test

```typescript
// packages/data-schemas/src/schema/__tests__/tokenPricing.spec.ts
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import tokenPricingSchema from '../tokenPricing';

let mongoServer: MongoMemoryServer;
let TokenPricing: mongoose.Model<any>;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  TokenPricing = mongoose.model('TokenPricing', tokenPricingSchema);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await TokenPricing.deleteMany({});
});

describe('TokenPricing schema', () => {
  it('should create a valid token pricing record', async () => {
    const doc = await TokenPricing.create({
      modelPattern: 'gpt-4o',
      provider: 'openai',
      inputRate: 2.5,
      outputRate: 10,
    });
    expect(doc.modelPattern).toBe('gpt-4o');
    expect(doc.provider).toBe('openai');
    expect(doc.inputRate).toBe(2.5);
    expect(doc.outputRate).toBe(10);
    expect(doc.isActive).toBe(true);
  });

  it('should enforce unique modelPattern', async () => {
    await TokenPricing.create({
      modelPattern: 'gpt-4o',
      provider: 'openai',
      inputRate: 2.5,
      outputRate: 10,
    });
    await expect(
      TokenPricing.create({
        modelPattern: 'gpt-4o',
        provider: 'openai',
        inputRate: 5,
        outputRate: 15,
      }),
    ).rejects.toThrow();
  });

  it('should require modelPattern, provider, inputRate, outputRate', async () => {
    await expect(TokenPricing.create({})).rejects.toThrow();
    await expect(TokenPricing.create({ modelPattern: 'x' })).rejects.toThrow();
  });

  it('should store long context pricing fields', async () => {
    const doc = await TokenPricing.create({
      modelPattern: 'claude-opus-4-6',
      provider: 'anthropic',
      inputRate: 5,
      outputRate: 25,
      longContextThreshold: 200000,
      longContextInputRate: 10,
      longContextOutputRate: 37.5,
    });
    expect(doc.longContextThreshold).toBe(200000);
    expect(doc.longContextInputRate).toBe(10);
    expect(doc.longContextOutputRate).toBe(37.5);
  });
});
```

### Step 2: Run test to verify it fails

```bash
cd packages/data-schemas && npx jest src/schema/__tests__/tokenPricing.spec.ts --no-cache
```

Expected: FAIL — module not found

### Step 3: Write the schema

```typescript
// packages/data-schemas/src/schema/tokenPricing.ts
import { Schema } from 'mongoose';

export interface ITokenPricing {
  modelPattern: string;
  provider: string;
  inputRate: number;
  outputRate: number;
  longContextThreshold?: number;
  longContextInputRate?: number;
  longContextOutputRate?: number;
  isActive: boolean;
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const tokenPricingSchema = new Schema<ITokenPricing>(
  {
    modelPattern: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    provider: {
      type: String,
      required: true,
      index: true,
    },
    inputRate: {
      type: Number,
      required: true,
    },
    outputRate: {
      type: Number,
      required: true,
    },
    longContextThreshold: {
      type: Number,
    },
    longContextInputRate: {
      type: Number,
    },
    longContextOutputRate: {
      type: Number,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

export default tokenPricingSchema;
```

### Step 4: Write the model factory

```typescript
// packages/data-schemas/src/models/tokenPricing.ts
import tokenPricingSchema from '~/schema/tokenPricing';
import type { ITokenPricing } from '~/schema/tokenPricing';

export function createTokenPricingModel(mongoose: typeof import('mongoose')) {
  return (
    mongoose.models.TokenPricing ||
    mongoose.model<ITokenPricing>('TokenPricing', tokenPricingSchema)
  );
}
```

### Step 5: Register in schema and model indexes

Add to `packages/data-schemas/src/schema/index.ts`:

```typescript
export { default as tokenPricingSchema } from './tokenPricing';
```

Add to `packages/data-schemas/src/models/index.ts`:

```typescript
import { createTokenPricingModel } from './tokenPricing';
// ... in createModels():
TokenPricing: createTokenPricingModel(mongoose),
```

### Step 6: Export the type

```typescript
// packages/data-schemas/src/types/tokenPricing.ts
export type { ITokenPricing } from '~/schema/tokenPricing';
```

Ensure this type is re-exported from the package's main types barrel (check `packages/data-schemas/src/types/index.ts`).

### Step 7: Build and run test

```bash
npm run build:data-schemas
cd packages/data-schemas && npx jest src/schema/__tests__/tokenPricing.spec.ts --no-cache
```

Expected: PASS

### Step 8: Commit

```bash
git add packages/data-schemas/src/schema/tokenPricing.ts \
       packages/data-schemas/src/models/tokenPricing.ts \
       packages/data-schemas/src/schema/index.ts \
       packages/data-schemas/src/models/index.ts \
       packages/data-schemas/src/types/tokenPricing.ts \
       packages/data-schemas/src/schema/__tests__/tokenPricing.spec.ts
git commit -m "feat: add TokenPricing schema and model for database-managed token rates"
```

---

## Task 2: Create TokenPricingCache Singleton

**Files:**
- Create: `api/server/services/TokenPricingCache.js`
- Test: `api/server/services/__tests__/TokenPricingCache.spec.js`

### Step 1: Write the failing test

```javascript
// api/server/services/__tests__/TokenPricingCache.spec.js
const { TokenPricingCache } = require('../TokenPricingCache');

// Mock the TokenPricing model
const mockFind = jest.fn();
jest.mock('~/db/models', () => ({
  TokenPricing: { find: (...args) => mockFind(...args) },
}));

describe('TokenPricingCache', () => {
  let cache;

  beforeEach(() => {
    cache = new TokenPricingCache();
    mockFind.mockReset();
  });

  it('should load pricing from database', async () => {
    mockFind.mockReturnValue({
      lean: () => Promise.resolve([
        {
          modelPattern: 'gpt-4o',
          provider: 'openai',
          inputRate: 2.5,
          outputRate: 10,
          isActive: true,
        },
      ]),
    });

    await cache.load();
    const rate = cache.getRate('gpt-4o');
    expect(rate).toEqual({
      prompt: 2.5,
      completion: 10,
    });
  });

  it('should return null for unknown model', async () => {
    mockFind.mockReturnValue({ lean: () => Promise.resolve([]) });
    await cache.load();
    expect(cache.getRate('unknown-model')).toBeNull();
  });

  it('should match by pattern inclusion (like tx.js)', async () => {
    mockFind.mockReturnValue({
      lean: () => Promise.resolve([
        {
          modelPattern: 'gpt-4o',
          provider: 'openai',
          inputRate: 2.5,
          outputRate: 10,
          isActive: true,
        },
      ]),
    });

    await cache.load();
    // 'gpt-4o-2024-08-06' includes 'gpt-4o'
    const rate = cache.getRate('gpt-4o-2024-08-06');
    expect(rate).toEqual({ prompt: 2.5, completion: 10 });
  });

  it('should return long context rates when threshold exceeded', async () => {
    mockFind.mockReturnValue({
      lean: () => Promise.resolve([
        {
          modelPattern: 'claude-opus-4-6',
          provider: 'anthropic',
          inputRate: 5,
          outputRate: 25,
          longContextThreshold: 200000,
          longContextInputRate: 10,
          longContextOutputRate: 37.5,
          isActive: true,
        },
      ]),
    });

    await cache.load();

    const normal = cache.getRate('claude-opus-4-6');
    expect(normal).toEqual({ prompt: 5, completion: 25 });

    const premium = cache.getPremiumRate('claude-opus-4-6', 'prompt', 250000);
    expect(premium).toBe(10);

    const premiumOut = cache.getPremiumRate('claude-opus-4-6', 'completion', 250000);
    expect(premiumOut).toBe(37.5);
  });

  it('should return null premium rate when below threshold', async () => {
    mockFind.mockReturnValue({
      lean: () => Promise.resolve([
        {
          modelPattern: 'claude-opus-4-6',
          provider: 'anthropic',
          inputRate: 5,
          outputRate: 25,
          longContextThreshold: 200000,
          longContextInputRate: 10,
          longContextOutputRate: 37.5,
          isActive: true,
        },
      ]),
    });

    await cache.load();
    expect(cache.getPremiumRate('claude-opus-4-6', 'prompt', 100000)).toBeNull();
  });

  it('should clear cache on invalidate', async () => {
    mockFind.mockReturnValue({
      lean: () => Promise.resolve([
        {
          modelPattern: 'gpt-4o',
          provider: 'openai',
          inputRate: 2.5,
          outputRate: 10,
          isActive: true,
        },
      ]),
    });

    await cache.load();
    expect(cache.getRate('gpt-4o')).not.toBeNull();

    cache.invalidate();
    expect(cache.isLoaded()).toBe(false);
  });

  it('should auto-load on getRate if not loaded', async () => {
    mockFind.mockReturnValue({
      lean: () => Promise.resolve([
        {
          modelPattern: 'gpt-4o',
          provider: 'openai',
          inputRate: 2.5,
          outputRate: 10,
          isActive: true,
        },
      ]),
    });

    // Don't call load() — getRate should trigger it
    const rate = await cache.getRateAsync('gpt-4o');
    expect(rate).toEqual({ prompt: 2.5, completion: 10 });
    expect(mockFind).toHaveBeenCalledTimes(1);
  });
});
```

### Step 2: Run test to verify it fails

```bash
cd api && npx jest server/services/__tests__/TokenPricingCache.spec.js --no-cache
```

Expected: FAIL — module not found

### Step 3: Write the implementation

```javascript
// api/server/services/TokenPricingCache.js
const { logger } = require('~/config');

/**
 * In-memory cache for token pricing records from MongoDB.
 *
 * Pattern matching follows the same convention as tx.js:
 * records are stored sorted by modelPattern length DESC so that
 * more specific patterns (e.g. "gpt-4o-mini") are checked before
 * shorter ones (e.g. "gpt-4o") when using `includes()`.
 */
class TokenPricingCache {
  constructor() {
    /** @type {Array<{modelPattern: string, inputRate: number, outputRate: number, longContextThreshold?: number, longContextInputRate?: number, longContextOutputRate?: number}>} */
    this._records = [];
    this._loaded = false;
    this._loadPromise = null;
  }

  /**
   * Load all active pricing records from the database.
   * Safe to call multiple times — concurrent calls share the same promise.
   */
  async load() {
    if (this._loadPromise) {
      return this._loadPromise;
    }

    this._loadPromise = this._doLoad();
    try {
      await this._loadPromise;
    } finally {
      this._loadPromise = null;
    }
  }

  async _doLoad() {
    try {
      const { TokenPricing } = require('~/db/models');
      const records = await TokenPricing.find({ isActive: true }).lean();
      // Sort by pattern length DESC for most-specific-first matching
      records.sort((a, b) => b.modelPattern.length - a.modelPattern.length);
      this._records = records;
      this._loaded = true;
      logger.info(`[TokenPricingCache] Loaded ${records.length} pricing records from database`);
    } catch (error) {
      logger.error('[TokenPricingCache] Failed to load pricing from database:', error);
      this._records = [];
      this._loaded = true; // Mark loaded even on error to avoid retry loops
    }
  }

  /**
   * Find the matching record for a model name.
   * Uses `includes()` matching, most-specific-first (longest pattern first).
   * @param {string} modelName
   * @returns {object|null}
   */
  _findRecord(modelName) {
    if (!modelName || !this._loaded) {
      return null;
    }
    for (const record of this._records) {
      if (modelName.includes(record.modelPattern)) {
        return record;
      }
    }
    return null;
  }

  /**
   * Get rate synchronously (returns null if cache not loaded or model not found).
   * @param {string} modelName
   * @returns {{prompt: number, completion: number}|null}
   */
  getRate(modelName) {
    const record = this._findRecord(modelName);
    if (!record) {
      return null;
    }
    return { prompt: record.inputRate, completion: record.outputRate };
  }

  /**
   * Get rate with auto-load if needed.
   * @param {string} modelName
   * @returns {Promise<{prompt: number, completion: number}|null>}
   */
  async getRateAsync(modelName) {
    if (!this._loaded) {
      await this.load();
    }
    return this.getRate(modelName);
  }

  /**
   * Get premium (long-context) rate if applicable.
   * @param {string} modelName
   * @param {'prompt'|'completion'} tokenType
   * @param {number} inputTokenCount
   * @returns {number|null}
   */
  getPremiumRate(modelName, tokenType, inputTokenCount) {
    if (inputTokenCount == null) {
      return null;
    }
    const record = this._findRecord(modelName);
    if (!record || !record.longContextThreshold) {
      return null;
    }
    if (inputTokenCount <= record.longContextThreshold) {
      return null;
    }
    if (tokenType === 'prompt') {
      return record.longContextInputRate ?? null;
    }
    if (tokenType === 'completion') {
      return record.longContextOutputRate ?? null;
    }
    return null;
  }

  /** Clear the cache. Next access will require a reload. */
  invalidate() {
    this._records = [];
    this._loaded = false;
    this._loadPromise = null;
    logger.info('[TokenPricingCache] Cache invalidated');
  }

  /** @returns {boolean} */
  isLoaded() {
    return this._loaded;
  }

  /** Get all records (for admin API). */
  getAll() {
    return this._records;
  }
}

// Singleton
const tokenPricingCache = new TokenPricingCache();

module.exports = { TokenPricingCache, tokenPricingCache };
```

### Step 4: Run test to verify it passes

```bash
cd api && npx jest server/services/__tests__/TokenPricingCache.spec.js --no-cache
```

Expected: PASS

### Step 5: Commit

```bash
git add api/server/services/TokenPricingCache.js \
       api/server/services/__tests__/TokenPricingCache.spec.js
git commit -m "feat: add TokenPricingCache singleton for in-memory DB rate lookup"
```

---

## Task 3: Integrate Cache into tx.js Lookup

**Files:**
- Modify: `api/models/tx.js` — `getMultiplier()` and `getPremiumRate()`
- Modify: `api/server/controllers/ModelController.js` — ensure cache is loaded before rates served
- Test: `api/models/tx.spec.js` (add integration tests)

### Step 1: Write the failing test

Add a new describe block to `api/models/tx.spec.js` (or create it if it doesn't exist):

```javascript
// In api/models/tx.spec.js — add at end of file
const { tokenPricingCache } = require('~/server/services/TokenPricingCache');

describe('getMultiplier with DB cache', () => {
  afterEach(() => {
    tokenPricingCache.invalidate();
  });

  it('should use DB rate when cache has a match', async () => {
    // Simulate cache loaded with custom rate
    tokenPricingCache._records = [
      { modelPattern: 'gpt-4o', inputRate: 99, outputRate: 199, isActive: true },
    ];
    tokenPricingCache._loaded = true;

    const { getMultiplier } = require('./tx');
    const rate = getMultiplier({ model: 'gpt-4o', tokenType: 'prompt' });
    expect(rate).toBe(99);
  });

  it('should fall back to hardcoded when cache has no match', async () => {
    tokenPricingCache._records = [];
    tokenPricingCache._loaded = true;

    const { getMultiplier } = require('./tx');
    const rate = getMultiplier({ model: 'gpt-4o', tokenType: 'prompt' });
    // Should fall back to hardcoded value: 2.5
    expect(rate).toBe(2.5);
  });

  it('should fall back to hardcoded when cache not loaded', () => {
    tokenPricingCache._loaded = false;

    const { getMultiplier } = require('./tx');
    const rate = getMultiplier({ model: 'gpt-4o', tokenType: 'prompt' });
    expect(rate).toBe(2.5);
  });

  it('should use DB premium rate over hardcoded', () => {
    tokenPricingCache._records = [
      {
        modelPattern: 'claude-opus-4-6',
        inputRate: 5,
        outputRate: 25,
        longContextThreshold: 200000,
        longContextInputRate: 99,
        longContextOutputRate: 199,
        isActive: true,
      },
    ];
    tokenPricingCache._loaded = true;

    const { getMultiplier } = require('./tx');
    const rate = getMultiplier({
      model: 'claude-opus-4-6',
      tokenType: 'prompt',
      inputTokenCount: 250000,
    });
    expect(rate).toBe(99);
  });
});
```

### Step 2: Run test to verify it fails

```bash
cd api && npx jest models/tx.spec.js --no-cache
```

Expected: FAIL — DB rates not checked yet

### Step 3: Modify `getMultiplier()` in `api/models/tx.js`

At the top of the file, add:

```javascript
const { tokenPricingCache } = require('~/server/services/TokenPricingCache');
```

Modify `getMultiplier` (lines 401-436) to check cache first:

```javascript
const getMultiplier = ({
  model,
  valueKey,
  endpoint,
  tokenType,
  inputTokenCount,
  endpointTokenConfig,
}) => {
  if (endpointTokenConfig) {
    return endpointTokenConfig?.[model]?.[tokenType] ?? defaultRate;
  }

  // --- DB cache lookup (highest priority) ---
  if (model && tokenType && tokenPricingCache.isLoaded()) {
    const dbPremium = tokenPricingCache.getPremiumRate(model, tokenType, inputTokenCount);
    if (dbPremium != null) {
      return dbPremium;
    }
    const dbRate = tokenPricingCache.getRate(model);
    if (dbRate) {
      return dbRate[tokenType] ?? defaultRate;
    }
  }
  // --- End DB cache lookup ---

  if (valueKey && tokenType) {
    const premiumRate = getPremiumRate(valueKey, tokenType, inputTokenCount);
    if (premiumRate != null) {
      return premiumRate;
    }
    return tokenValues[valueKey]?.[tokenType] ?? defaultRate;
  }

  if (!tokenType || !model) {
    return 1;
  }

  valueKey = getValueKey(model, endpoint);
  if (!valueKey) {
    return defaultRate;
  }

  const premiumRate = getPremiumRate(valueKey, tokenType, inputTokenCount);
  if (premiumRate != null) {
    return premiumRate;
  }

  return tokenValues[valueKey]?.[tokenType] ?? defaultRate;
};
```

### Step 4: Ensure cache is loaded on startup

Modify `api/server/controllers/ModelController.js` — in `modelRatesController` (line 51), add cache load:

```javascript
async function modelRatesController(req, res) {
  try {
    // Ensure DB pricing cache is loaded
    const { tokenPricingCache } = require('~/server/services/TokenPricingCache');
    if (!tokenPricingCache.isLoaded()) {
      await tokenPricingCache.load();
    }

    const modelConfig = await loadModels(req);
    // ... rest unchanged
```

### Step 5: Run test to verify it passes

```bash
cd api && npx jest models/tx.spec.js --no-cache
```

Expected: PASS

### Step 6: Commit

```bash
git add api/models/tx.js api/server/controllers/ModelController.js api/models/tx.spec.js
git commit -m "feat: integrate TokenPricingCache into getMultiplier for DB-first rate lookup"
```

---

## Task 4: Create Admin Token Pricing API Routes

**Files:**
- Create: `api/server/routes/admin/tokenPricing.js`
- Modify: `api/server/routes/index.js`
- Modify: `api/server/index.js`
- Test: `api/server/routes/admin/__tests__/tokenPricing.spec.js`

### Step 1: Write the failing test

```javascript
// api/server/routes/admin/__tests__/tokenPricing.spec.js
const request = require('supertest');
const express = require('express');

// Mock dependencies
jest.mock('~/db/models', () => {
  const records = [];
  return {
    TokenPricing: {
      find: jest.fn(() => ({
        sort: () => ({
          lean: () => Promise.resolve(records),
        }),
      })),
      findById: jest.fn((id) => ({
        lean: () => Promise.resolve(records.find((r) => r._id === id) || null),
      })),
      create: jest.fn((data) => {
        const doc = { _id: 'mock-id', ...data, isActive: true, createdAt: new Date(), updatedAt: new Date() };
        records.push(doc);
        return Promise.resolve(doc);
      }),
      findByIdAndUpdate: jest.fn((id, data) =>
        Promise.resolve({ _id: id, ...data, updatedAt: new Date() }),
      ),
      findByIdAndDelete: jest.fn(() => Promise.resolve(true)),
    },
  };
});

jest.mock('~/server/services/TokenPricingCache', () => ({
  tokenPricingCache: {
    invalidate: jest.fn(),
    load: jest.fn(),
    isLoaded: () => true,
  },
}));

// Mock auth middleware
jest.mock('~/server/middleware', () => ({
  requireJwtAuth: (req, res, next) => {
    req.user = { id: 'admin-user', role: 'ADMIN' };
    next();
  },
}));

jest.mock('@librechat/api', () => ({
  requireAdmin: (req, res, next) => next(),
}));

const tokenPricingRoutes = require('../tokenPricing');

const app = express();
app.use(express.json());
app.use('/api/admin/token-pricing', tokenPricingRoutes);

describe('Admin Token Pricing API', () => {
  it('GET / should return all pricing records', async () => {
    const res = await request(app).get('/api/admin/token-pricing');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST / should create a pricing record and invalidate cache', async () => {
    const { tokenPricingCache } = require('~/server/services/TokenPricingCache');
    const res = await request(app)
      .post('/api/admin/token-pricing')
      .send({
        modelPattern: 'gpt-4o-test',
        provider: 'openai',
        inputRate: 2.5,
        outputRate: 10,
      });
    expect(res.status).toBe(201);
    expect(res.body.modelPattern).toBe('gpt-4o-test');
    expect(tokenPricingCache.invalidate).toHaveBeenCalled();
    expect(tokenPricingCache.load).toHaveBeenCalled();
  });

  it('POST / should reject missing required fields', async () => {
    const res = await request(app)
      .post('/api/admin/token-pricing')
      .send({ modelPattern: 'test' });
    expect(res.status).toBe(400);
  });

  it('PUT /:id should update and invalidate cache', async () => {
    const { tokenPricingCache } = require('~/server/services/TokenPricingCache');
    tokenPricingCache.invalidate.mockClear();

    const res = await request(app)
      .put('/api/admin/token-pricing/mock-id')
      .send({ inputRate: 99 });
    expect(res.status).toBe(200);
    expect(tokenPricingCache.invalidate).toHaveBeenCalled();
  });

  it('DELETE /:id should delete and invalidate cache', async () => {
    const { tokenPricingCache } = require('~/server/services/TokenPricingCache');
    tokenPricingCache.invalidate.mockClear();

    const res = await request(app)
      .delete('/api/admin/token-pricing/mock-id');
    expect(res.status).toBe(200);
    expect(tokenPricingCache.invalidate).toHaveBeenCalled();
  });
});
```

### Step 2: Run test to verify it fails

```bash
cd api && npx jest server/routes/admin/__tests__/tokenPricing.spec.js --no-cache
```

Expected: FAIL — module not found

### Step 3: Write the route

```javascript
// api/server/routes/admin/tokenPricing.js
const express = require('express');
const { requireAdmin } = require('@librechat/api');
const { logger } = require('@librechat/data-schemas');
const { TokenPricing } = require('~/db/models');
const { tokenPricingCache } = require('~/server/services/TokenPricingCache');
const { requireJwtAuth } = require('~/server/middleware');

const router = express.Router();

// All routes require admin
router.use(requireJwtAuth, requireAdmin);

/**
 * GET /api/admin/token-pricing
 * Returns all token pricing records sorted by provider, then modelPattern.
 */
router.get('/', async (req, res) => {
  try {
    const records = await TokenPricing.find({}).sort({ provider: 1, modelPattern: 1 }).lean();
    res.json(records);
  } catch (error) {
    logger.error('[TokenPricing] GET failed:', error);
    res.status(500).json({ error: 'Failed to fetch token pricing' });
  }
});

/**
 * POST /api/admin/token-pricing
 * Create a new token pricing record.
 */
router.post('/', async (req, res) => {
  try {
    const { modelPattern, provider, inputRate, outputRate, longContextThreshold, longContextInputRate, longContextOutputRate } = req.body;

    if (!modelPattern || !provider || inputRate == null || outputRate == null) {
      return res.status(400).json({ error: 'modelPattern, provider, inputRate, and outputRate are required' });
    }

    const record = await TokenPricing.create({
      modelPattern,
      provider,
      inputRate,
      outputRate,
      longContextThreshold,
      longContextInputRate,
      longContextOutputRate,
      updatedBy: req.user.id,
    });

    tokenPricingCache.invalidate();
    await tokenPricingCache.load();

    logger.info(`[TokenPricing] Created: ${modelPattern} by ${req.user.id}`);
    res.status(201).json(record);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: `Model pattern "${req.body.modelPattern}" already exists` });
    }
    logger.error('[TokenPricing] POST failed:', error);
    res.status(500).json({ error: 'Failed to create token pricing' });
  }
});

/**
 * PUT /api/admin/token-pricing/:id
 * Update an existing token pricing record.
 */
router.put('/:id', async (req, res) => {
  try {
    const { modelPattern, provider, inputRate, outputRate, longContextThreshold, longContextInputRate, longContextOutputRate, isActive } = req.body;

    const update = { updatedBy: req.user.id };
    if (modelPattern !== undefined) update.modelPattern = modelPattern;
    if (provider !== undefined) update.provider = provider;
    if (inputRate !== undefined) update.inputRate = inputRate;
    if (outputRate !== undefined) update.outputRate = outputRate;
    if (longContextThreshold !== undefined) update.longContextThreshold = longContextThreshold;
    if (longContextInputRate !== undefined) update.longContextInputRate = longContextInputRate;
    if (longContextOutputRate !== undefined) update.longContextOutputRate = longContextOutputRate;
    if (isActive !== undefined) update.isActive = isActive;

    const record = await TokenPricing.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }

    tokenPricingCache.invalidate();
    await tokenPricingCache.load();

    logger.info(`[TokenPricing] Updated: ${req.params.id} by ${req.user.id}`);
    res.json(record);
  } catch (error) {
    logger.error('[TokenPricing] PUT failed:', error);
    res.status(500).json({ error: 'Failed to update token pricing' });
  }
});

/**
 * DELETE /api/admin/token-pricing/:id
 * Delete a token pricing record.
 */
router.delete('/:id', async (req, res) => {
  try {
    const record = await TokenPricing.findByIdAndDelete(req.params.id);
    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }

    tokenPricingCache.invalidate();
    await tokenPricingCache.load();

    logger.info(`[TokenPricing] Deleted: ${req.params.id} by ${req.user.id}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('[TokenPricing] DELETE failed:', error);
    res.status(500).json({ error: 'Failed to delete token pricing' });
  }
});

module.exports = router;
```

### Step 4: Register the route

In `api/server/routes/index.js`, add:

```javascript
const adminTokenPricing = require('./admin/tokenPricing');
// ... in module.exports:
adminTokenPricing,
```

In `api/server/index.js`, add after line 168 (`adminStats`):

```javascript
app.use('/api/admin/token-pricing', routes.adminTokenPricing);
```

### Step 5: Run test to verify it passes

```bash
cd api && npx jest server/routes/admin/__tests__/tokenPricing.spec.js --no-cache
```

Expected: PASS

### Step 6: Commit

```bash
git add api/server/routes/admin/tokenPricing.js \
       api/server/routes/admin/__tests__/tokenPricing.spec.js \
       api/server/routes/index.js \
       api/server/index.js
git commit -m "feat: add admin CRUD API for token pricing with cache invalidation"
```

---

## Task 5: Create Admin Token Pricing Frontend Page

**Files:**
- Create: `client/src/routes/TokenPricing/TokenPricingPage.tsx`
- Create: `client/src/routes/TokenPricing/index.ts`
- Create: `client/src/data-provider/TokenPricing/queries.ts`
- Modify: `client/src/routes/Dashboard.tsx` — add route
- Modify: `client/src/data-provider/index.ts` — export hooks (if needed)

### Step 1: Create the data hooks

```typescript
// client/src/data-provider/TokenPricing/queries.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import request from 'librechat-data-provider/request';

export interface TokenPricingRecord {
  _id: string;
  modelPattern: string;
  provider: string;
  inputRate: number;
  outputRate: number;
  longContextThreshold?: number;
  longContextInputRate?: number;
  longContextOutputRate?: number;
  isActive: boolean;
  updatedBy?: string;
  updatedAt?: string;
}

const QUERY_KEY = ['adminTokenPricing'];

export function useGetTokenPricing() {
  return useQuery<TokenPricingRecord[]>(QUERY_KEY, async () => {
    const { data } = await request.get('/api/admin/token-pricing');
    return data;
  });
}

export function useCreateTokenPricing() {
  const queryClient = useQueryClient();
  return useMutation(
    async (body: Omit<TokenPricingRecord, '_id' | 'updatedBy' | 'updatedAt'>) => {
      const { data } = await request.post('/api/admin/token-pricing', body);
      return data;
    },
    { onSuccess: () => queryClient.invalidateQueries(QUERY_KEY) },
  );
}

export function useUpdateTokenPricing() {
  const queryClient = useQueryClient();
  return useMutation(
    async ({ id, ...body }: Partial<TokenPricingRecord> & { id: string }) => {
      const { data } = await request.put(`/api/admin/token-pricing/${id}`, body);
      return data;
    },
    { onSuccess: () => queryClient.invalidateQueries(QUERY_KEY) },
  );
}

export function useDeleteTokenPricing() {
  const queryClient = useQueryClient();
  return useMutation(
    async (id: string) => {
      const { data } = await request.delete(`/api/admin/token-pricing/${id}`);
      return data;
    },
    { onSuccess: () => queryClient.invalidateQueries(QUERY_KEY) },
  );
}
```

### Step 2: Create the page component

```typescript
// client/src/routes/TokenPricing/TokenPricingPage.tsx
import React, { useState } from 'react';
import { Pencil, Trash2, Plus, DollarSign } from 'lucide-react';
import { SystemRoles } from 'librechat-data-provider';
import { useAuthContext } from '~/hooks/AuthContext';
import { useLocalize } from '~/hooks';
import {
  useGetTokenPricing,
  useCreateTokenPricing,
  useUpdateTokenPricing,
  useDeleteTokenPricing,
} from '~/data-provider/TokenPricing/queries';
import type { TokenPricingRecord } from '~/data-provider/TokenPricing/queries';

/** Providers for the dropdown. Extend as needed. */
const PROVIDERS = ['openai', 'anthropic', 'google', 'bedrock', 'mistral', 'moonshot', 'deepseek', 'xai', 'other'];

function EmptyForm(): Omit<TokenPricingRecord, '_id' | 'updatedBy' | 'updatedAt'> {
  return {
    modelPattern: '',
    provider: 'openai',
    inputRate: 0,
    outputRate: 0,
    longContextThreshold: undefined,
    longContextInputRate: undefined,
    longContextOutputRate: undefined,
    isActive: true,
  };
}

export default function TokenPricingPage() {
  const localize = useLocalize();
  const { user } = useAuthContext();
  const { data: records, isLoading, error } = useGetTokenPricing();
  const createMutation = useCreateTokenPricing();
  const updateMutation = useUpdateTokenPricing();
  const deleteMutation = useDeleteTokenPricing();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EmptyForm());
  const [search, setSearch] = useState('');

  if (user?.role !== SystemRoles.ADMIN) {
    return (
      <div className="flex h-screen items-center justify-center">
        <h1 className="text-2xl font-bold text-text-primary">
          {localize('com_ui_access_denied')}
        </h1>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-text-primary">{localize('com_ui_loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <h1 className="text-2xl font-bold text-red-500">{localize('com_ui_error')}</h1>
      </div>
    );
  }

  const filtered = (records ?? []).filter(
    (r) =>
      r.modelPattern.toLowerCase().includes(search.toLowerCase()) ||
      r.provider.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSave = async () => {
    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, ...form });
    } else {
      await createMutation.mutateAsync(form);
    }
    setShowForm(false);
    setEditingId(null);
    setForm(EmptyForm());
  };

  const handleEdit = (record: TokenPricingRecord) => {
    setForm({
      modelPattern: record.modelPattern,
      provider: record.provider,
      inputRate: record.inputRate,
      outputRate: record.outputRate,
      longContextThreshold: record.longContextThreshold,
      longContextInputRate: record.longContextInputRate,
      longContextOutputRate: record.longContextOutputRate,
      isActive: record.isActive,
    });
    setEditingId(record._id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this pricing record?')) {
      await deleteMutation.mutateAsync(id);
    }
  };

  return (
    <div className="min-h-screen bg-surface-primary-alt p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-text-primary" />
            <h1 className="text-3xl font-bold text-text-primary">Token Pricing</h1>
          </div>
          <button
            onClick={() => { setForm(EmptyForm()); setEditingId(null); setShowForm(true); }}
            className="flex items-center gap-2 rounded-lg bg-surface-submit px-4 py-2 text-sm font-medium text-white hover:bg-surface-submit-hover"
          >
            <Plus className="h-4 w-4" /> Add Model
          </button>
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search by model or provider..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border-medium bg-surface-primary px-4 py-2 text-sm text-text-primary placeholder-text-secondary focus:border-surface-submit focus:outline-none"
          />
        </div>

        {/* Form modal */}
        {showForm && (
          <div className="mb-6 rounded-lg border border-border-medium bg-surface-primary p-6">
            <h2 className="mb-4 text-lg font-semibold text-text-primary">
              {editingId ? 'Edit' : 'Add'} Model Pricing
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">Model Pattern</label>
                <input
                  type="text"
                  value={form.modelPattern}
                  onChange={(e) => setForm({ ...form, modelPattern: e.target.value })}
                  placeholder="e.g. gpt-4o"
                  className="w-full rounded border border-border-medium bg-surface-primary-alt px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">Provider</label>
                <select
                  value={form.provider}
                  onChange={(e) => setForm({ ...form, provider: e.target.value })}
                  className="w-full rounded border border-border-medium bg-surface-primary-alt px-3 py-2 text-sm text-text-primary"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">Input Rate ($/1M tokens)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.inputRate}
                  onChange={(e) => setForm({ ...form, inputRate: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded border border-border-medium bg-surface-primary-alt px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">Output Rate ($/1M tokens)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.outputRate}
                  onChange={(e) => setForm({ ...form, outputRate: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded border border-border-medium bg-surface-primary-alt px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">Long Context Threshold (tokens)</label>
                <input
                  type="number"
                  value={form.longContextThreshold ?? ''}
                  onChange={(e) => setForm({ ...form, longContextThreshold: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="e.g. 200000"
                  className="w-full rounded border border-border-medium bg-surface-primary-alt px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">Long Context Input Rate</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.longContextInputRate ?? ''}
                  onChange={(e) => setForm({ ...form, longContextInputRate: e.target.value ? parseFloat(e.target.value) : undefined })}
                  className="w-full rounded border border-border-medium bg-surface-primary-alt px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">Long Context Output Rate</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.longContextOutputRate ?? ''}
                  onChange={(e) => setForm({ ...form, longContextOutputRate: e.target.value ? parseFloat(e.target.value) : undefined })}
                  className="w-full rounded border border-border-medium bg-surface-primary-alt px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-text-secondary">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  />
                  Active
                </label>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleSave}
                disabled={!form.modelPattern || !form.provider}
                className="rounded-lg bg-surface-submit px-4 py-2 text-sm font-medium text-white hover:bg-surface-submit-hover disabled:opacity-50"
              >
                {editingId ? 'Update' : 'Create'}
              </button>
              <button
                onClick={() => { setShowForm(false); setEditingId(null); }}
                className="rounded-lg border border-border-medium px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-hover"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-border-medium">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-secondary text-text-secondary">
              <tr>
                <th className="px-4 py-3 font-medium">Model Pattern</th>
                <th className="px-4 py-3 font-medium">Provider</th>
                <th className="px-4 py-3 font-medium text-right">Input ($/1M)</th>
                <th className="px-4 py-3 font-medium text-right">Output ($/1M)</th>
                <th className="hidden px-4 py-3 font-medium text-right lg:table-cell">Long Ctx Threshold</th>
                <th className="px-4 py-3 font-medium text-center">Active</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-medium">
              {filtered.map((record) => (
                <tr key={record._id} className="bg-surface-primary hover:bg-surface-hover">
                  <td className="px-4 py-3 font-mono text-text-primary">{record.modelPattern}</td>
                  <td className="px-4 py-3 text-text-secondary">{record.provider}</td>
                  <td className="px-4 py-3 text-right text-text-primary">${record.inputRate.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-text-primary">${record.outputRate.toFixed(2)}</td>
                  <td className="hidden px-4 py-3 text-right text-text-secondary lg:table-cell">
                    {record.longContextThreshold ? record.longContextThreshold.toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block h-2 w-2 rounded-full ${record.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleEdit(record)} className="mr-2 text-text-secondary hover:text-text-primary">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(record._id)} className="text-text-secondary hover:text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-text-secondary">
                    No pricing records found. Click "Add Model" to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-text-secondary">
          Rates are in USD per 1 million tokens. Database rates take priority over built-in defaults.
          Changes take effect immediately for new conversations.
        </p>
      </div>
    </div>
  );
}
```

### Step 3: Create the barrel export

```typescript
// client/src/routes/TokenPricing/index.ts
export { default } from './TokenPricingPage';
```

### Step 4: Register the route in Dashboard

Modify `client/src/routes/Dashboard.tsx`:

Add import at top:

```typescript
import TokenPricingPage from './TokenPricing';
```

Add route entry in `children` array (after the `stats` entry, before the `*` catch-all):

```typescript
{
  path: 'token-pricing',
  element: <TokenPricingPage />,
},
```

### Step 5: Build and verify

```bash
npm run build:packages
npm run frontend:dev
```

Navigate to `http://localhost:3090/d/token-pricing` — should render the empty table.

### Step 6: Commit

```bash
git add client/src/routes/TokenPricing/TokenPricingPage.tsx \
       client/src/routes/TokenPricing/index.ts \
       client/src/data-provider/TokenPricing/queries.ts \
       client/src/routes/Dashboard.tsx
git commit -m "feat: add Token Pricing admin page with CRUD table and search"
```

---

## Task 6: Add Navigation Entry to Admin Dashboard

**Files:**
- Modify: `client/src/routes/Layouts/Dashboard.tsx` (or wherever sidebar nav is defined)
- The dashboard layout should have a sidebar/nav linking to `/d/token-pricing`

### Step 1: Find and read the dashboard layout

Read `client/src/routes/Layouts/Dashboard.tsx` to find where nav links are defined. Look for existing links like "Prompts" and "Stats" and add a "Token Pricing" entry following the same pattern.

### Step 2: Add the nav link

Add a new entry for Token Pricing in the navigation component, only visible to admin users. Use the `DollarSign` icon from lucide-react. The link path should be `/d/token-pricing`.

### Step 3: Verify

```bash
npm run frontend:dev
```

Navigate to the dashboard — "Token Pricing" link should appear in the sidebar (admin only).

### Step 4: Commit

```bash
git add client/src/routes/Layouts/Dashboard.tsx
git commit -m "feat: add Token Pricing nav entry in admin dashboard sidebar"
```

---

## Task 7: Update Hardcoded Prices in tx.js (Price Alignment)

**Files:**
- Modify: `api/models/tx.js` — update/add model entries
- Test: Run existing tests to ensure no regressions

### Step 1: Update the following entries in `tokenValues` (lines 125-294 of `api/models/tx.js`)

**Fix inaccurate rates:**

```javascript
// Gemini 2.5 Flash — was $0.3/$2.5, should be:
'gemini-2.5-flash': { prompt: 0.15, completion: 0.6 },
```

**Add missing models:**

```javascript
// Claude 4.5 series
'claude-sonnet-4-5': { prompt: 3, completion: 15 },
'claude-opus-4-1': { prompt: 15, completion: 75 },
// GPT-5.2
'gpt-5.2': { prompt: 1.75, completion: 14 },
```

### Step 2: Update `premiumTokenValues` if needed

```javascript
// claude-sonnet-4-5 also has long context pricing
'claude-sonnet-4-5': { threshold: 200000, prompt: 6, completion: 22.5 },
```

### Step 3: Run all tests

```bash
cd api && npm test -- models/tx.spec.js --no-cache
```

Expected: PASS (no regression)

### Step 4: Commit

```bash
git add api/models/tx.js
git commit -m "fix: align token pricing with latest OpenAI/Anthropic/Google rates, add missing models"
```

---

## Task 8: Load Cache on Server Startup

**Files:**
- Modify: `api/server/index.js` — add cache preload

### Step 1: Add cache load to server startup

In `api/server/index.js`, after the MongoDB connection is established (look for where `app.listen` or route registration happens), add:

```javascript
const { tokenPricingCache } = require('~/server/services/TokenPricingCache');
// Load token pricing cache from database
tokenPricingCache.load().catch((err) => {
  logger.warn('[Startup] Failed to preload token pricing cache (will load on first request):', err.message);
});
```

Place this after the route registration block (after line ~195) but before `app.use(ErrorController)`. The `.catch()` ensures the server still starts if the collection doesn't exist yet.

### Step 2: Verify

```bash
npm run backend:dev
```

Look for log: `[TokenPricingCache] Loaded N pricing records from database`

### Step 3: Commit

```bash
git add api/server/index.js
git commit -m "feat: preload token pricing cache on server startup"
```

---

## Summary of Changes

| Component | Change | File |
|-----------|--------|------|
| Schema | New `TokenPricing` Mongoose schema | `packages/data-schemas/src/schema/tokenPricing.ts` |
| Model | New model factory | `packages/data-schemas/src/models/tokenPricing.ts` |
| Cache | In-memory singleton with invalidation | `api/server/services/TokenPricingCache.js` |
| Core Logic | DB-first lookup in `getMultiplier()` | `api/models/tx.js` |
| Admin API | CRUD routes with auth | `api/server/routes/admin/tokenPricing.js` |
| Admin UI | Table page with search, create, edit, delete | `client/src/routes/TokenPricing/TokenPricingPage.tsx` |
| Data hooks | TanStack Query hooks | `client/src/data-provider/TokenPricing/queries.ts` |
| Navigation | Dashboard sidebar link | `client/src/routes/Layouts/Dashboard.tsx` |
| Rate display | **Already implemented** in `EndpointModelItem.tsx` | No changes needed |
| Price fix | Align Gemini 2.5 Flash, add missing models | `api/models/tx.js` |
| Startup | Preload cache | `api/server/index.js` |

## Data Flow After Implementation

```
Admin edits rate in UI
  → POST/PUT /api/admin/token-pricing
  → Save to MongoDB
  → tokenPricingCache.invalidate() + load()
  → Cache refreshed

User sends message
  → spendTokens() → createTransaction()
  → getMultiplier() checks:
    1. endpointTokenConfig (custom endpoint override)
    2. tokenPricingCache (DB records) ← NEW
    3. tokenValues (tx.js hardcoded)  ← FALLBACK
    4. defaultRate (6)                ← LAST RESORT

User opens model selector
  → GET /api/models/rates
  → modelRatesController calls getMultiplier() per model
  → Returns DB or hardcoded rates
  → EndpointModelItem.tsx displays "Input $X.XX/M | Output $X.XX/M"
```

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

    // Don't call load() — getRateAsync should trigger it
    const rate = await cache.getRateAsync('gpt-4o');
    expect(rate).toEqual({ prompt: 2.5, completion: 10 });
    expect(mockFind).toHaveBeenCalledTimes(1);
  });
});

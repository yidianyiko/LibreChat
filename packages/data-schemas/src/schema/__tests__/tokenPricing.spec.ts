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

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { updateDualBalance, deductBalance, resetSubscriptionBalance } = require('../balanceMethods');
const { Balance } = require('~/db/models');

let mongoServer;
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await mongoose.connection.dropDatabase();
});

describe('balanceMethods', () => {

  describe('updateDualBalance', () => {
    it('should add to subscription balance', async () => {
      const userId = new mongoose.Types.ObjectId();
      await Balance.create({
        user: userId,
        tokenCredits: 1500,
        subscriptionBalance: 1000,
        topupBalance: 500,
      });

      const result = await updateDualBalance({
        user: userId,
        incrementValue: 1000,
        balanceType: 'subscription',
      });

      expect(result.subscriptionBalance).toBe(2000);
      expect(result.topupBalance).toBe(500);
      expect(result.tokenCredits).toBe(2500);
    });

    it('should add to topup balance', async () => {
      const userId = new mongoose.Types.ObjectId();
      await Balance.create({
        user: userId,
        tokenCredits: 1500,
        subscriptionBalance: 1000,
        topupBalance: 500,
      });

      const result = await updateDualBalance({
        user: userId,
        incrementValue: 1000,
        balanceType: 'topup',
      });

      expect(result.subscriptionBalance).toBe(1000);
      expect(result.topupBalance).toBe(1500);
      expect(result.tokenCredits).toBe(2500);
    });

    it('should reject invalid balanceType', async () => {
      const userId = new mongoose.Types.ObjectId();

      await expect(
        updateDualBalance({
          user: userId,
          incrementValue: 1000,
          balanceType: 'invalid',
        })
      ).rejects.toThrow('Invalid balanceType');
    });
  });

  describe('deductBalance', () => {
    it('should deduct from subscription balance first', async () => {
      const userId = new mongoose.Types.ObjectId();
      await Balance.create({
        user: userId,
        tokenCredits: 3000,
        subscriptionBalance: 2000,
        topupBalance: 1000,
      });

      const result = await deductBalance({
        user: userId,
        amount: 500,
      });

      expect(result.deductedFromSub).toBe(500);
      expect(result.deductedFromTopup).toBe(0);
      expect(result.totalDeducted).toBe(500);
      expect(result.balance.subscriptionBalance).toBe(1500);
      expect(result.balance.topupBalance).toBe(1000);
    });

    it('should deduct from both pools when subscription insufficient', async () => {
      const userId = new mongoose.Types.ObjectId();
      await Balance.create({
        user: userId,
        tokenCredits: 1300,
        subscriptionBalance: 300,
        topupBalance: 1000,
      });

      const result = await deductBalance({
        user: userId,
        amount: 500,
      });

      expect(result.deductedFromSub).toBe(300);
      expect(result.deductedFromTopup).toBe(200);
      expect(result.totalDeducted).toBe(500);
      expect(result.balance.subscriptionBalance).toBe(0);
      expect(result.balance.topupBalance).toBe(800);
    });

    it('should throw error when insufficient balance', async () => {
      const userId = new mongoose.Types.ObjectId();
      await Balance.create({
        user: userId,
        tokenCredits: 150,
        subscriptionBalance: 100,
        topupBalance: 50,
      });

      await expect(
        deductBalance({
          user: userId,
          amount: 200,
        })
      ).rejects.toThrow('Insufficient balance');
    });
  });

  describe('resetSubscriptionBalance', () => {
    it('should reset subscription balance to new value', async () => {
      const userId = new mongoose.Types.ObjectId();
      await Balance.create({
        user: userId,
        tokenCredits: 1500,
        subscriptionBalance: 500,
        topupBalance: 1000,
      });

      const result = await resetSubscriptionBalance({
        user: userId,
        newSubscriptionBalance: 5000000,
      });

      expect(result.subscriptionBalance).toBe(5000000);
      expect(result.topupBalance).toBe(1000);
      expect(result.tokenCredits).toBe(5001000);
      expect(result.lastSubscriptionReset).toBeDefined();
    });
  });
});

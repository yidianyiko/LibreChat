const { StripeService } = require('../StripeService');

describe('StripeService.handlePaymentSuccess', () => {
  it('does not permanently block retries for the same session id (no in-memory idempotency)', async () => {
    const service = new StripeService();

    const session = {
      id: 'cs_test_same',
      metadata: { userId: 'u1', tierId: 'explorer' },
      payment_status: 'paid',
      amount_total: 499,
      customer_email: 't@example.com',
      subscription: null,
    };

    await expect(service.handlePaymentSuccess(session)).resolves.toBeTruthy();
    await expect(service.handlePaymentSuccess(session)).resolves.toBeTruthy();
  });
});


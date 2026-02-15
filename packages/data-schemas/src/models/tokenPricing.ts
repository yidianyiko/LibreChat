import tokenPricingSchema from '~/schema/tokenPricing';
import type { ITokenPricing } from '~/schema/tokenPricing';

export function createTokenPricingModel(mongoose: typeof import('mongoose')) {
  return (
    mongoose.models.TokenPricing ||
    mongoose.model<ITokenPricing>('TokenPricing', tokenPricingSchema)
  );
}

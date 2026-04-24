import { translations } from '../LandingPage';

describe('LandingPage pricing copy', () => {
  it('uses credits-first estimates for english pricing tiers', () => {
    expect(translations.en.pricing.explorer.features).toEqual([
      'Best for occasional GPT-4o use or frequent day-to-day GPT-4o-mini use',
      'One-time recharge of 5 million token credits',
      'Estimated to cover about 150 GPT-4o conversations or about 5,000 GPT-4o-mini conversations',
    ]);

    expect(translations.en.pricing.artisan.features).toEqual([
      'Best for steady creative work, writing, analysis, and multi-turn collaboration',
      'One-time recharge of 15 million token credits',
      'Estimated to cover about 700 GPT-4o conversations or about 15,000 GPT-4o-mini conversations',
    ]);

    expect(translations.en.pricing.elite.features).toEqual([
      'Best for heavy GPT-4o use or sustained high-frequency GPT-4o-mini use',
      'One-time recharge of 35 million token credits',
      'Estimated to cover about 2,000 GPT-4o conversations or about 35,000 GPT-4o-mini conversations',
    ]);

    expect(translations.en.pricing.note).toBe(
      'The estimates above reflect typical usage patterns. Actual usage will vary based on prompt length, response length, context size, and whether you use files, tools, or long multi-turn chats.',
    );
  });

  it('removes unsupported entitlement claims from english pricing tiers', () => {
    const pricingFeatures = [
      ...translations.en.pricing.explorer.features,
      ...translations.en.pricing.artisan.features,
      ...translations.en.pricing.elite.features,
    ].join(' | ');

    expect(pricingFeatures).not.toContain('Unlimited Base 4o-mini msgs');
    expect(pricingFeatures).not.toContain('Tier-5 Priority Lane');
    expect(pricingFeatures).not.toContain('Project Folders');
    expect(pricingFeatures).not.toContain('Token Context');
    expect(pricingFeatures).not.toContain('Locked Model Guarantee');
    expect(pricingFeatures).not.toContain('Snapshot Selection');
  });
});

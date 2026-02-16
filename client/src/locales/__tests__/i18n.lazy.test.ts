import { getLanguageLoadOrder, normalizeLanguageTag } from '../i18n';

describe('i18n lazy loading language helpers', () => {
  it('should normalize zh variants to configured locales', () => {
    expect(normalizeLanguageTag('zh-TW')).toBe('zh-Hant');
    expect(normalizeLanguageTag('zh-HK')).toBe('zh-Hant');
    expect(normalizeLanguageTag('zh-CN')).toBe('zh-Hans');
  });

  it('should build fallback language load order', () => {
    expect(getLanguageLoadOrder('zh-HK')).toEqual(['zh-Hant', 'en']);
    expect(getLanguageLoadOrder('fr-CA')).toEqual(['fr', 'en']);
    expect(getLanguageLoadOrder('en')).toEqual(['en']);
  });
});

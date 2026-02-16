import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import translationEn from './en/translation.json';

export const defaultNS = 'translation';
export const resources = {
  en: { translation: translationEn },
} as const;

type TranslationSchema = typeof translationEn;
type TranslationModule = { default: TranslationSchema };

const languageLoaders: Record<string, () => Promise<TranslationModule>> = {
  ar: () => import('./ar/translation.json'),
  bs: () => import('./bs/translation.json'),
  bo: () => import('./bo/translation.json'),
  ca: () => import('./ca/translation.json'),
  cs: () => import('./cs/translation.json'),
  da: () => import('./da/translation.json'),
  de: () => import('./de/translation.json'),
  es: () => import('./es/translation.json'),
  et: () => import('./et/translation.json'),
  fa: () => import('./fa/translation.json'),
  fi: () => import('./fi/translation.json'),
  fr: () => import('./fr/translation.json'),
  he: () => import('./he/translation.json'),
  hu: () => import('./hu/translation.json'),
  hy: () => import('./hy/translation.json'),
  id: () => import('./id/translation.json'),
  is: () => import('./is/translation.json'),
  it: () => import('./it/translation.json'),
  ja: () => import('./ja/translation.json'),
  ka: () => import('./ka/translation.json'),
  ko: () => import('./ko/translation.json'),
  lt: () => import('./lt/translation.json'),
  lv: () => import('./lv/translation.json'),
  nb: () => import('./nb/translation.json'),
  nl: () => import('./nl/translation.json'),
  nn: () => import('./nn/translation.json'),
  pl: () => import('./pl/translation.json'),
  'pt-BR': () => import('./pt-BR/translation.json'),
  'pt-PT': () => import('./pt-PT/translation.json'),
  ru: () => import('./ru/translation.json'),
  sk: () => import('./sk/translation.json'),
  sl: () => import('./sl/translation.json'),
  sv: () => import('./sv/translation.json'),
  th: () => import('./th/translation.json'),
  tr: () => import('./tr/translation.json'),
  ug: () => import('./ug/translation.json'),
  uk: () => import('./uk/translation.json'),
  vi: () => import('./vi/translation.json'),
  'zh-Hans': () => import('./zh-Hans/translation.json'),
  'zh-Hant': () => import('./zh-Hant/translation.json'),
};

const supportedLanguageMap = new Map<string, string>([
  ['en', 'en'],
  ...Object.keys(languageLoaders).map((lng) => [lng.toLowerCase(), lng]),
]);

export const normalizeLanguageTag = (language?: string): string => {
  if (!language) {
    return 'en';
  }

  const normalized = language.replace('_', '-').trim();
  const lower = normalized.toLowerCase();

  if (lower.startsWith('zh')) {
    if (lower.includes('tw') || lower.includes('hk') || lower.includes('hant')) {
      return 'zh-Hant';
    }
    return 'zh-Hans';
  }

  const exact = supportedLanguageMap.get(lower);
  if (exact) {
    return exact;
  }

  const base = lower.split('-')[0];
  const baseMatch = supportedLanguageMap.get(base);
  return baseMatch ?? 'en';
};

export const getLanguageLoadOrder = (language?: string): string[] => {
  const normalized = normalizeLanguageTag(language);
  const candidates = [normalized, 'en'];
  const base = normalized.split('-')[0];

  if (!normalized.startsWith('zh-') && base !== normalized) {
    candidates.splice(1, 0, base);
  }

  return Array.from(new Set(candidates)).filter((lng) => lng === 'en' || languageLoaders[lng] != null);
};

const loadedLanguages = new Set<string>(['en']);

const loadLanguageBundle = async (language: string): Promise<boolean> => {
  if (language === 'en' || loadedLanguages.has(language)) {
    return true;
  }

  const loader = languageLoaders[language];
  if (loader == null) {
    return false;
  }

  try {
    const module = await loader();
    if (!i18n.hasResourceBundle(language, defaultNS)) {
      i18n.addResourceBundle(language, defaultNS, module.default, true, true);
    }
    loadedLanguages.add(language);
    return true;
  } catch (error) {
    console.warn(`Failed to load locale bundle: ${language}`, error);
    return false;
  }
};

export const ensureLanguageResources = async (language?: string): Promise<string> => {
  for (const candidate of getLanguageLoadOrder(language)) {
    const loaded = await loadLanguageBundle(candidate);
    if (loaded) {
      return candidate;
    }
  }
  return 'en';
};

let i18nInitPromise: Promise<typeof i18n> | null = null;

export const initializeI18n = async (): Promise<typeof i18n> => {
  if (i18nInitPromise != null) {
    return i18nInitPromise;
  }

  i18nInitPromise = (async () => {
    if (!i18n.isInitialized) {
      await i18n.use(LanguageDetector).use(initReactI18next).init({
        fallbackLng: {
          'zh-TW': ['zh-Hant', 'en'],
          'zh-HK': ['zh-Hant', 'en'],
          zh: ['zh-Hans', 'en'],
          default: ['en'],
        },
        fallbackNS: defaultNS,
        ns: [defaultNS],
        debug: false,
        defaultNS,
        resources,
        partialBundledLanguages: true,
        interpolation: { escapeValue: false },
        react: {
          useSuspense: false,
        },
      });
    }

    const targetLanguage = await ensureLanguageResources(i18n.resolvedLanguage ?? i18n.language);
    if (i18n.resolvedLanguage !== targetLanguage) {
      await i18n.changeLanguage(targetLanguage);
    }
    return i18n;
  })();

  return i18nInitPromise;
};

export const changeAppLanguage = async (language: string): Promise<void> => {
  await initializeI18n();
  const targetLanguage = await ensureLanguageResources(language);
  if (i18n.resolvedLanguage !== targetLanguage) {
    await i18n.changeLanguage(targetLanguage);
  }
};

export default i18n;

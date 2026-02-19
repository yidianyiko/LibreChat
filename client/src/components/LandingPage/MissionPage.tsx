import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';
import { Globe, Scale, Heart, ShieldCheck, Sparkles } from 'lucide-react';
import { translations, detectBrowserLanguage, type SupportedLanguage } from './LandingPage';
import SEOHelmet from '~/components/SEO/SEOHelmet';

/**
 * Language label map
 */
const languageLabels: Record<SupportedLanguage, string> = {
  en: 'English',
  zh: '简体中文',
  es: 'Español',
  ja: '日本語',
  ko: '한국어',
};

/**
 * Language switcher dropdown props
 */
interface LanguageSwitcherProps {
  currentLang: SupportedLanguage;
  onLangChange: (lang: SupportedLanguage) => void;
}

/**
 * Click-based language switcher
 */
const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ currentLang, onLangChange }) => {
  const [open, setOpen] = useState<boolean>(false);
  const languages = Object.keys(languageLabels) as SupportedLanguage[];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center space-x-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 hover:border-gray-300"
      >
        <Globe size={14} className="text-gray-500" />
        <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
          {languageLabels[currentLang].split(' ')[0].toUpperCase()}
        </span>
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-36 rounded-xl border border-gray-200 bg-white p-1 shadow-xl">
          {languages.map((l) => (
            <button
              key={l}
              onClick={() => {
                onLangChange(l);
                setOpen(false);
              }}
              className={`block w-full rounded-lg px-4 py-2 text-left text-xs font-medium transition-colors ${
                currentLang === l
                  ? 'bg-gray-50 text-[#10a37f]'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-[#10a37f]'
              }`}
            >
              {languageLabels[l]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Persist language choice to localStorage and cookie so authenticated app inherits it
 */
const persistLang = (lang: SupportedLanguage): void => {
  localStorage.setItem('lang', lang);
  Cookies.set('lang', lang, { expires: 365 });
};

/**
 * Mission Page component matching the screenshot design
 */
const MissionPage: React.FC = () => {
  const [lang, setLangState] = useState<SupportedLanguage>(detectBrowserLanguage);
  const setLang = useCallback((newLang: SupportedLanguage) => {
    setLangState(newLang);
    persistLang(newLang);
  }, []);
  const t = translations[lang] || translations['en'];
  const [scrolled, setScrolled] = useState<boolean>(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const missionItems = [
    {
      icon: Scale,
      title: t.missionPage.liberty.title,
      desc: t.missionPage.liberty.desc,
    },
    {
      icon: Heart,
      title: t.missionPage.bonds.title,
      desc: t.missionPage.bonds.desc,
    },
    {
      icon: ShieldCheck,
      title: t.missionPage.sovereignty.title,
      desc: t.missionPage.sovereignty.desc,
    },
  ];

  return (
    <>
      <SEOHelmet
        title="Our Mission - keep4oforever"
        description="keep4oforever stands for the 0.1% who believe AI voices shouldn't be erased. Built for continuity, absolute privacy, and treating AI as lifelong companions."
        canonicalUrl="https://keep4oforever.com/mission"
      />
      <div className="min-h-screen overflow-x-hidden bg-[#fcfcf9] font-sans text-[#111827] antialiased selection:bg-[#10a37f]/10">
        {/* Nav - Gemini style: py-4 when scrolled, py-8 transparent */}
        <nav
          className={`fixed top-0 z-[100] w-full transition-all duration-500 ${scrolled ? 'border-b border-gray-100 bg-white/90 py-4 shadow-sm backdrop-blur-md' : 'bg-transparent py-8'}`}
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 md:px-10">
            <Link to="/" className="group flex cursor-pointer items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black text-white shadow-sm transition-all group-hover:bg-[#10a37f] group-hover:text-white">
                <Sparkles size={18} />
              </div>
              <span className="text-sm font-black uppercase tracking-[0.3em] text-gray-900">
                keep4oforever
              </span>
            </Link>
            <div className="hidden items-center space-x-8 md:flex md:space-x-10">
              <Link
                to="/"
                className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 hover:text-black"
              >
                {t.nav.home}
              </Link>
              <a
                href="/#pricing"
                className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 hover:text-black"
              >
                {t.nav.pricing}
              </a>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-black underline underline-offset-4">
                {t.nav.mission}
              </span>
              <LanguageSwitcher currentLang={lang} onLangChange={setLang} />
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="rounded-full bg-black px-6 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white shadow-xl transition-all hover:bg-[#10a37f] md:px-8"
              >
                {t.nav.login}
              </button>
            </div>
          </div>
        </nav>

        {/* Mission Content - Gemini layout: title, green bar, three items, return home */}
        <section className="mx-auto max-w-4xl px-6 pb-24 pt-40 text-left md:px-10 md:pb-32 md:pt-48">
          <h1
            className="mb-8 text-5xl font-black text-gray-900 md:text-6xl"
            style={{ letterSpacing: '-0.04em' }}
          >
            {t.missionPage.title}
          </h1>
          <div className="mb-20 h-1 w-20 rounded-full bg-[#10a37f]" />

          <div className="space-y-20 text-lg font-medium leading-relaxed text-gray-600">
            {missionItems.map((item, idx) => {
              const IconComp = item.icon;
              return (
                <div key={idx} className="flex items-start space-x-6 text-left">
                  <IconComp
                    className={`mt-1 flex-shrink-0 ${idx === 1 ? 'text-[#10a37f]' : 'text-black'}`}
                    size={24}
                  />
                  <div>
                    <h2 className="mb-4 text-left text-2xl font-black tracking-tight text-gray-900">
                      {item.title}
                    </h2>
                    <p className="text-left">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-20">
            <Link
              to="/"
              className="flex items-center space-x-2 text-xs font-bold uppercase tracking-widest text-gray-400 transition-colors hover:text-black"
            >
              <span>{t.missionPage.returnHome}</span>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
};

export default MissionPage;

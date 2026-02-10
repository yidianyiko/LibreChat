import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Globe,
  Scale,
  Heart,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { translations, type SupportedLanguage } from './LandingPage';

/**
 * Language label map
 */
const languageLabels: Record<SupportedLanguage, string> = {
  en: 'English',
  zh: '简体中文',
  es: 'Español',
  ja: '日本語',
  ko: '한국어'
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
  const languages = (Object.keys(languageLabels) as SupportedLanguage[]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center space-x-2 px-3 py-1.5 rounded-full border border-gray-200 hover:border-gray-300 bg-white"
      >
        <Globe size={14} className="text-gray-500" />
        <span className="uppercase text-xs font-bold tracking-wider text-gray-700">
          {languageLabels[currentLang].split(' ')[0].toUpperCase()}
        </span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-36 bg-white border border-gray-200 rounded-xl p-1 shadow-xl z-50">
          {languages.map(l => (
            <button
              key={l}
              onClick={() => { onLangChange(l); setOpen(false); }}
              className={`block w-full text-left px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
                currentLang === l ? 'text-[#10a37f] bg-gray-50' : 'text-gray-600 hover:bg-gray-50 hover:text-[#10a37f]'
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
 * Detect browser language and map to supported language
 */
const detectBrowserLanguage = (): SupportedLanguage => {
  const browserLang = navigator.language || navigator.languages?.[0] || 'en';
  const langCode = browserLang.toLowerCase().split('-')[0];

  const langMap: Record<string, SupportedLanguage> = {
    en: 'en',
    zh: 'zh',
    es: 'es',
    ja: 'ja',
    ko: 'ko',
  };

  return langMap[langCode] || 'en';
};

/**
 * Mission Page component matching the screenshot design
 */
const MissionPage: React.FC = () => {
  const [lang, setLang] = useState<SupportedLanguage>(detectBrowserLanguage);
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
    <div className="min-h-screen bg-[#fcfcf9] text-[#111827] font-sans selection:bg-[#10a37f]/10 antialiased overflow-x-hidden">
      {/* Nav - Gemini style: py-4 when scrolled, py-8 transparent */}
      <nav className={`fixed top-0 w-full z-[100] transition-all duration-500 ${scrolled ? 'py-4 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm' : 'py-8 bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-6 md:px-10 flex justify-between items-center">
          <Link to="/" className="flex items-center space-x-3 cursor-pointer group">
            <div className="w-10 h-10 bg-black text-white rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-[#10a37f] group-hover:text-white transition-all">
              <Sparkles size={18} />
            </div>
            <span className="text-sm font-black tracking-[0.3em] uppercase text-gray-900">keep4oforever</span>
          </Link>
          <div className="hidden md:flex items-center space-x-8 md:space-x-10">
            <Link to="/" className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-400 hover:text-black">
              {t.nav.home}
            </Link>
            <a href="/#pricing" className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-400 hover:text-black">
              {t.nav.pricing}
            </a>
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-black underline underline-offset-4">
              {t.nav.mission}
            </span>
            <LanguageSwitcher currentLang={lang} onLangChange={setLang} />
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="px-6 md:px-8 py-3 bg-black text-white text-[10px] font-bold uppercase tracking-[0.2em] rounded-full hover:bg-[#10a37f] transition-all shadow-xl"
            >
              {t.nav.login}
            </button>
          </div>
        </div>
      </nav>

      {/* Mission Content - Gemini layout: title, green bar, three items, return home */}
      <section className="pt-40 md:pt-48 pb-24 md:pb-32 px-6 md:px-10 max-w-4xl mx-auto text-left">
        <h1 className="text-5xl md:text-6xl font-black mb-8 text-gray-900" style={{ letterSpacing: '-0.04em' }}>
          {t.missionPage.title}
        </h1>
        <div className="h-1 w-20 bg-[#10a37f] rounded-full mb-20" />

        <div className="space-y-20 text-lg text-gray-600 font-medium leading-relaxed">
          {missionItems.map((item, idx) => {
            const IconComp = item.icon;
            return (
              <div key={idx} className="flex items-start space-x-6 text-left">
                <IconComp
                  className={`mt-1 flex-shrink-0 ${idx === 1 ? 'text-[#10a37f]' : 'text-black'}`}
                  size={24}
                />
                <div>
                  <h2 className="text-2xl font-black text-gray-900 mb-4 tracking-tight text-left">
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
            className="flex items-center space-x-2 text-gray-400 hover:text-black transition-colors font-bold uppercase text-xs tracking-widest"
          >
            <span>{t.missionPage.returnHome}</span>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default MissionPage;

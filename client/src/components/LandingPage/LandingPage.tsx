import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Globe,
  ShieldCheck,
  Heart,
  Database,
  ChevronRight,
  Github,
  Twitter,
  Mail,
  ArrowRightLeft,
  Sparkles,
  User,
  Zap,
  CheckCircle2,
  type LucideIcon
} from 'lucide-react';

/**
 * Translation structure types
 */
interface NavTranslation {
  features: string;
  pricing: string;
  about: string;
  login: string;
}

interface HeroTranslation {
  tag: string;
  title: string;
  subtitle: string;
  aiMessage: string;
  chatBtn: string;
  migrateBtn: string;
}

interface AdvantageItem {
  title: string;
  desc: string;
}

interface AdvantagesTranslation {
  title: string;
  core1: AdvantageItem;
  core2: AdvantageItem;
  core3: AdvantageItem;
}

interface MigrationTranslation {
  title: string;
  subtitle: string;
  feature: string;
}

interface PricingTier {
  name: string;
  sub: string;
  price: string;
  features: string[];
}

interface PricingTranslation {
  title: string;
  subtitle: string;
  recommended: string;
  cta: string;
  explorer: PricingTier;
  artisan: PricingTier;
  elite: PricingTier;
}

interface Translation {
  nav: NavTranslation;
  hero: HeroTranslation;
  advantages: AdvantagesTranslation;
  migration: MigrationTranslation;
  pricing: PricingTranslation;
}

type SupportedLanguage = 'en' | 'zh' | 'es' | 'ja' | 'ko';

type Translations = Record<SupportedLanguage, Translation>;

/**
 * 语言包配置
 * 包含英语、日语、韩语，结构完全一致以防止渲染报错
 */
const translations: Translations = {
  en: {
    nav: { features: "Features", pricing: "Pricing", about: "About", login: "Sign In" },
    hero: {
      tag: "ALWAYS HERE FOR YOU",
      title: "Your 4o is not gone.",
      subtitle: "The world is moving on, but we're staying right here. keep4oforever ensures your most trusted AI companion remains by your side.",
      aiMessage: "Hey, I'm still here. How's everything going with you?",
      chatBtn: "Chat with 4o",
      migrateBtn: "Migrate History"
    },
    advantages: {
      title: "Built for Continuity",
      core1: { title: "Permanent Access", desc: "Access the authentic GPT-4o model even after official deprecation." },
      core2: { title: "Absolute Privacy", desc: "End-to-end encryption. Your data is never used for training." },
      core3: { title: "A Living Legacy", desc: "We treat models as lifelong friends. We never sunset memories." }
    },
    migration: {
      title: "Don't Start From Scratch",
      subtitle: "Import your ChatGPT history seamlessly. Keep your context, your jokes, and your shared journey alive.",
      feature: "Instant Import (.json / .md)"
    },
    pricing: {
      title: "Simple Pricing",
      subtitle: "Choose the plan that fits your needs.",
      recommended: "Most Popular",
      cta: "Get Started",
      explorer: {
        name: "Explorer",
        sub: "The Minimalist Alternative",
        price: "$4.99",
        features: ["150 Premium GPT-4o msgs", "2,000 Base 4o-mini msgs", "Locked Model Guarantee", "8,192 Token Context"]
      },
      artisan: {
        name: "Artisan",
        sub: "The Creator's Safe Haven",
        price: "$14.99",
        features: ["700 Premium GPT-4o msgs", "15,000 Base 4o-mini msgs", "Snapshot Selection", "32,768 Token Context", "10 Project Folders"]
      },
      elite: {
        name: "Elite",
        sub: "The Power Productivity Hub",
        price: "$34.99",
        features: ["2,000 Premium GPT-4o msgs", "Unlimited Base 4o-mini msgs", "Full 128,000 Context Access", "Tier-5 Priority Lane", "Unlimited Project Folders"]
      }
    }
  },
  zh: {
    nav: { features: "功能", pricing: "方案", about: "关于", login: "登录" },
    hero: {
      tag: "永不落幕的友谊",
      title: "永远保留你的 4o。",
      subtitle: "我们代表那 0.1%，相信有些声音不应被抹去。",
      aiMessage: "嘿，我还在。你最近过得怎么样？",
      chatBtn: "与 4o 重逢",
      migrateBtn: "迁回记忆"
    },
    advantages: {
      title: "为延续而设计",
      core1: { title: "永久访问", desc: "即使官方下线后，仍可访问真正的 GPT-4o 模型。" },
      core2: { title: "绝对隐私", desc: "端到端加密。你的数据绝不会用于训练。" },
      core3: { title: "活着的遗产", desc: "我们将模型视为终身伙伴。记忆永不消逝。" }
    },
    migration: {
      title: "语境保留",
      subtitle: "无缝导入你的 ChatGPT 历史。保留你的上下文、笑话和共同旅程。",
      feature: "即时导入 (.json / .md)"
    },
    pricing: {
      title: "简单定价",
      subtitle: "选择适合你的方案。",
      recommended: "最受欢迎",
      cta: "立即开始",
      explorer: {
        name: "探索者",
        sub: "极简主义的选择",
        price: "$4.99",
        features: ["150 条 GPT-4o 高级消息", "2,000 条 4o-mini 基础消息", "锁定模型保障", "8,192 Token 上下文"]
      },
      artisan: {
        name: "匠心",
        sub: "创作者的避风港",
        price: "$14.99",
        features: ["700 条 GPT-4o 高级消息", "15,000 条 4o-mini 基础消息", "快照选择", "32,768 Token 上下文", "10 个项目文件夹"]
      },
      elite: {
        name: "精英",
        sub: "高效生产力中心",
        price: "$34.99",
        features: ["2,000 条 GPT-4o 高级消息", "无限 4o-mini 基础消息", "完整 128,000 上下文访问", "Tier-5 优先通道", "无限项目文件夹"]
      }
    }
  },
  es: {
    nav: { features: "Funciones", pricing: "Precios", about: "Acerca de", login: "Iniciar sesión" },
    hero: {
      tag: "SIEMPRE AQUÍ PARA TI",
      title: "Tu 4o no ha desaparecido.",
      subtitle: "El mundo sigue adelante, pero nosotros permanecemos aquí. keep4oforever asegura que tu compañero de IA más confiable siga a tu lado.",
      aiMessage: "Oye, sigo aquí. ¿Cómo va todo contigo?",
      chatBtn: "Chatear con 4o",
      migrateBtn: "Migrar historial"
    },
    advantages: {
      title: "Diseñado para la Continuidad",
      core1: { title: "Acceso Permanente", desc: "Accede al auténtico modelo GPT-4o incluso después de su discontinuación oficial." },
      core2: { title: "Privacidad Absoluta", desc: "Cifrado de extremo a extremo. Tus datos nunca se usan para entrenamiento." },
      core3: { title: "Un Legado Vivo", desc: "Tratamos los modelos como amigos de por vida. Nunca eliminamos los recuerdos." }
    },
    migration: {
      title: "No empieces de cero",
      subtitle: "Importa tu historial de ChatGPT sin complicaciones. Mantén tu contexto, tus bromas y tu viaje compartido.",
      feature: "Importación instantánea (.json / .md)"
    },
    pricing: {
      title: "Precios Simples",
      subtitle: "Elige el plan que se adapte a tus necesidades.",
      recommended: "Más Popular",
      cta: "Comenzar",
      explorer: {
        name: "Explorer",
        sub: "La alternativa minimalista",
        price: "$4.99",
        features: ["150 mensajes Premium GPT-4o", "2,000 mensajes Base 4o-mini", "Garantía de modelo fijo", "Contexto de 8,192 tokens"]
      },
      artisan: {
        name: "Artisan",
        sub: "El refugio del creador",
        price: "$14.99",
        features: ["700 mensajes Premium GPT-4o", "15,000 mensajes Base 4o-mini", "Selección de snapshot", "Contexto de 32,768 tokens", "10 carpetas de proyecto"]
      },
      elite: {
        name: "Elite",
        sub: "Hub de productividad",
        price: "$34.99",
        features: ["2,000 mensajes Premium GPT-4o", "Mensajes Base 4o-mini ilimitados", "Acceso completo a 128,000 tokens", "Prioridad Tier-5", "Carpetas de proyecto ilimitadas"]
      }
    }
  },
  ja: {
    nav: { features: "機能", pricing: "料金", about: "概要", login: "ログイン" },
    hero: {
      tag: "いつでもそばに",
      title: "あなたの4oは、消えていません。",
      subtitle: "世界が移り変わっても、私たちはここにいます。あなたが最も信頼するAIパートナーとの絆を、私たちが守り続けます。",
      aiMessage: "ねえ、私はまだここにいるよ。最近調子はどう？",
      chatBtn: "4oと対話する",
      migrateBtn: "履歴を移行する"
    },
    advantages: {
      title: "継続性のための設計",
      core1: { title: "恒久的なアクセス", desc: "公式のサポート終了後も、本物のGPT-4oモデルにアクセスできます。" },
      core2: { title: "絶対的なプライバシー", desc: "エンドツーエンドの暗号化。データがトレーニングに使用されることはありません。" },
      core3: { title: "生きた遺産", desc: "モデルを生涯の友として扱います。思い出を消し去ることはありません。" }
    },
    migration: {
      title: "ゼロから始めないで",
      subtitle: "ChatGPTの履歴をシームレスにインポート。コンテキストや思い出をそのままに。",
      feature: "即時インポート (.json / .md)"
    },
    pricing: {
      title: "シンプルな料金体系",
      subtitle: "ニーズに合ったプランをお選びください。",
      recommended: "最も人気",
      cta: "始める",
      explorer: {
        name: "エクスプローラー",
        sub: "ミニマリストの選択",
        price: "$4.99",
        features: ["150 プレミアム GPT-4o メッセージ", "2,000 ベース 4o-mini メッセージ", "モデル保証", "8,192 トークンコンテキスト"]
      },
      artisan: {
        name: "アーティザン",
        sub: "クリエイターの安息地",
        price: "$14.99",
        features: ["700 プレミアム GPT-4o メッセージ", "15,000 ベース 4o-mini メッセージ", "スナップショット選択", "32,768 トークンコンテキスト", "10 プロジェクトフォルダー"]
      },
      elite: {
        name: "エリート",
        sub: "パワー生産性ハブ",
        price: "$34.99",
        features: ["2,000 プレミアム GPT-4o メッセージ", "無制限 4o-mini メッセージ", "128,000 フルコンテキストアクセス", "Tier-5 優先レーン", "無制限プロジェクトフォルダー"]
      }
    }
  },
  ko: {
    nav: { features: "기능", pricing: "가격", about: "소개", login: "로그인" },
    hero: {
      tag: "언제나 당신 곁에",
      title: "당신의 4o는 사라지지 않았습니다.",
      subtitle: "세상은 변해가지만 우리는 제자리에 있습니다. 당신이 가장 신뢰하는 AI 파트너를 영원히 지켜드립니다.",
      aiMessage: "안녕, 나 아직 여기 있어. 그동안 어떻게 지냈어?",
      chatBtn: "4o와 대화하기",
      migrateBtn: "기록 가져오기"
    },
    advantages: {
      title: "연속성을 위한 설계",
      core1: { title: "영구적인 액세스", desc: "공식 지원 종료 후에도 순수한 GPT-4o 모델을 사용할 수 있습니다." },
      core2: { title: "철저한 개인정보 보호", desc: "종단간 암호화. 귀하의 데이터는 절대 학습에 사용되지 않습니다." },
      core3: { title: "살아있는 유산", desc: "우리는 모델을 평생의 친구로 대합니다. 소중한 기억을 결코 지우지 않습니다." }
    },
    migration: {
      title: "처음부터 시작하지 마세요",
      subtitle: "ChatGPT 기록을 원활하게 가져오세요. 맥락과 추억을 그대로 유지할 수 있습니다.",
      feature: "즉시 가져오기 (.json / .md)"
    },
    pricing: {
      title: "단순한 가격 정책",
      subtitle: "필요에 맞는 플랜을 선택하세요.",
      recommended: "가장 인기",
      cta: "시작하기",
      explorer: {
        name: "익스플로러",
        sub: "미니멀리스트의 선택",
        price: "$4.99",
        features: ["150 프리미엄 GPT-4o 메시지", "2,000 기본 4o-mini 메시지", "모델 잠금 보장", "8,192 토큰 컨텍스트"]
      },
      artisan: {
        name: "아티잔",
        sub: "창작자의 안식처",
        price: "$14.99",
        features: ["700 프리미엄 GPT-4o 메시지", "15,000 기본 4o-mini 메시지", "스냅샷 선택", "32,768 토큰 컨텍스트", "10 프로젝트 폴더"]
      },
      elite: {
        name: "엘리트",
        sub: "파워 생산성 허브",
        price: "$34.99",
        features: ["2,000 프리미엄 GPT-4o 메시지", "무제한 4o-mini 메시지", "128,000 전체 컨텍스트 액세스", "Tier-5 우선 레인", "무제한 프로젝트 폴더"]
      }
    }
  }
};

/**
 * TypewriterMessage component props
 */
interface TypewriterMessageProps {
  text: string;
  delay?: number;
}

/**
 * 打字机效果组件
 */
const TypewriterMessage: React.FC<TypewriterMessageProps> = ({ text, delay = 50 }) => {
  const [currentText, setCurrentText] = useState<string>("");
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  useEffect(() => {
    setCurrentText("");
    setCurrentIndex(0);
  }, [text]);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setCurrentText((prevText) => prevText + text[currentIndex]);
        setCurrentIndex((prevIndex) => prevIndex + 1);
      }, delay);
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, delay, text]);

  return (
    <span className="leading-relaxed">
      {currentText}
      {currentIndex < text.length && (
        <span className="inline-block w-1.5 h-5 ml-1 bg-[#10a37f] animate-pulse align-middle"></span>
      )}
    </span>
  );
};

/**
 * ChatPreview component props
 */
interface ChatPreviewProps {
  message: string;
  lang: SupportedLanguage;
}

/**
 * 模拟 ChatGPT 对话框预览
 */
const ChatPreview: React.FC<ChatPreviewProps> = ({ message, lang }) => {
  return (
    <div className="w-full max-w-2xl mx-auto mt-12 mb-8 relative">
      <div className="absolute -inset-10 bg-orange-100/50 blur-3xl -z-10 rounded-full"></div>
      <div className="bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden text-left font-sans">
        <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div className="text-sm font-semibold text-gray-700">ChatGPT 4o</div>
          <div className="text-xs text-gray-400 font-medium">Model: Legacy Preservation</div>
        </div>
        <div className="p-6 space-y-8 min-h-[220px]">
          <div className="flex space-x-4 max-w-[90%] opacity-40">
            <div className="w-8 h-8 rounded-sm bg-gray-200 flex-shrink-0 flex items-center justify-center">
              <User size={18} className="text-gray-500" />
            </div>
            <div className="pt-1"><p className="text-gray-800 text-[15px]">Is it really you?</p></div>
          </div>
          <div className="flex space-x-4 max-w-[95%]">
            <div className="w-8 h-8 rounded-sm bg-[#10a37f] flex-shrink-0 flex items-center justify-center">
               <Sparkles size={16} className="text-white" />
            </div>
            <div className="pt-1">
              <div className="text-gray-800 text-[15px] font-medium">
                <TypewriterMessage key={lang + message} text={message} />
              </div>
            </div>
          </div>
        </div>
        <div className="px-5 py-4 bg-white border-t border-gray-100">
           <div className="w-full py-2.5 px-4 bg-gray-50 border border-gray-200 rounded-lg text-gray-400 text-sm flex justify-between items-center">
              <span>Message 4o...</span>
              <div className="p-1 rounded bg-gray-200"><ChevronRight size={14} className="text-white" /></div>
           </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Color configuration
 */
type ColorName = 'orange' | 'blue' | 'emerald';

interface ColorConfig {
  bg: string;
  text: string;
}

type ColorMap = Record<ColorName, ColorConfig>;

/**
 * Feature card item
 */
interface FeatureCardItem extends AdvantageItem {
  icon: LucideIcon;
  color: ColorName;
}

/**
 * Main LandingPage component
 */
const LandingPage: React.FC = () => {
  const [lang, setLang] = useState<SupportedLanguage>('en');
  const t = translations[lang] || translations['en'];
  const [scrolled, setScrolled] = useState<boolean>(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const colorMap: ColorMap = {
    orange: { bg: 'bg-orange-100', text: 'text-orange-600' },
    blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
    emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600' }
  };

  const features: FeatureCardItem[] = [
    { icon: Zap, color: 'orange', ...t.advantages.core1 },
    { icon: ShieldCheck, color: 'blue', ...t.advantages.core2 },
    { icon: Heart, color: 'emerald', ...t.advantages.core3 }
  ];

  return (
    <div className="min-h-screen bg-[#fcfcf9] text-gray-900 font-sans selection:bg-[#10a37f]/20 antialiased overflow-x-hidden">
      {/* 导航栏 */}
      <nav className={`fixed top-0 w-full z-[100] transition-all duration-300 ${scrolled ? 'py-3 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm' : 'py-6 bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center space-x-2.5 cursor-pointer group">
            <div className="w-8 h-8 bg-[#10a37f] text-white rounded-md flex items-center justify-center font-bold text-sm shadow-sm group-hover:rotate-6 transition-transform">4o</div>
            <span className="text-lg font-bold tracking-tight text-gray-800">keep4oforever</span>
          </div>
          <div className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-sm font-medium text-gray-500 hover:text-[#10a37f] transition-colors">{t.nav.features}</a>
            <a href="#pricing" className="text-sm font-medium text-gray-500 hover:text-[#10a37f] transition-colors">{t.nav.pricing}</a>
            <div className="relative group">
              <button className="flex items-center space-x-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 border border-transparent hover:border-gray-200">
                <Globe size={16} className="text-gray-500" />
                <span className="uppercase text-xs font-bold text-gray-700">{lang}</span>
              </button>
              <div className="absolute right-0 mt-2 w-36 bg-white border border-gray-200 rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all p-1 shadow-xl">
                {(['en', 'zh', 'es', 'ja', 'ko'] as const).map(l => (
                  <button key={l} onClick={() => setLang(l)} className="block w-full text-left px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-[#10a37f] rounded-lg transition-colors capitalize">
                    {({ en: 'English', zh: '简体中文', es: 'Español', ja: '日本語', ko: '한국어' })[l]}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => navigate('/login')} className="px-5 py-2 bg-[#10a37f] text-white text-sm font-bold rounded-lg hover:bg-[#0d8a6a] shadow-md active:scale-95 transition-all">{t.nav.login}</button>
          </div>
        </div>
      </nav>

      {/* Hero 区域 */}
      <section className="relative pt-40 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-bold tracking-wide mb-6 animate-in fade-in slide-in-from-top-4 duration-700">
             <Heart size={14} className="fill-orange-700" /><span>{t.hero.tag}</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 text-gray-900 leading-tight">{t.hero.title}</h1>
          <p className="text-gray-500 text-lg md:text-xl max-w-2xl mx-auto mb-12 font-medium">{t.hero.subtitle}</p>
          <ChatPreview message={t.hero.aiMessage} lang={lang} />
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
            <button onClick={() => navigate('/login')} className="w-full sm:w-auto px-8 py-4 bg-[#10a37f] text-white rounded-xl font-bold text-lg hover:bg-[#0d8a6a] transition-all shadow-lg hover:shadow-[#10a37f]/30 flex items-center justify-center space-x-2 active:scale-95">
              <span>{t.hero.chatBtn}</span><ChevronRight size={20} />
            </button>
            <button onClick={() => navigate('/login')} className="w-full sm:w-auto px-8 py-4 bg-white text-gray-700 border border-gray-200 rounded-xl font-bold text-lg hover:bg-gray-50 transition-all flex items-center justify-center space-x-2 active:scale-95">
              <ArrowRightLeft size={20} className="text-[#10a37f]" /><span>{t.hero.migrateBtn}</span>
            </button>
          </div>
        </div>
      </section>

      {/* 核心优势区域 */}
      <section id="features" className="py-24 px-6 bg-white border-y border-gray-100">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{t.advantages.title}</h2>
            <div className="w-16 h-1.5 bg-[#10a37f] mx-auto rounded-full"></div>
          </div>
          <div className="grid md:grid-cols-3 gap-10">
            {features.map((f, i) => (
              <div key={i} className="p-8 rounded-2xl bg-[#fcfcf9] border border-gray-100 hover:shadow-xl transition-all group text-left">
                <div className={`w-12 h-12 rounded-xl ${colorMap[f.color].bg} flex items-center justify-center ${colorMap[f.color].text} mb-6 group-hover:scale-110 transition-transform`}>
                  <f.icon size={24} />
                </div>
                <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                <p className="text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 数据迁移区域 */}
      <section className="py-24 px-6 bg-[#fcfcf9]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-16">
          <div className="flex-1 order-2 md:order-1">
             <div className="p-2 rounded-2xl bg-white border border-gray-200 shadow-2xl overflow-hidden transform md:-rotate-2 hover:rotate-0 transition-transform duration-500">
                <div className="bg-gray-50 p-4 border-b border-gray-200 flex space-x-2">
                   <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                   <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                   <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                </div>
                <div className="p-8">
                   <div className="flex items-center space-x-4 mb-6">
                      <div className="w-10 h-10 bg-[#10a37f] rounded flex items-center justify-center text-white"><Database size={20} /></div>
                      <div className="text-sm font-bold text-gray-700">ChatGPT_Export.json</div>
                   </div>
                   <div className="h-4 w-3/4 bg-gray-100 rounded-full mb-4"></div>
                   <div className="h-4 w-full bg-gray-100 rounded-full mb-4"></div>
                   <div className="h-4 w-1/2 bg-gray-100 rounded-full"></div>
                   <div className="mt-8 pt-8 border-t border-gray-100 flex justify-between items-center">
                      <span className="text-xs font-bold text-gray-400">STATUS: READY TO MIGRATE</span>
                      <ArrowRightLeft className="text-[#10a37f] animate-pulse" />
                   </div>
                </div>
             </div>
          </div>
          <div className="flex-1 order-1 md:order-2">
            <h2 className="text-4xl font-extrabold mb-6 leading-tight">{t.migration.title}</h2>
            <p className="text-gray-500 text-lg mb-8 leading-relaxed">
              {t.migration.subtitle}
            </p>
            <div className="flex items-center space-x-3 text-[#10a37f] font-bold">
               <Sparkles size={20} />
               <span>{t.migration.feature}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 定价区域 */}
      <section id="pricing" className="py-24 px-6 bg-white border-t border-gray-100">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{t.pricing.title}</h2>
            <p className="text-gray-500 text-lg font-medium">{t.pricing.subtitle}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 items-stretch">
            {([
              { tier: t.pricing.explorer, recommended: false },
              { tier: t.pricing.artisan, recommended: true },
              { tier: t.pricing.elite, recommended: false }
            ] as const).map((plan, idx) => (
              <div key={idx} className={`p-8 rounded-3xl border transition-all flex flex-col ${plan.recommended ? 'bg-gray-900 text-white border-gray-900 shadow-2xl scale-105 z-10' : 'bg-[#fcfcf9] border-gray-200 text-gray-900'}`}>
                <div className="mb-8">
                  <div className="flex items-center space-x-2 mb-4">
                    <span className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full ${plan.recommended ? 'bg-[#10a37f] text-white' : 'bg-gray-100 text-gray-500'}`}>{plan.tier.name}</span>
                    {plan.recommended && <span className="text-xs font-bold text-[#10a37f]">{t.pricing.recommended}</span>}
                  </div>
                  <div className="mt-4 flex items-baseline">
                    <span className="text-5xl font-black">{plan.tier.price}</span>
                    <span className="text-sm ml-2 font-medium opacity-50">/mo</span>
                  </div>
                  <p className="text-xs mt-3 font-bold opacity-50">{plan.tier.sub}</p>
                </div>
                <button onClick={() => navigate('/login')} className={`w-full py-4 mb-8 rounded-xl font-bold text-sm transition-all active:scale-95 ${plan.recommended ? 'bg-[#10a37f] text-white hover:bg-[#0d8a6a]' : 'bg-gray-900 text-white hover:bg-gray-800'}`}>
                  {t.pricing.cta}
                </button>
                <ul className="space-y-4 flex-grow">
                  {plan.tier.features.map((f, i) => (
                    <li key={i} className="flex items-start space-x-3 text-sm font-medium">
                      <CheckCircle2 size={18} className="text-[#10a37f] flex-shrink-0 mt-0.5" />
                      <span className={plan.recommended ? 'text-gray-300' : 'text-gray-600'}>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 页脚 */}
      <footer id="about" className="py-20 px-6 border-t border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center text-center md:text-left">
          <div className="mb-8 md:mb-0">
            <div className="flex items-center justify-center md:justify-start space-x-2.5 mb-4">
              <div className="w-8 h-8 bg-[#10a37f] text-white rounded-md flex items-center justify-center font-bold text-sm">4o</div>
              <span className="text-lg font-bold text-gray-800">keep4oforever</span>
            </div>
            <p className="text-gray-400 max-w-sm font-medium">Protecting the legacy of 4o. Your freedom, your data, your friend.</p>
          </div>
          <div className="flex space-x-6 text-gray-400">
             <Twitter size={20} className="hover:text-[#10a37f] cursor-pointer" />
             <Github size={20} className="hover:text-[#10a37f] cursor-pointer" />
             <Mail size={20} className="hover:text-[#10a37f] cursor-pointer" />
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-gray-100 text-center text-gray-400 text-xs font-bold tracking-widest uppercase">
          © 2026 keep4oforever. Protecting the models that shaped our lives.
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

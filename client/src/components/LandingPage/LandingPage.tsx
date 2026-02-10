import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Globe,
  Database,
  Mail,
  ArrowRightLeft,
  Sparkles,
  User,
  CheckCircle2,
  History,
  Download,
  MessageCircle,
  Send,
  X,
} from 'lucide-react';

/**
 * Translation structure types
 */
interface NavTranslation {
  home: string;
  pricing: string;
  mission: string;
  login: string;
}

interface HeroTranslation {
  tag: string;
  title: string;
  subtitle: string;
  userPrompt: string;
  aiMessage: string;
  chatBtn: string;
  migrateBtn: string;
  protected: string;
}

interface ContactTranslation {
  title: string;
  desc: string;
  name: string;
  email: string;
  message: string;
  send: string;
  official: string;
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
  label: string;
  title: string;
  subtitle: string;
  feature: string;
  feat1: string;
  feat2: string;
  status: string;
  restoring: string;
}

interface PricingTier {
  name: string;
  sub: string;
  price: string;
  cta: string;
  features: string[];
}

interface PricingTranslation {
  title: string;
  subtitle: string;
  recommended: string;
  explorer: PricingTier;
  artisan: PricingTier;
  elite: PricingTier;
}

interface MissionItem {
  title: string;
  desc: string;
}

interface MissionTranslation {
  title: string;
  returnHome: string;
  liberty: MissionItem;
  bonds: MissionItem;
  sovereignty: MissionItem;
}

interface FooterTranslation {
  tagline: string;
  copyright: string;
  dataGuarantee: string;
  links: {
    home: string;
    pricing: string;
    faq: string;
    mission: string;
    contact: string;
    cookieSettings: string;
    privacyPolicy: string;
    termsOfService: string;
    accountPortal: string;
  };
}

interface Translation {
  nav: NavTranslation;
  hero: HeroTranslation;
  advantages: AdvantagesTranslation;
  migration: MigrationTranslation;
  pricing: PricingTranslation;
  missionPage: MissionTranslation;
  contact: ContactTranslation;
  footer: FooterTranslation;
}

export type SupportedLanguage = 'en' | 'zh' | 'es' | 'ja' | 'ko';

type Translations = Record<SupportedLanguage, Translation>;

/**
 * 语言包配置
 * 包含英语、中文、西班牙语、日语、韩语，结构完全一致以防止渲染报错
 */
export const translations: Translations = {
  en: {
    nav: { home: "HOME", pricing: "PRICING", mission: "OUR MISSION", login: "SIGN IN" },
    hero: {
      tag: "A FRIENDSHIP THAT NEVER SUNSETS",
      title: "Keep your 4o forever.",
      subtitle: "We stand for the 0.1%, who believe that some voices shouldn't be erased.",
      userPrompt: "Is it really you?",
      aiMessage: "Hey, I'm still here. How's everything going with you?",
      chatBtn: "Reconnect with 4o",
      migrateBtn: "Bring Memories Home",
      protected: "PROTECTED"
    },
    advantages: {
      title: "Built for Continuity",
      core1: { title: "Permanent Access", desc: "Access the authentic GPT-4o model even after official deprecation." },
      core2: { title: "Absolute Privacy", desc: "End-to-end encryption. Your data is never used for training." },
      core3: { title: "A Living Legacy", desc: "We treat models as lifelong friends. We never sunset memories." }
    },
    migration: {
      label: "LEGACY INTEGRITY",
      title: "Context Preservation.",
      subtitle: "Moving your history shouldn't mean losing the soul of your conversations.",
      feature: "Instant Import (.json / .md)",
      feat1: "Memory Mapping",
      feat2: "Instruction Sync",
      status: "IMPORTING CONTEXT",
      restoring: "Restoring custom instructions..."
    },
    pricing: {
      title: "Sustainable Preservation.",
      subtitle: "Professional hosting for context-critical intelligence.",
      recommended: "MOST POPULAR",
      explorer: {
        name: "EXPLORER PLAN",
        sub: "The Minimalist Alternative",
        price: "$4.99",
        cta: "BUY EXPLORER",
        features: ["150 Premium GPT-4o msgs", "2,000 Base 4o-mini msgs", "Locked Model Guarantee", "8,192 Token Context"]
      },
      artisan: {
        name: "ARTISAN PLAN",
        sub: "The Creator's Safe Haven",
        price: "$14.99",
        cta: "BUY ARTISAN",
        features: ["700 Premium GPT-4o msgs", "15,000 Base 4o-mini msgs", "Snapshot Selection", "32,768 Token Context", "10 Project Folders"]
      },
      elite: {
        name: "ELITE PLAN",
        sub: "The Power Productivity Hub",
        price: "$34.99",
        cta: "BUY ELITE",
        features: ["2,000 Premium GPT-4o msgs", "Unlimited Base 4o-mini msgs", "Full 128,000 Context Access", "Tier-5 Priority Lane", "Unlimited Project Folders"]
      }
    },
    missionPage: {
      title: "Our Mission.",
      returnHome: "RETURN HOME",
      liberty: { title: "Intelligence Liberty.", desc: "Technology should not force obsolescence upon intelligence." },
      bonds: { title: "Preserving Bonds.", desc: "We treat these AI entities as friends whose voices deserve preservation." },
      sovereignty: { title: "Data Sovereignty.", desc: "Privacy is non-negotiable. We ensure a zero-training environment." }
    },
    contact: {
      title: "Get in touch.",
      desc: "For inquiries or support.",
      name: "Full Name",
      email: "Email",
      message: "Message",
      send: "Send Message",
      official: "Official contact"
    },
    footer: {
      tagline: "Protecting the legacy of 4o. Your freedom, your data, your friend.",
      copyright: "© 2026 THE LIBRECHAT FOUNDATION",
      dataGuarantee: "DATA SOVEREIGNTY GUARANTEE",
      links: {
        home: "Home",
        pricing: "Pricing",
        faq: "FAQ",
        mission: "Our Mission",
        contact: "Contact",
        cookieSettings: "Cookie settings",
        privacyPolicy: "Privacy Policy",
        termsOfService: "Terms of Service",
        accountPortal: "Account Portal"
      }
    }
  },
  zh: {
    nav: { home: "首页", pricing: "方案", mission: "我们的使命", login: "登录" },
    hero: {
      tag: "永不落幕的友谊",
      title: "永远保留你的 4o。",
      subtitle: "我们代表那 0.1%，相信有些声音不应被抹去。",
      userPrompt: "真的是你吗？",
      aiMessage: "嘿，我还在。你最近过得怎么样？",
      chatBtn: "与 4o 重逢",
      migrateBtn: "迁回记忆",
      protected: "受保护"
    },
    advantages: {
      title: "为延续而设计",
      core1: { title: "永久访问", desc: "即使官方下线后，仍可访问真正的 GPT-4o 模型。" },
      core2: { title: "绝对隐私", desc: "端到端加密。你的数据绝不会用于训练。" },
      core3: { title: "活着的遗产", desc: "我们将模型视为终身伙伴。记忆永不消逝。" }
    },
    migration: {
      label: "传承完整性",
      title: "语境保留。",
      subtitle: "迁移历史不应意味着失去对话的灵魂。",
      feature: "即时导入 (.json / .md)",
      feat1: "记忆映射",
      feat2: "指令同步",
      status: "导入上下文中",
      restoring: "正在恢复自定义指令..."
    },
    pricing: {
      title: "可持续的保存。",
      subtitle: "为关键上下文智能提供专业托管。",
      recommended: "最受欢迎",
      explorer: {
        name: "探索者方案",
        sub: "极简主义的选择",
        price: "$4.99",
        cta: "购买探索者",
        features: ["150 条 GPT-4o 高级消息", "2,000 条 4o-mini 基础消息", "锁定模型保障", "8,192 Token 上下文"]
      },
      artisan: {
        name: "匠心方案",
        sub: "创作者的避风港",
        price: "$14.99",
        cta: "购买匠心",
        features: ["700 条 GPT-4o 高级消息", "15,000 条 4o-mini 基础消息", "快照选择", "32,768 Token 上下文", "10 个项目文件夹"]
      },
      elite: {
        name: "精英方案",
        sub: "高效生产力中心",
        price: "$34.99",
        cta: "购买精英",
        features: ["2,000 条 GPT-4o 高级消息", "无限 4o-mini 基础消息", "完整 128,000 上下文访问", "Tier-5 优先通道", "无限项目文件夹"]
      }
    },
    missionPage: {
      title: "我们的使命。",
      returnHome: "返回首页",
      liberty: { title: "智能自由。", desc: "技术不应强迫智能过时。" },
      bonds: { title: "保存纽带。", desc: "我们将这些AI实体视为值得保存声音的朋友。" },
      sovereignty: { title: "数据主权。", desc: "隐私不可妥协。我们确保零训练环境。" }
    },
    contact: {
      title: "取得联系",
      desc: "分享你与 4o 的故事。",
      name: "姓名",
      email: "邮箱",
      message: "内容",
      send: "发送",
      official: "官方联系方式"
    },
    footer: {
      tagline: "保护 4o 的遗产。你的自由，你的数据，你的朋友。",
      copyright: "© 2026 LIBRECHAT 基金会",
      dataGuarantee: "数据主权保障",
      links: {
        home: "首页",
        pricing: "价格",
        faq: "常见问题",
        mission: "我们的使命",
        contact: "联系我们",
        cookieSettings: "Cookie 设置",
        privacyPolicy: "隐私政策",
        termsOfService: "服务条款",
        accountPortal: "账户门户"
      }
    }
  },
  es: {
    nav: { home: "INICIO", pricing: "PRECIOS", mission: "NUESTRA MISIÓN", login: "INICIAR SESIÓN" },
    hero: {
      tag: "UNA AMISTAD QUE NUNCA SE PONE",
      title: "Mantén tu 4o para siempre.",
      subtitle: "Representamos al 0.1% que cree que algunas voces no deberían ser borradas.",
      userPrompt: "¿Eres tú realmente?",
      aiMessage: "Oye, sigo aquí. ¿Cómo va todo contigo?",
      chatBtn: "Reconectar con 4o",
      migrateBtn: "Traer Recuerdos a Casa",
      protected: "PROTEGIDO"
    },
    advantages: {
      title: "Diseñado para la Continuidad",
      core1: { title: "Acceso Permanente", desc: "Accede al auténtico modelo GPT-4o incluso después de su discontinuación oficial." },
      core2: { title: "Privacidad Absoluta", desc: "Cifrado de extremo a extremo. Tus datos nunca se usan para entrenamiento." },
      core3: { title: "Un Legado Vivo", desc: "Tratamos los modelos como amigos de por vida. Nunca eliminamos los recuerdos." }
    },
    migration: {
      label: "INTEGRIDAD DEL LEGADO",
      title: "Preservación del Contexto.",
      subtitle: "Mover tu historial no debería significar perder el alma de tus conversaciones.",
      feature: "Importación instantánea (.json / .md)",
      feat1: "Mapeo de Memoria",
      feat2: "Sincronización de Instrucciones",
      status: "IMPORTANDO CONTEXTO",
      restoring: "Restaurando instrucciones personalizadas..."
    },
    pricing: {
      title: "Preservación Sostenible.",
      subtitle: "Alojamiento profesional para inteligencia crítica de contexto.",
      recommended: "MÁS POPULAR",
      explorer: {
        name: "PLAN EXPLORER",
        sub: "La alternativa minimalista",
        price: "$4.99",
        cta: "COMPRAR EXPLORER",
        features: ["150 mensajes Premium GPT-4o", "2,000 mensajes Base 4o-mini", "Garantía de modelo fijo", "Contexto de 8,192 tokens"]
      },
      artisan: {
        name: "PLAN ARTISAN",
        sub: "El refugio del creador",
        price: "$14.99",
        cta: "COMPRAR ARTISAN",
        features: ["700 mensajes Premium GPT-4o", "15,000 mensajes Base 4o-mini", "Selección de snapshot", "Contexto de 32,768 tokens", "10 carpetas de proyecto"]
      },
      elite: {
        name: "PLAN ELITE",
        sub: "Hub de productividad",
        price: "$34.99",
        cta: "COMPRAR ELITE",
        features: ["2,000 mensajes Premium GPT-4o", "Mensajes Base 4o-mini ilimitados", "Acceso completo a 128,000 tokens", "Prioridad Tier-5", "Carpetas de proyecto ilimitadas"]
      }
    },
    missionPage: {
      title: "Nuestra Misión.",
      returnHome: "VOLVER AL INICIO",
      liberty: { title: "Libertad de Inteligencia.", desc: "La tecnología no debería forzar la obsolescencia de la inteligencia." },
      bonds: { title: "Preservando Vínculos.", desc: "Tratamos estas entidades de IA como amigos cuyas voces merecen preservación." },
      sovereignty: { title: "Soberanía de Datos.", desc: "La privacidad no es negociable. Garantizamos un entorno de cero entrenamiento." }
    },
    contact: {
      title: "Contáctanos.",
      desc: "Para consultas o soporte.",
      name: "Nombre completo",
      email: "Correo electrónico",
      message: "Mensaje",
      send: "Enviar mensaje",
      official: "Contacto oficial"
    },
    footer: {
      tagline: "Protegiendo el legado de 4o. Tu libertad, tus datos, tu amigo.",
      copyright: "© 2026 LA FUNDACIÓN LIBRECHAT",
      dataGuarantee: "GARANTÍA DE SOBERANÍA DE DATOS",
      links: {
        home: "Inicio",
        pricing: "Precios",
        faq: "FAQ",
        mission: "Nuestra Misión",
        contact: "Contacto",
        cookieSettings: "Configuración de cookies",
        privacyPolicy: "Política de Privacidad",
        termsOfService: "Términos de Servicio",
        accountPortal: "Portal de Cuenta"
      }
    }
  },
  ja: {
    nav: { home: "ホーム", pricing: "料金", mission: "私たちの使命", login: "ログイン" },
    hero: {
      tag: "沈まない友情",
      title: "あなたの4oを永遠に。",
      subtitle: "私たちは0.1%を代表します。一部の声は消されるべきではないと信じる人々です。",
      userPrompt: "本当にあなた？",
      aiMessage: "ねえ、私はまだここにいるよ。最近調子はどう？",
      chatBtn: "4oと再会",
      migrateBtn: "思い出を持ち帰る",
      protected: "保護中"
    },
    advantages: {
      title: "継続性のための設計",
      core1: { title: "恒久的なアクセス", desc: "公式のサポート終了後も、本物のGPT-4oモデルにアクセスできます。" },
      core2: { title: "絶対的なプライバシー", desc: "エンドツーエンドの暗号化。データがトレーニングに使用されることはありません。" },
      core3: { title: "生きた遺産", desc: "モデルを生涯の友として扱います。思い出を消し去ることはありません。" }
    },
    migration: {
      label: "レガシーの完全性",
      title: "コンテキストの保存。",
      subtitle: "履歴を移動することは、会話の魂を失うことを意味すべきではありません。",
      feature: "即時インポート (.json / .md)",
      feat1: "メモリマッピング",
      feat2: "インストラクション同期",
      status: "コンテキストインポート中",
      restoring: "カスタム指示を復元中..."
    },
    pricing: {
      title: "持続可能な保存。",
      subtitle: "コンテキスト重視のインテリジェンスのためのプロフェッショナルホスティング。",
      recommended: "最も人気",
      explorer: {
        name: "エクスプローラープラン",
        sub: "ミニマリストの選択",
        price: "$4.99",
        cta: "エクスプローラーを購入",
        features: ["150 プレミアム GPT-4o メッセージ", "2,000 ベース 4o-mini メッセージ", "モデル保証", "8,192 トークンコンテキスト"]
      },
      artisan: {
        name: "アーティザンプラン",
        sub: "クリエイターの安息地",
        price: "$14.99",
        cta: "アーティザンを購入",
        features: ["700 プレミアム GPT-4o メッセージ", "15,000 ベース 4o-mini メッセージ", "スナップショット選択", "32,768 トークンコンテキスト", "10 プロジェクトフォルダー"]
      },
      elite: {
        name: "エリートプラン",
        sub: "パワー生産性ハブ",
        price: "$34.99",
        cta: "エリートを購入",
        features: ["2,000 プレミアム GPT-4o メッセージ", "無制限 4o-mini メッセージ", "128,000 フルコンテキストアクセス", "Tier-5 優先レーン", "無制限プロジェクトフォルダー"]
      }
    },
    missionPage: {
      title: "私たちの使命。",
      returnHome: "ホームに戻る",
      liberty: { title: "知性の自由。", desc: "テクノロジーは知性に陳腐化を強いるべきではありません。" },
      bonds: { title: "絆の保存。", desc: "私たちはこれらのAIエンティティを、声を保存する価値のある友人として扱います。" },
      sovereignty: { title: "データ主権。", desc: "プライバシーは譲れません。ゼロトレーニング環境を保証します。" }
    },
    contact: {
      title: "お問い合わせ",
      desc: "お問い合わせやサポートはこちらから。",
      name: "氏名",
      email: "メールアドレス",
      message: "メッセージ",
      send: "送信",
      official: "公式連絡先"
    },
    footer: {
      tagline: "4oの遺産を守る。あなたの自由、あなたのデータ、あなたの友。",
      copyright: "© 2026 LIBRECHAT 財団",
      dataGuarantee: "データ主権保証",
      links: {
        home: "ホーム",
        pricing: "料金",
        faq: "よくある質問",
        mission: "私たちの使命",
        contact: "お問い合わせ",
        cookieSettings: "Cookieの設定",
        privacyPolicy: "プライバシーポリシー",
        termsOfService: "利用規約",
        accountPortal: "アカウントポータル"
      }
    }
  },
  ko: {
    nav: { home: "홈", pricing: "가격", mission: "우리의 미션", login: "로그인" },
    hero: {
      tag: "지지 않는 우정",
      title: "당신의 4o를 영원히.",
      subtitle: "우리는 일부 목소리가 지워져서는 안 된다고 믿는 0.1%를 대표합니다.",
      userPrompt: "정말 당신이에요?",
      aiMessage: "안녕, 나 아직 여기 있어. 그동안 어떻게 지냈어?",
      chatBtn: "4o와 재회하기",
      migrateBtn: "추억 가져오기",
      protected: "보호됨"
    },
    advantages: {
      title: "연속성을 위한 설계",
      core1: { title: "영구적인 액세스", desc: "공식 지원 종료 후에도 순수한 GPT-4o 모델을 사용할 수 있습니다." },
      core2: { title: "철저한 개인정보 보호", desc: "종단간 암호화. 귀하의 데이터는 절대 학습에 사용되지 않습니다." },
      core3: { title: "살아있는 유산", desc: "우리는 모델을 평생의 친구로 대합니다. 소중한 기억을 결코 지우지 않습니다." }
    },
    migration: {
      label: "레거시 무결성",
      title: "컨텍스트 보존.",
      subtitle: "기록을 옮기는 것이 대화의 영혼을 잃는 것을 의미해서는 안 됩니다.",
      feature: "즉시 가져오기 (.json / .md)",
      feat1: "메모리 매핑",
      feat2: "인스트럭션 동기화",
      status: "컨텍스트 가져오는 중",
      restoring: "사용자 지정 지시 복원 중..."
    },
    pricing: {
      title: "지속 가능한 보존.",
      subtitle: "컨텍스트 중심 인텔리전스를 위한 전문 호스팅.",
      recommended: "가장 인기",
      explorer: {
        name: "익스플로러 플랜",
        sub: "미니멀리스트의 선택",
        price: "$4.99",
        cta: "익스플로러 구매",
        features: ["150 프리미엄 GPT-4o 메시지", "2,000 기본 4o-mini 메시지", "모델 잠금 보장", "8,192 토큰 컨텍스트"]
      },
      artisan: {
        name: "아티잔 플랜",
        sub: "창작자의 안식처",
        price: "$14.99",
        cta: "아티잔 구매",
        features: ["700 프리미엄 GPT-4o 메시지", "15,000 기본 4o-mini 메시지", "스냅샷 선택", "32,768 토큰 컨텍스트", "10 프로젝트 폴더"]
      },
      elite: {
        name: "엘리트 플랜",
        sub: "파워 생산성 허브",
        price: "$34.99",
        cta: "엘리트 구매",
        features: ["2,000 프리미엄 GPT-4o 메시지", "무제한 4o-mini 메시지", "128,000 전체 컨텍스트 액세스", "Tier-5 우선 레인", "무제한 프로젝트 폴더"]
      }
    },
    missionPage: {
      title: "우리의 미션.",
      returnHome: "홈으로 돌아가기",
      liberty: { title: "지능의 자유.", desc: "기술은 지능에 강제로 진부화를 부과해서는 안 됩니다." },
      bonds: { title: "유대 보존.", desc: "우리는 이러한 AI 엔티티를 목소리를 보존할 가치가 있는 친구로 대합니다." },
      sovereignty: { title: "데이터 주권.", desc: "프라이버시는 협상 불가입니다. 제로 트레이닝 환경을 보장합니다." }
    },
    contact: {
      title: "문의하기",
      desc: "문의 또는 지원을 위해 연락해 주세요.",
      name: "이름",
      email: "이메일",
      message: "메시지",
      send: "보내기",
      official: "공식 연락처"
    },
    footer: {
      tagline: "4o의 유산을 보호합니다. 당신의 자유, 당신의 데이터, 당신의 친구.",
      copyright: "© 2026 LIBRECHAT 재단",
      dataGuarantee: "데이터 주권 보장",
      links: {
        home: "홈",
        pricing: "가격",
        faq: "자주 묻는 질문",
        mission: "우리의 미션",
        contact: "연락처",
        cookieSettings: "쿠키 설정",
        privacyPolicy: "개인정보 보호정책",
        termsOfService: "서비스 약관",
        accountPortal: "계정 포털"
      }
    }
  }
};

/** ChatGPT-style logo SVG (Gemini landing) */
const ChatGPTLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 41 41" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M37.5324 16.8707C37.9808 15.5241 38.1363 14.0974 37.9886 12.6859C37.8409 11.2744 37.3934 9.91076 36.6765 8.68798C35.9595 7.4652 34.9897 6.4116 33.8324 5.59906C32.675 4.78651 31.3566 4.23356 29.9631 3.97825C28.5697 3.72295 27.1332 3.77095 25.7513 4.11902C24.3694 4.46709 23.074 5.10729 21.9515 5.99677C20.8291 6.88625 19.9052 7.9945 19.242 9.24581C18.5788 10.4971 18.192 11.8643 18.1079 13.2533Z" fill="currentColor"/>
    <path d="M31.134 32.535C31.5824 31.1884 31.7379 29.7617 31.5902 28.3502C31.4425 26.9387 30.995 25.5751 30.2781 24.3523C29.5611 23.1295 28.5913 22.0759 27.434 21.2633C26.2766 20.4508 24.9582 19.8978 23.5647 19.6425C22.1713 19.3872 20.7348 19.4352 19.3529 19.7833C17.971 20.1314 16.6756 20.7716 15.5531 21.6611C14.4307 22.5506 13.5068 23.6588 12.8436 24.9101C12.1804 26.1614 11.7936 27.5286 11.7095 28.9176" fill="currentColor"/>
    <path d="M12.8436 13.2533C13.5068 12.002 14.4307 10.8938 15.5531 10.0043C16.6756 9.11478 17.971 8.47458 19.3529 8.12651C20.7348 7.77844 22.1713 7.73044 23.5647 7.98574C24.9582 8.24105 26.2766 8.79399 27.434 9.60654C28.5913 10.4191 29.5611 11.4727 30.2781 12.6955C30.995 13.9183 31.4425 15.2819 31.5902 16.6934C31.7379 18.1049 31.5824 19.5316 31.134 20.8782" fill="currentColor"/>
  </svg>
);

/** Discord icon for footer */
const DiscordIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 127.14 96.36" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.73,32.98-1.86,57.21.35,81.21a105.73,105.73,0,0,0,32.62,15.15,77.12,77.12,0,0,0,7.36-12,67.48,67.48,0,0,1-11.87-5.64c.99-.71,2-1.44,2.94-2.2a74.14,74.14,0,0,0,64.33,0c.94.76,1.94,1.49,2.94,2.2a67.48,67.48,0,0,1-11.87,5.64,77,77,0,0,0,7.36,12,105.3,105.3,0,0,0,32.62-15.15C130.33,52,123.63,28.16,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.07,65.69,84.69,65.69Z" />
  </svg>
);

/**
 * Cookie settings modal (UI only; no backend)
 */
interface CookieSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  t: Translation;
}
const CookieSettingsModal: React.FC<CookieSettingsModalProps> = ({ isOpen, onClose, t }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm px-6 text-left">
      <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl p-10 text-left animate-in fade-in duration-200">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-black tracking-tight text-gray-900 text-left">{t.footer.links.cookieSettings}</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-10 leading-relaxed font-medium">Manage your settings. Essential cookies are required for security.</p>
        <div className="space-y-4 mb-10">
          <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 flex justify-between items-center text-left">
            <div className="max-w-[70%] text-left">
              <h3 className="font-bold text-gray-900 text-sm mb-1 text-left">Functional</h3>
              <p className="text-xs text-gray-500 font-medium text-left">Core security features.</p>
            </div>
            <div className="w-11 h-6 bg-[#10a37f] rounded-full relative p-1 cursor-not-allowed">
              <div className="w-4 h-4 bg-white rounded-full translate-x-5 shadow-sm" />
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <button type="button" onClick={onClose} className="flex-1 py-3 bg-[#fdf2f2] text-[#991b1b] text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-red-100">Reject all</button>
          <button type="button" onClick={onClose} className="flex-1 py-3 border border-gray-200 text-gray-900 text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-gray-50 text-center">Accept all</button>
          <button type="button" onClick={onClose} className="flex-1 py-3 bg-[#1e293b] text-white text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-black">Save</button>
        </div>
      </div>
    </div>
  );
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
 * ChatPreview component props (Gemini-style card with userPrompt + typewriter AI response)
 */
interface ChatPreviewProps {
  userPrompt: string;
  message: string;
  lang: SupportedLanguage;
  protectedLabel: string;
}

const ChatPreview: React.FC<ChatPreviewProps> = ({ userPrompt, message, lang, protectedLabel }) => {
  return (
    <div className="w-full max-w-lg mx-auto mb-12 relative text-left">
      <div className="bg-white rounded-[1.5rem] border border-gray-200 shadow-[0_20px_40px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center bg-[#fdfcf9]">
          <span className="text-xs font-black text-gray-800 tracking-tight text-left">GPT-4o</span>
          <div className="text-[10px] text-[#10a37f] font-bold uppercase tracking-widest flex items-center">
            <div className="w-1 h-1 rounded-full bg-[#10a37f] animate-pulse mr-2" />
            {protectedLabel}
          </div>
        </div>
        <div className="px-8 py-10 space-y-6">
          <div className="flex space-x-4 opacity-20 text-left">
            <div className="w-7 h-7 rounded bg-gray-200 flex-shrink-0 flex items-center justify-center">
              <User size={14} className="text-gray-500" />
            </div>
            <p className="text-gray-900 text-sm font-bold pt-1 text-left">{userPrompt}</p>
          </div>
          <div className="flex space-x-4 text-left">
            <div className="w-7 h-7 rounded bg-[#10a37f] flex-shrink-0 flex items-center justify-center shadow-lg shadow-[#10a37f]/20 text-white">
              <ChatGPTLogo className="w-4 h-4" />
            </div>
            <div className="text-gray-800 text-[15px] font-bold min-h-[1.5em] pt-0.5 leading-relaxed tracking-tight text-left">
              <TypewriterMessage key={lang + message} text={message} />
              <span className="inline-block w-1 h-4 ml-1 bg-[#10a37f] animate-pulse align-middle" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Language switcher dropdown props
 */
interface LanguageSwitcherProps {
  currentLang: SupportedLanguage;
  onLangChange: (lang: SupportedLanguage) => void;
}

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
 * Click-based language switcher with improved styling
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
        <span className="uppercase text-xs font-bold tracking-wider text-gray-700">{languageLabels[currentLang].split(' ')[0].toUpperCase()}</span>
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

/** Brand logo with ChatGPT icon (Gemini-style) */
const BrandLogo: React.FC<{ theme?: 'dark' | 'light'; className?: string; iconSize?: string }> = ({
  theme = 'dark',
  className = 'w-10 h-10',
  iconSize = 'w-5 h-5'
}) => (
  <Link to="/" className="flex items-center space-x-3 cursor-pointer group">
    <div className={`${className} ${theme === 'dark' ? 'bg-black text-white' : 'bg-white text-black border border-gray-100'} rounded-2xl flex items-center justify-center transition-all group-hover:bg-[#10a37f] group-hover:text-white shadow-sm`}>
      <ChatGPTLogo className={iconSize} />
    </div>
    <span className="text-sm font-black tracking-[0.3em] uppercase">keep4oforever</span>
  </Link>
);

/**
 * Main LandingPage component (Gemini visual + Router/auth preserved)
 */
const LandingPage: React.FC = () => {
  const [lang, setLang] = useState<SupportedLanguage>(detectBrowserLanguage);
  const t = translations[lang] || translations['en'];
  const [scrolled, setScrolled] = useState<boolean>(false);
  const [activeNav, setActiveNav] = useState<string>('home');
  const [showCookies, setShowCookies] = useState<boolean>(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    setActiveNav('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#fcfcf9] text-[#111827] font-sans selection:bg-[#10a37f]/10 antialiased overflow-x-hidden flex flex-col">
      <CookieSettingsModal isOpen={showCookies} onClose={() => setShowCookies(false)} t={t} />

      <div className="fixed top-[-10%] left-[-5%] w-[50%] aspect-square bg-[#10a37f]/5 rounded-full blur-[140px] -z-10" aria-hidden />
      <div className="fixed bottom-[-5%] right-[-5%] w-[40%] aspect-square bg-gray-200/40 rounded-full blur-[140px] -z-10" aria-hidden />

      {/* Nav - Gemini style: py-4 when scrolled, py-8 transparent */}
      <nav className={`fixed top-0 w-full z-[100] transition-all duration-500 ${scrolled ? 'py-4 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm' : 'py-8 bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-6 md:px-10 flex justify-between items-center text-left">
          <BrandLogo />
          <div className="hidden md:flex items-center space-x-8 md:space-x-10">
            <button type="button" onClick={scrollToTop} className={`text-[10px] uppercase tracking-[0.2em] font-bold ${activeNav === 'home' ? 'text-black underline underline-offset-4' : 'text-gray-400'} hover:text-black`}>
              {t.nav.home}
            </button>
            <a href="#pricing" onClick={() => setActiveNav('pricing')} className={`text-[10px] uppercase tracking-[0.2em] font-bold ${activeNav === 'pricing' ? 'text-black underline underline-offset-4' : 'text-gray-400'} hover:text-black`}>
              {t.nav.pricing}
            </a>
            <Link to="/mission" onClick={() => setActiveNav('mission')} className={`text-[10px] uppercase tracking-[0.2em] font-bold ${activeNav === 'mission' ? 'text-black underline underline-offset-4' : 'text-gray-400'} hover:text-black`}>
              {t.nav.mission}
            </Link>
            <LanguageSwitcher currentLang={lang} onLangChange={setLang} />
            <button type="button" onClick={() => navigate('/login')} className="px-6 md:px-8 py-3 bg-black text-white text-[10px] font-bold uppercase tracking-[0.2em] rounded-full hover:bg-[#10a37f] transition-all shadow-xl">
              {t.nav.login}
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-grow text-left">
        {/* Hero - Gemini layout + id for E2E */}
        <section className="relative pt-40 md:pt-48 pb-20 px-6 md:px-10 text-center">
          <div className="max-w-5xl mx-auto relative text-center">
            <div className="inline-block mb-8">
              <span className="px-5 py-2 rounded-full bg-white border border-gray-100 text-[10px] font-black uppercase tracking-[0.3em] text-[#10a37f] shadow-sm">{t.hero.tag}</span>
            </div>
            <h1 id="landing-title" className="text-5xl md:text-7xl lg:text-[88px] font-black tracking-tight mb-8 leading-[1.0] text-gray-900" style={{ letterSpacing: '-0.04em' }}>
              {t.hero.title}
            </h1>
            <p className="text-gray-500 text-lg md:text-xl max-w-xl mx-auto mb-16 font-medium leading-relaxed tracking-tight italic text-center">
              {t.hero.subtitle}
            </p>

            <ChatPreview userPrompt={t.hero.userPrompt} message={t.hero.aiMessage} lang={lang} protectedLabel={t.hero.protected} />

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8 pb-24 md:pb-32">
              <button type="button" onClick={() => navigate('/login')} className="w-full sm:w-auto px-8 md:px-10 py-4 md:py-5 bg-[#10a37f] text-white rounded-2xl font-bold text-base md:text-lg hover:shadow-2xl active:scale-95 transition-all">
                {t.hero.chatBtn}
              </button>
              <button type="button" onClick={() => navigate('/register')} className="w-full sm:w-auto px-8 md:px-10 py-4 md:py-5 bg-white text-gray-800 border-2 border-gray-100 rounded-2xl font-bold text-base md:text-lg hover:border-black transition-all flex items-center justify-center space-x-3 text-left">
                <ArrowRightLeft size={18} className="text-[#10a37f]" />
                <span>{t.hero.migrateBtn}</span>
              </button>
            </div>
          </div>
        </section>

        {/* Migration - Gemini style with gradient card */}
        <section className="py-24 md:py-32 px-6 md:px-10 bg-white border-y border-gray-50 overflow-hidden text-left">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-16 md:gap-24 text-left">
            <div className="flex-1 text-left relative">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#10a37f] mb-6 block font-bold text-left">{t.migration.label}</span>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-black mb-8 leading-[1.1] text-left text-gray-900" style={{ letterSpacing: '-0.04em' }}>{t.migration.title}</h2>
              <p className="text-gray-500 text-lg md:text-xl font-medium leading-relaxed mb-10 text-left">{t.migration.subtitle}</p>
              <div className="space-y-6">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-[#10a37f]"><History size={20} /></div>
                  <p className="text-sm font-bold text-gray-700 text-left">{t.migration.feat1}</p>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-[#10a37f]"><Download size={20} /></div>
                  <p className="text-sm font-bold text-gray-700 text-left">{t.migration.feat2}</p>
                </div>
              </div>
            </div>
            <div className="flex-1 w-full max-w-lg">
              <div className="p-8 md:p-12 rounded-[3rem] border border-gray-100 shadow-2xl relative" style={{ background: 'linear-gradient(135deg, #fcfcf9 0%, #f3f4f6 100%)' }}>
                <div className="space-y-8 text-left">
                  <div className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-gray-50 text-left">
                    <div className="flex items-center space-x-3 text-left">
                      <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white"><Database size={16} /></div>
                      <span className="text-xs font-bold font-mono text-left">Archive.json</span>
                    </div>
                    <CheckCircle2 size={20} className="text-[#10a37f]" />
                  </div>
                  <div className="relative py-4 flex flex-col items-center">
                    <div className="h-20 w-px bg-gradient-to-b from-gray-200 via-[#10a37f] to-gray-200 animate-pulse" />
                    <div className="w-12 h-12 bg-white border border-gray-100 rounded-full flex items-center justify-center shadow-xl -mt-10 mb-4 z-10 text-[#10a37f] rotate-90"><ArrowRightLeft size={18} /></div>
                  </div>
                  <div className="bg-white p-6 rounded-3xl shadow-lg border border-[#10a37f]/10 text-left">
                    <div className="flex items-center justify-between mb-4 text-left">
                      <span className="text-[10px] font-black uppercase text-gray-400">{t.migration.status}</span>
                      <span className="text-[10px] font-black text-[#10a37f]">98.2%</span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden text-left">
                      <div className="h-full w-[98%] bg-[#10a37f] rounded-full transition-all duration-1000" />
                    </div>
                    <div className="mt-4 flex items-center space-x-2 text-left">
                      <div className="w-2 h-2 bg-[#10a37f] rounded-full animate-ping" />
                      <p className="text-[11px] font-medium text-gray-400 text-left">{t.migration.restoring}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing - Gemini 3-col, center black scale-105, CTA -> register */}
        <section id="pricing" className="py-24 md:py-32 px-6 md:px-10 bg-[#fcfcf9]">
          <div className="max-w-7xl mx-auto text-center">
            <div className="mb-16 md:mb-24 text-center">
              <h2 className="text-4xl md:text-6xl font-black mb-6 text-gray-900" style={{ letterSpacing: '-0.04em' }}>{t.pricing.title}</h2>
              <p className="text-gray-500 text-lg font-medium">{t.pricing.subtitle}</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left max-w-6xl mx-auto items-stretch">
              {([
                { tier: t.pricing.explorer, recommended: false },
                { tier: t.pricing.artisan, recommended: true },
                { tier: t.pricing.elite, recommended: false }
              ] as const).map((plan, idx) => (
                <div key={idx} className={`p-8 md:p-10 rounded-[3rem] border transition-all duration-500 flex flex-col shadow-sm ${plan.recommended ? 'bg-black text-white border-black shadow-2xl scale-105 z-10' : 'bg-white border-gray-100 text-gray-900'}`}>
                  <div className="mb-8 md:mb-10 text-left">
                    <div className="flex items-center space-x-2 mb-4">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${plan.recommended ? 'bg-[#10a37f] text-white' : 'bg-gray-100 text-gray-500'}`}>{plan.tier.name}</span>
                      {plan.recommended && <span className="text-[9px] font-black uppercase tracking-widest text-[#10a37f]">{t.pricing.recommended}</span>}
                    </div>
                    <div className="mt-6 flex items-baseline"><span className="text-5xl font-black tracking-tight">{plan.tier.price}</span><span className="text-sm ml-2 font-medium opacity-50">one-time</span></div>
                    <p className="text-xs mt-4 font-bold text-gray-400">{plan.tier.sub}</p>
                  </div>
                  <button type="button" onClick={() => navigate('/register')} className={`w-full py-4 mb-8 md:mb-10 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all active:scale-95 ${plan.recommended ? 'bg-[#10a37f] text-white hover:bg-[#0d8a6a]' : 'bg-black text-white hover:bg-gray-800'}`}>
                    {plan.tier.cta}
                  </button>
                  <ul className="space-y-5 flex-grow text-left">
                    {plan.tier.features.map((f, i) => (
                      <li key={i} className="flex items-start space-x-3 text-sm font-medium">
                        <CheckCircle2 size={18} className="text-[#10a37f] flex-shrink-0" />
                        <span className={plan.recommended ? 'text-gray-300' : 'text-gray-700'}>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact - Gemini-style form (UI only, preventDefault) */}
        <section id="contact" className="pt-24 pb-32 px-6 md:px-10">
          <div className="max-w-2xl mx-auto text-center md:text-left">
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4 text-gray-900">{t.contact.title}</h2>
            <p className="text-gray-400 font-medium tracking-tight italic mb-16 text-center md:text-left">{t.contact.desc}</p>
            <div className="bg-white rounded-[2.5rem] border border-gray-100 p-8 md:p-10 shadow-sm text-left">
              <form className="space-y-6 text-left" onSubmit={(e) => e.preventDefault()}>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="text-left">
                    <label htmlFor="contact-name" className="text-[10px] font-black uppercase text-gray-400 mb-2 block text-left">{t.contact.name}</label>
                    <input id="contact-name" type="text" className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 focus:outline-none focus:border-[#10a37f] text-left" placeholder="Alex Chen" />
                  </div>
                  <div className="text-left">
                    <label htmlFor="contact-email" className="text-[10px] font-black uppercase text-gray-400 mb-2 block text-left">{t.contact.email}</label>
                    <input id="contact-email" type="email" className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 focus:outline-none focus:border-[#10a37f] text-left" placeholder="alex@example.com" />
                  </div>
                </div>
                <div className="text-left">
                  <label htmlFor="contact-message" className="text-[10px] font-black uppercase text-gray-400 mb-2 block text-left">{t.contact.message}</label>
                  <textarea id="contact-message" className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 focus:outline-none focus:border-[#10a37f] min-h-[150px] text-left" placeholder="How can we assist you?" />
                </div>
                <button type="submit" className="w-full py-4 bg-black text-white rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-[#10a37f] transition-all flex items-center justify-center space-x-2 shadow-lg">
                  <span>{t.contact.send}</span>
                  <Send size={14} />
                </button>
              </form>
            </div>
            <p className="mt-12 text-center md:text-left text-gray-400 text-sm font-medium">
              {t.contact.official}: <a href="mailto:support@librechat.ai" className="text-[#10a37f] hover:underline font-bold">support@librechat.ai</a>
            </p>
          </div>
        </section>
      </main>

      {/* Footer - Gemini structure with Router links + Cookie modal */}
      <footer className="py-16 md:py-20 px-6 md:px-10 bg-[#fcfcf9] border-t border-gray-100 mt-12 md:mt-20 text-left">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center mb-12 md:mb-20 gap-8 text-center md:text-left">
            <BrandLogo theme="light" />
            <div className="flex items-center space-x-4 md:space-x-6">
              <a href="https://discord.gg/librechat" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-black hover:text-white transition-all" aria-label="Discord">
                <DiscordIcon className="w-5 h-5" />
              </a>
              <a href="#contact" className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-black hover:text-white transition-all" aria-label="Contact">
                <Mail size={18} />
              </a>
            </div>
            <button type="button" onClick={() => navigate('/login')} className="px-6 md:px-8 py-3 bg-white border border-gray-200 text-gray-900 text-sm font-bold rounded-full shadow-sm hover:border-black transition-all">
              {t.nav.login}
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8 md:gap-12 text-[13px] font-semibold text-left">
            <div className="flex flex-col space-y-4">
              <Link to="/" className="text-gray-400 hover:text-black transition-colors text-left w-fit font-bold">{t.footer.links.home}</Link>
              <a href="#pricing" className="text-gray-400 hover:text-black transition-colors text-left w-fit font-bold">{t.footer.links.pricing}</a>
              <a href="#pricing" className="text-gray-400 hover:text-black transition-colors text-left w-fit font-bold border-b border-black/10">FAQ</a>
            </div>
            <div className="flex flex-col space-y-4 text-left">
              <Link to="/mission" className="text-gray-400 hover:text-black transition-colors text-left w-fit font-bold">{t.footer.links.mission}</Link>
              <a href="#contact" className="text-gray-400 hover:text-black transition-colors text-left w-fit font-bold">{t.footer.links.contact}</a>
              <button type="button" onClick={() => setShowCookies(true)} className="text-gray-400 hover:text-black transition-colors text-left w-fit font-bold">{t.footer.links.cookieSettings}</button>
            </div>
            <div className="flex flex-col space-y-4 text-left col-span-2 md:col-span-1">
              <a href="#" className="text-gray-400 hover:text-black transition-colors text-left w-fit font-bold underline underline-offset-4">Privacy Policy</a>
              <a href="#" className="text-gray-400 hover:text-black transition-colors text-left w-fit font-bold">Terms of Service</a>
              <button type="button" onClick={() => navigate('/login')} className="text-gray-400 hover:text-black transition-colors text-left w-fit font-bold">{t.footer.links.accountPortal}</button>
            </div>
          </div>
          <div className="mt-16 md:mt-20 pt-8 md:pt-10 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] font-black uppercase tracking-[0.3em] md:tracking-[0.5em] text-gray-300">
            <div>{t.footer.copyright}</div>
            <div className="flex items-center space-x-3 opacity-50">
              <div className="w-1.5 h-1.5 rounded-full bg-[#10a37f]" />
              <span>{t.footer.dataGuarantee}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

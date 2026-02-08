import { Constants, EModelEndpoint } from 'librechat-data-provider';
import type {
  TStartupConfig,
  TEndpointsConfig,
  TConversation,
  TMessage,
  TFile,
} from 'librechat-data-provider';

const demoTimestamp = new Date(0).toISOString();

export const demoStartupConfig: TStartupConfig = {
  appTitle: 'keep4oforever Demo',
  socialLogins: [],
  discordLoginEnabled: false,
  facebookLoginEnabled: false,
  githubLoginEnabled: false,
  googleLoginEnabled: false,
  openidLoginEnabled: false,
  appleLoginEnabled: false,
  samlLoginEnabled: false,
  openidLabel: 'OpenID',
  openidImageUrl: '',
  openidAutoRedirect: false,
  samlLabel: 'SAML',
  samlImageUrl: '',
  serverDomain: '',
  emailLoginEnabled: true,
  registrationEnabled: false,
  socialLoginEnabled: false,
  passwordResetEnabled: true,
  emailEnabled: false,
  showBirthdayIcon: false,
  helpAndFaqURL: '',
  sharedLinksEnabled: false,
  publicSharedLinksEnabled: false,
  instanceProjectId: 'demo',
};

export const demoEndpointsConfig: TEndpointsConfig = {
  [EModelEndpoint.openAI]: { order: 1, type: EModelEndpoint.openAI },
  [EModelEndpoint.anthropic]: { order: 2, type: EModelEndpoint.anthropic },
  [EModelEndpoint.google]: { order: 3, type: EModelEndpoint.google },
};

export const getDemoConversation = (
  conversationId: string = Constants.NEW_CONVO,
): TConversation => ({
  conversationId,
  title: 'Demo Chat',
  endpoint: EModelEndpoint.openAI,
  model: 'gpt-4o',
  createdAt: demoTimestamp,
  updatedAt: demoTimestamp,
});

export const getDemoMessages = (conversationId: string = Constants.NEW_CONVO): TMessage[] => [
  {
    messageId: 'demo-user-1',
    conversationId,
    parentMessageId: null,
    text: 'Show me how keep4oforever looks in demo mode.',
    isCreatedByUser: true,
    sender: 'user',
    createdAt: demoTimestamp,
    updatedAt: demoTimestamp,
  },
  {
    messageId: 'demo-assistant-1',
    conversationId,
    parentMessageId: 'demo-user-1',
    text: 'This is a read-only demo. Sign in to start chatting.',
    isCreatedByUser: false,
    sender: 'assistant',
    createdAt: demoTimestamp,
    updatedAt: demoTimestamp,
  },
];

export const demoFileMap = {} as Record<string, TFile>;

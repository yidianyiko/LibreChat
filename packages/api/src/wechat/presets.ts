import {
  DEFAULT_PRESET_ID,
  buildDefaultPresetConfig,
  replaceSpecialVars,
} from 'librechat-data-provider';
import type { ResolveWeChatPresetParams, WeChatFallbackPreset, WeChatPreset } from './types';
import { isSupportedWeChatModel } from './modelSupport';

type WeChatRuntimePromptFields = Pick<WeChatPreset, 'promptPrefix' | 'system'>;
type WeChatPresetWithRuntimePrompt<TPreset extends WeChatPreset> = Omit<
  TPreset,
  keyof WeChatRuntimePromptFields
> &
  Required<WeChatRuntimePromptFields>;

function getPromptText(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function buildCanonicalWeChatFallbackPreset<TFallbackPreset extends WeChatFallbackPreset>(
  fallbackPreset: Partial<TFallbackPreset> = {},
): WeChatPresetWithRuntimePrompt<TFallbackPreset> {
  const canonicalPreset = buildDefaultPresetConfig();
  const promptPrefix = getPromptText(fallbackPreset.promptPrefix);
  const system = getPromptText(fallbackPreset.system);

  return {
    ...canonicalPreset,
    endpoint: 'openAI',
    model: 'gpt-4o',
    ...fallbackPreset,
    promptPrefix: promptPrefix ?? system ?? canonicalPreset.promptPrefix,
    system: system ?? promptPrefix ?? canonicalPreset.system,
  } as WeChatPresetWithRuntimePrompt<TFallbackPreset>;
}

export function buildWeChatFallbackPreset<
  TFallbackPreset extends WeChatFallbackPreset = WeChatFallbackPreset,
>(fallbackPreset: Partial<TFallbackPreset> = {}): WeChatPresetWithRuntimePrompt<TFallbackPreset> {
  return buildCanonicalWeChatFallbackPreset(fallbackPreset);
}

function isBuiltInDefaultPreset(preset: WeChatPreset | null | undefined): boolean {
  return typeof preset?.presetId === 'string' && preset.presetId.startsWith(DEFAULT_PRESET_ID);
}

function normalizeBuiltInDefaultPreset<TPreset extends WeChatPreset>(
  preset: TPreset,
): WeChatPresetWithRuntimePrompt<TPreset> {
  const canonicalPreset = buildDefaultPresetConfig();

  return {
    ...canonicalPreset,
    ...preset,
    promptPrefix: canonicalPreset.promptPrefix,
    system: canonicalPreset.system,
  } as WeChatPresetWithRuntimePrompt<TPreset>;
}

export function resolveWeChatRuntimePromptPrefix(
  preset: WeChatRuntimePromptFields | null | undefined,
): string {
  const canonicalPreset = buildDefaultPresetConfig();
  const promptPrefix = getPromptText(preset?.promptPrefix);
  const system = getPromptText(preset?.system);
  const promptText = promptPrefix ?? system ?? canonicalPreset.promptPrefix;

  return replaceSpecialVars({ text: promptText }) ?? canonicalPreset.promptPrefix;
}

export async function resolveWeChatPreset<
  TPreset extends WeChatPreset,
  TFallbackPreset extends WeChatFallbackPreset,
>(
  params: ResolveWeChatPresetParams<TPreset, TFallbackPreset>,
): Promise<TPreset | TFallbackPreset> {
  const userPreset = await params.getUserDefaultPreset();
  const provider = userPreset?.endpointType ?? userPreset?.endpoint;

  if (userPreset != null && provider === 'openAI' && isSupportedWeChatModel(userPreset.model)) {
    return isBuiltInDefaultPreset(userPreset)
      ? (normalizeBuiltInDefaultPreset(userPreset) as TPreset)
      : userPreset;
  }

  return buildWeChatFallbackPreset(params.fallbackPreset) as TFallbackPreset;
}

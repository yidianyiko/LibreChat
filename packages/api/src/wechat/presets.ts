import { replaceSpecialVars } from 'librechat-data-provider';
import { DEFAULT_PRESET_ID, buildDefaultPresetConfig } from '../../../../config/default-preset';
import { isSupportedWeChatModel } from './modelSupport';
import type { ResolveWeChatPresetParams, WeChatFallbackPreset, WeChatPreset } from './types';

type WeChatRuntimePromptFields = Pick<WeChatPreset, 'promptPrefix' | 'system'>;

function getPromptText(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function buildCanonicalWeChatFallbackPreset<TFallbackPreset extends WeChatFallbackPreset>(
  fallbackPreset: Partial<TFallbackPreset> = {},
): TFallbackPreset & Required<WeChatRuntimePromptFields> {
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
  } as TFallbackPreset & Required<WeChatRuntimePromptFields>;
}

function isBuiltInDefaultPreset(preset: WeChatPreset | null | undefined): boolean {
  return typeof preset?.presetId === 'string' && preset.presetId.startsWith(DEFAULT_PRESET_ID);
}

function normalizeBuiltInDefaultPreset<TPreset extends WeChatPreset>(
  preset: TPreset,
): TPreset & Required<WeChatRuntimePromptFields> {
  const canonicalPreset = buildDefaultPresetConfig();

  return {
    ...canonicalPreset,
    ...preset,
    promptPrefix: canonicalPreset.promptPrefix,
    system: canonicalPreset.system,
  } as TPreset & Required<WeChatRuntimePromptFields>;
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
>(params: ResolveWeChatPresetParams<TPreset, TFallbackPreset>): Promise<TPreset | TFallbackPreset> {
  const userPreset = await params.getUserDefaultPreset();
  const provider = userPreset?.endpointType ?? userPreset?.endpoint;

  if (userPreset != null && provider === 'openAI' && isSupportedWeChatModel(userPreset.model)) {
    return isBuiltInDefaultPreset(userPreset)
      ? normalizeBuiltInDefaultPreset(userPreset)
      : userPreset;
  }

  return buildCanonicalWeChatFallbackPreset(params.fallbackPreset);
}

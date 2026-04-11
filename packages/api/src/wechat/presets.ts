import type { ResolveWeChatPresetParams, WeChatFallbackPreset, WeChatPreset } from './types';

export async function resolveWeChatPreset<
  TPreset extends WeChatPreset,
  TFallbackPreset extends WeChatFallbackPreset,
>(params: ResolveWeChatPresetParams<TPreset, TFallbackPreset>): Promise<TPreset | TFallbackPreset> {
  const userPreset = await params.getUserDefaultPreset();
  const provider = userPreset?.endpointType ?? userPreset?.endpoint;

  if (provider === 'openAI' && userPreset?.model === 'gpt-4o') {
    return userPreset;
  }

  return params.fallbackPreset;
}

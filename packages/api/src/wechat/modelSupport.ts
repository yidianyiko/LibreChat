const GPT_4O_MODEL_PATTERN = /^gpt-4o(?:-|$)/;

export function isSupportedWeChatModel(model: string | null | undefined): boolean {
  return typeof model === 'string' && GPT_4O_MODEL_PATTERN.test(model);
}

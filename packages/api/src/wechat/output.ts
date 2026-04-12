export function flattenWeChatText(parts: Array<Record<string, unknown>>): string {
  const textParts = parts
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => String(part.text).trim())
    .filter(Boolean);

  if (textParts.length === 0) {
    return '本次回复包含暂不支持的内容类型，请到网页端查看';
  }

  return textParts.join('\n\n');
}


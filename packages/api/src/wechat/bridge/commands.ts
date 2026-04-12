export type ParsedWeChatCommand =
  | { name: 'new' }
  | { name: 'list' }
  | { name: 'switch'; index: number }
  | { name: 'now' };

export interface WeChatConversationSummary {
  conversationId: string;
  title?: string | null;
  updatedAt?: Date | string | null;
}

const NO_CURRENT_CONVERSATION_MESSAGE =
  '当前还没有选中的对话，请先使用 /new 创建新对话，或使用 /list 查看最近对话后再 /switch <序号>';
const MAX_REPLY_CHARS = 1200;

function formatTimestamp(value?: Date | string | null): string {
  if (value == null) {
    return '未知时间';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '未知时间';
  }

  return date.toISOString().replace('T', ' ').slice(0, 16);
}

export function parseWeChatCommand(text: string): ParsedWeChatCommand | null {
  const trimmed = text.trim();
  if (trimmed === '/new') {
    return { name: 'new' };
  }

  if (trimmed === '/list') {
    return { name: 'list' };
  }

  if (trimmed === '/now') {
    return { name: 'now' };
  }

  const switchMatch = trimmed.match(/^\/switch\s+(\d+)$/);
  if (switchMatch == null) {
    return null;
  }

  return {
    name: 'switch',
    index: Number(switchMatch[1]),
  };
}

export function formatWeChatConversationList(conversations: WeChatConversationSummary[]): string {
  if (conversations.length === 0) {
    return '暂无可继续的对话。';
  }

  const items = conversations.map((conversation, index) => {
    const title = conversation.title?.trim() || '未命名对话';
    return `${index + 1}. ${title} | ${formatTimestamp(conversation.updatedAt)}`;
  });

  return [...items, '', '使用 /switch <序号> 切换到对应对话。'].join('\n');
}

export function formatWeChatCurrentConversation(params: {
  conversationId: string;
  title?: string | null;
  updatedAt?: Date | string | null;
}): string {
  const title = params.title?.trim() || '未命名对话';
  return [
    `当前对话：${title}`,
    `更新时间：${formatTimestamp(params.updatedAt)}`,
    `会话 ID：${params.conversationId.slice(-8)}`,
  ].join('\n');
}

export function getNoCurrentConversationMessage(): string {
  return NO_CURRENT_CONVERSATION_MESSAGE;
}

export function splitWeChatReply(text: string): string[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return [''];
  }

  if (trimmed.length <= MAX_REPLY_CHARS) {
    return [trimmed];
  }

  const chunks: string[] = [];
  let remaining = trimmed;

  while (remaining.length > MAX_REPLY_CHARS) {
    let end = remaining.lastIndexOf('\n', MAX_REPLY_CHARS);
    if (end < MAX_REPLY_CHARS / 2) {
      end = MAX_REPLY_CHARS;
    }

    chunks.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trimStart();
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}

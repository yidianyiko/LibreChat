// client/src/utils/conversationParser.ts
export type ImportFormat = 'librechat' | 'chatgpt' | 'claude';

export interface ConversationPreview {
  /** Unique ID for this preview item (array index) */
  id: string;
  /** Original conversation ID from source */
  conversationId: string;
  /** Conversation title */
  title: string;
  /** Creation timestamp */
  createdAt: Date;
  /** AI model used */
  model: string;
  /** Number of messages */
  messageCount: number;
  /** Preview of first user message */
  firstMessagePreview: string;
  /** Whether this conversation already exists in the user's account */
  isDuplicate: boolean;
  /** Original raw data (for upload) */
  rawData: unknown;
}

export interface ParseResult {
  format: ImportFormat;
  conversations: ConversationPreview[];
  totalCount: number;
}

/**
 * Detects the format of imported conversation data
 */
export function detectImportFormat(data: unknown): ImportFormat {
  // LibreChat single conversation
  if (
    typeof data === 'object' &&
    data !== null &&
    'conversationId' in data &&
    ('messages' in data || 'messagesTree' in data)
  ) {
    return 'librechat';
  }

  // Array-based formats (ChatGPT or Claude)
  if (Array.isArray(data) && data.length > 0) {
    // Claude format has chat_messages
    if ('chat_messages' in data[0]) {
      return 'claude';
    }
    // ChatGPT format has mapping
    if ('mapping' in data[0]) {
      return 'chatgpt';
    }
  }

  throw new Error('Unsupported import format');
}

/**
 * Extracts first user message from ChatGPT mapping
 */
function extractFirstUserMessage(mapping: Record<string, any>): string {
  for (const item of Object.values(mapping)) {
    if (item?.message?.author?.role === 'user') {
      const parts = item.message?.content?.parts;
      if (Array.isArray(parts) && parts.length > 0) {
        const text = typeof parts[0] === 'string' ? parts[0] : JSON.stringify(parts[0]);
        return text.slice(0, 100);
      }
    }
  }
  return '';
}

/**
 * Counts non-system messages in ChatGPT mapping
 */
function countChatGPTMessages(mapping: Record<string, any>): number {
  let count = 0;
  for (const item of Object.values(mapping)) {
    if (item?.message && item.message.author?.role !== 'system') {
      count++;
    }
  }
  return count;
}

/**
 * Parses ChatGPT conversation array into previews
 */
function parseChatGPTConversations(data: any[]): ConversationPreview[] {
  return data.map((conv, index) => ({
    id: `chatgpt-${index}`,
    conversationId: conv.id || `unknown-${index}`,
    title: conv.title || 'Untitled Conversation',
    createdAt: conv.create_time ? new Date(conv.create_time * 1000) : new Date(),
    model: extractModelFromMapping(conv.mapping),
    messageCount: countChatGPTMessages(conv.mapping || {}),
    firstMessagePreview: extractFirstUserMessage(conv.mapping || {}),
    isDuplicate: false, // Will be set later
    rawData: conv,
  }));
}

/**
 * Extracts model name from ChatGPT mapping
 */
function extractModelFromMapping(mapping: Record<string, any>): string {
  for (const item of Object.values(mapping)) {
    const model = item?.message?.metadata?.model_slug;
    if (model) {
      return model;
    }
  }
  return 'gpt-3.5-turbo';
}

/**
 * Parses LibreChat single conversation into preview
 */
function parseLibreChatConversation(data: any): ConversationPreview[] {
  const messages = data.messagesTree || data.messages || [];
  const firstUserMsg = messages.find((m: any) => m.isCreatedByUser);

  return [
    {
      id: 'librechat-0',
      conversationId: data.conversationId,
      title: data.title || 'Untitled Conversation',
      createdAt: firstUserMsg?.createdAt ? new Date(firstUserMsg.createdAt) : new Date(),
      model: data.endpoint || data.model || 'unknown',
      messageCount: messages.length,
      firstMessagePreview: (firstUserMsg?.text || '').slice(0, 100),
      isDuplicate: false,
      rawData: data,
    },
  ];
}

/**
 * Parses Claude conversation array into previews
 */
function parseClaudeConversations(data: any[]): ConversationPreview[] {
  return data.map((conv, index) => {
    const firstMsg = conv.chat_messages?.find((m: any) => m.sender === 'human');
    const textContent =
      firstMsg?.content?.find((c: any) => c.type === 'text')?.text || firstMsg?.text || '';

    return {
      id: `claude-${index}`,
      conversationId: conv.uuid || `unknown-${index}`,
      title: conv.name || 'Untitled Conversation',
      createdAt: conv.created_at ? new Date(conv.created_at) : new Date(),
      model: 'claude',
      messageCount: conv.chat_messages?.length || 0,
      firstMessagePreview: textContent.slice(0, 100),
      isDuplicate: false,
      rawData: conv,
    };
  });
}

/**
 * Main parser function - converts JSON string to conversation previews
 */
export async function parseImportFile(jsonString: string): Promise<ParseResult> {
  let data: unknown;
  try {
    data = JSON.parse(jsonString);
  } catch (error) {
    throw new Error('Invalid JSON file');
  }

  const format = detectImportFormat(data);
  let conversations: ConversationPreview[] = [];

  switch (format) {
    case 'chatgpt':
      conversations = parseChatGPTConversations(data as any[]);
      break;
    case 'librechat':
      conversations = parseLibreChatConversation(data);
      break;
    case 'claude':
      conversations = parseClaudeConversations(data as any[]);
      break;
  }

  return {
    format,
    conversations,
    totalCount: conversations.length,
  };
}

/**
 * Marks duplicate conversations based on existing conversation IDs
 */
export function markDuplicates(
  previews: ConversationPreview[],
  existingConversationIds: Set<string>,
): ConversationPreview[] {
  return previews.map((preview) => ({
    ...preview,
    isDuplicate: existingConversationIds.has(preview.conversationId),
  }));
}

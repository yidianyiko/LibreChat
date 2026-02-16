// client/src/utils/__tests__/conversationParser.test.ts
import { parseImportFile, detectImportFormat, ConversationPreview } from '../conversationParser';

describe('conversationParser', () => {
  describe('detectImportFormat', () => {
    it('should detect LibreChat format', () => {
      const data = { conversationId: 'abc', messages: [] };
      expect(detectImportFormat(data)).toBe('librechat');
    });

    it('should detect ChatGPT format', () => {
      const data = [{ id: 'abc', mapping: {}, title: 'Test' }];
      expect(detectImportFormat(data)).toBe('chatgpt');
    });

    it('should detect Claude format', () => {
      const data = [{ uuid: 'abc', chat_messages: [] }];
      expect(detectImportFormat(data)).toBe('claude');
    });

    it('should throw error for unsupported format', () => {
      const data = { random: 'data' };
      expect(() => detectImportFormat(data)).toThrow('Unsupported import format');
    });
  });

  describe('parseImportFile', () => {
    it('should parse ChatGPT export with metadata', async () => {
      const chatgptData = [
        {
          id: 'conv-1',
          title: 'Test Conversation',
          create_time: 1705276800,
          mapping: {
            msg1: {
              message: {
                author: { role: 'user' },
                content: { parts: ['Hello'], content_type: 'text' },
                create_time: 1705276800,
              },
            },
          },
        },
      ];

      const result = await parseImportFile(JSON.stringify(chatgptData));

      expect(result.format).toBe('chatgpt');
      expect(result.conversations).toHaveLength(1);
      expect(result.conversations[0].title).toBe('Test Conversation');
      expect(result.conversations[0].conversationId).toBe('conv-1');
      expect(result.conversations[0].messageCount).toBeGreaterThan(0);
    });

    it('should parse LibreChat export', async () => {
      const librechatData = {
        conversationId: 'lc-123',
        title: 'LibreChat Conv',
        messages: [
          { messageId: 'm1', text: 'Hello', isCreatedByUser: true },
          { messageId: 'm2', text: 'Hi', isCreatedByUser: false },
        ],
      };

      const result = await parseImportFile(JSON.stringify(librechatData));

      expect(result.format).toBe('librechat');
      expect(result.conversations).toHaveLength(1);
      expect(result.conversations[0].messageCount).toBe(2);
    });

    it('should handle invalid JSON', async () => {
      await expect(parseImportFile('not json')).rejects.toThrow('Invalid JSON');
    });
  });
});

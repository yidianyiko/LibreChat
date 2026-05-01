import { tModelSpecPresetSchema } from '../src/schemas';

describe('tModelSpecPresetSchema', () => {
  it('strips system and database fields from preset', () => {
    const result = tModelSpecPresetSchema.safeParse({
      conversationId: 'conv-123',
      presetId: 'preset-456',
      title: 'My Preset',
      defaultPreset: true,
      order: 3,
      isArchived: true,
      user: 'user-123',
      messages: [{ text: 'hello' }],
      endpoint: 'openAI',
      model: 'gpt-4o',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('conversationId');
      expect(result.data).not.toHaveProperty('presetId');
      expect(result.data).not.toHaveProperty('title');
      expect(result.data).not.toHaveProperty('defaultPreset');
      expect(result.data).not.toHaveProperty('order');
      expect(result.data).not.toHaveProperty('isArchived');
      expect(result.data).not.toHaveProperty('user');
      expect(result.data).not.toHaveProperty('messages');
      expect(result.data).toMatchObject({ endpoint: 'openAI', model: 'gpt-4o' });
    }
  });

  it('preserves admin configurable display fields', () => {
    const result = tModelSpecPresetSchema.safeParse({
      endpoint: 'openAI',
      model: 'gpt-4o',
      greeting: 'Welcome back',
      iconURL: 'https://example.com/icon.png',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.greeting).toBe('Welcome back');
      expect(result.data.iconURL).toBe('https://example.com/icon.png');
    }
  });

  it('strips deprecated and client managed fields', () => {
    const result = tModelSpecPresetSchema.safeParse({
      endpoint: 'openAI',
      model: 'gpt-4o',
      parentMessageId: 'parent-123',
      resendImages: true,
      chatGptLabel: 'legacy',
      presetOverride: { model: 'other-model' },
      spec: 'spec-name',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('parentMessageId');
      expect(result.data).not.toHaveProperty('resendImages');
      expect(result.data).not.toHaveProperty('chatGptLabel');
      expect(result.data).not.toHaveProperty('presetOverride');
      expect(result.data).not.toHaveProperty('spec');
    }
  });
});

import * as conversationHooks from '../index';

describe('Conversations hooks index', () => {
  it('does not export deprecated useImportConversations hook', () => {
    expect(conversationHooks).not.toHaveProperty('useImportConversations');
  });
});

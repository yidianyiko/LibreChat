import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ConversationListItem from '../ConversationListItem';
import type { ConversationPreview } from '~/utils/conversationParser';

jest.mock('@librechat/client', () => ({
  Checkbox: ({ checked, ...props }: { checked: boolean }) => (
    <input type="checkbox" checked={checked} readOnly {...props} />
  ),
}));

describe('ConversationListItem', () => {
  it('should apply themed text color to title', () => {
    const conversation: ConversationPreview = {
      id: 'chatgpt-0',
      conversationId: 'conv-1',
      title: 'Styled Title',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      model: 'gpt-4o',
      messageCount: 3,
      firstMessagePreview: 'preview',
      isDuplicate: false,
      rawData: {},
    };

    render(
      <ConversationListItem conversation={conversation} isSelected={false} onToggle={jest.fn()} />,
    );

    expect(screen.getByText('Styled Title')).toHaveClass('text-text-primary');
  });
});

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import SelectiveImportDialog from '../SelectiveImportDialog';
import type { ConversationPreview } from '~/utils/conversationParser';

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: jest.fn(),
}));

const mockUseVirtualizer = useVirtualizer as jest.Mock;

describe('SelectiveImportDialog', () => {
  const conversations: ConversationPreview[] = [
    {
      id: 'chatgpt-0',
      conversationId: 'conv-1',
      title: 'Test Conversation',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      model: 'gpt-4o',
      messageCount: 10,
      firstMessagePreview: 'hello',
      isDuplicate: false,
      rawData: {},
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render conversation items even when virtualizer items are temporarily empty', () => {
    mockUseVirtualizer.mockReturnValue({
      getTotalSize: () => 0,
      getVirtualItems: () => [],
      measure: jest.fn(),
    });

    render(
      <SelectiveImportDialog
        open={true}
        conversations={conversations}
        onClose={jest.fn()}
        onImport={jest.fn()}
      />,
    );

    expect(screen.getByText('Test Conversation')).toBeInTheDocument();
  });
});

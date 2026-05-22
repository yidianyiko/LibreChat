import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import { NotificationSeverity } from '~/common';
import ImportConversations from '../ImportConversations';
import { useUploadConversationsMutation } from '~/data-provider';

const mockShowToast = jest.fn();

jest.mock('@librechat/client', () => ({
  ...jest.requireActual('@librechat/client'),
  useToastContext: () => ({ showToast: mockShowToast }),
  Spinner: (props: React.HTMLAttributes<HTMLSpanElement>) => <span {...props} />,
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
    <label {...props}>{children}</label>
  ),
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

jest.mock('~/utils/conversationParser', () => ({
  parseImportFile: jest.fn(async () => ({
    conversations: [{ id: 'conversation-1', conversationId: 'source-1', rawData: {} }],
  })),
  markDuplicates: jest.fn((conversations: Array<Record<string, unknown>>) =>
    conversations.map((conversation) => ({ ...conversation, isDuplicate: false })),
  ),
}));

jest.mock('~/data-provider', () => ({
  useUploadConversationsMutation: jest.fn(),
}));

jest.mock('~/data-provider/mutations', () => ({
  useImportSelectiveConversationsMutation: jest.fn(() => ({ mutate: jest.fn() })),
}));

jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQueryClient: jest.fn(),
}));

const mockUseQueryClient = require('@tanstack/react-query').useQueryClient as jest.Mock;

const createImportFile = () => {
  const file = new File(['[]'], 'conversations.json', { type: 'application/json' });
  Object.defineProperty(file, 'text', {
    value: jest.fn().mockResolvedValue('[]'),
  });
  return file;
};

describe('ImportConversations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockUseQueryClient.mockReturnValue({ getQueryData: jest.fn(), invalidateQueries: jest.fn() });

    const mockMutation = useUploadConversationsMutation as jest.Mock;
    mockMutation.mockImplementation((options) => ({
      mutate: () => {
        options?.onSuccess?.(
          { message: 'Import is processing in the background. Please wait and refresh later.' },
          new FormData(),
          undefined,
        );
      },
    }));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows progress modal when file is selected', async () => {
    const { container } = render(<ImportConversations />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createImportFile();

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('下一步'));

    await waitFor(() => {
      expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });
  });

  it('shows a localized processing toast when import continues in the background', async () => {
    const { container } = render(<ImportConversations />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createImportFile();

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('下一步'));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith({
        message: 'com_ui_import_conversation_processing',
        status: NotificationSeverity.INFO,
      });
    });
  });

  it('shows success toast when import completes successfully', async () => {
    const mockMutation = useUploadConversationsMutation as jest.Mock;
    mockMutation.mockImplementation((options) => ({
      mutate: () => {
        options?.onSuccess?.({ message: 'Conversations imported successfully' }, new FormData(), undefined);
      },
    }));

    const { container } = render(<ImportConversations />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createImportFile();

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('下一步'));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith({
        message: 'com_ui_import_conversation_success',
        status: NotificationSeverity.SUCCESS,
      });
    });
  });
});

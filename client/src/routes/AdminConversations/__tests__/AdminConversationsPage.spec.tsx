import type { ReactNode } from 'react';
import { render, screen } from 'test/layout-test-utils';
import { SystemRoles } from 'librechat-data-provider';
import AdminConversationsPage from '../AdminConversationsPage';

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

jest.mock('~/hooks/AuthContext', () => ({
  AuthContextProvider: ({ children }: { children: ReactNode }) => children,
  useAuthContext: jest.fn(),
}));

jest.mock('~/data-provider', () => ({
  useGetAdminConversationDetail: jest.fn(),
  useGetAdminConversationUsers: jest.fn(),
  useGetAdminUserConversations: jest.fn(),
}));

const mockUseAuthContext = jest.requireMock('~/hooks/AuthContext').useAuthContext as jest.Mock;
const mockUseGetAdminConversationUsers = jest.requireMock('~/data-provider')
  .useGetAdminConversationUsers as jest.Mock;
const mockUseGetAdminUserConversations = jest.requireMock('~/data-provider')
  .useGetAdminUserConversations as jest.Mock;
const mockUseGetAdminConversationDetail = jest.requireMock('~/data-provider')
  .useGetAdminConversationDetail as jest.Mock;

describe('AdminConversationsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthContext.mockReturnValue({ user: { role: SystemRoles.ADMIN } });
    mockUseGetAdminConversationUsers.mockReturnValue({
      data: {
        items: [
          {
            anonUserId: 'abcdef123456',
            anchorConversationId: 'convo-1',
            conversationCount: 2,
            latestUpdatedAt: '2026-05-14T00:01:00.000Z',
          },
        ],
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockUseGetAdminUserConversations.mockReturnValue({
      data: {
        items: [
          {
            id: 'mongo-convo-1',
            conversationId: 'convo-1',
            anonUserId: 'abcdef123456',
            title: 'Need help',
            endpoint: 'openAI',
            model: 'gpt-4o',
            createdAt: '2026-05-14T00:00:00.000Z',
            updatedAt: '2026-05-14T00:01:00.000Z',
          },
        ],
        nextCursor: null,
      },
      isLoading: false,
      error: null,
    });
    mockUseGetAdminConversationDetail.mockReturnValue({
      data: {
        id: 'mongo-convo-1',
        conversationId: 'convo-1',
        anonUserId: 'abcdef123456',
        title: 'Need help',
        endpoint: 'openAI',
        model: 'gpt-4o',
        createdAt: '2026-05-14T00:00:00.000Z',
        updatedAt: '2026-05-14T00:01:00.000Z',
        truncated: false,
        messages: [
          {
            id: 'message-1',
            messageId: 'message-1',
            conversationId: 'convo-1',
            anonUserId: 'abcdef123456',
            text: 'Hello from the user',
            isCreatedByUser: true,
            createdAt: '2026-05-14T00:00:30.000Z',
            updatedAt: '2026-05-14T00:00:30.000Z',
          },
        ],
      },
      isLoading: false,
      error: null,
    });
  });

  it('renders access denied for non-admin users', () => {
    mockUseAuthContext.mockReturnValue({ user: { role: SystemRoles.USER } });

    render(<AdminConversationsPage />);

    expect(screen.getByText('com_ui_access_denied')).toBeInTheDocument();
    expect(screen.getByText('com_ui_admin_privilege_required')).toBeInTheDocument();
  });

  it('renders anonymous users, conversations, and selected messages', () => {
    render(<AdminConversationsPage />);

    expect(screen.getByText('com_ui_admin_conversation_review')).toBeInTheDocument();
    expect(screen.getByText('abcdef123456')).toBeInTheDocument();
    expect(screen.getAllByText('Need help')).toHaveLength(2);
    expect(screen.getByText('Hello from the user')).toBeInTheDocument();
    expect(mockUseGetAdminUserConversations).toHaveBeenCalledWith(
      'convo-1',
      expect.objectContaining({ enabled: true }),
    );
    expect(mockUseGetAdminConversationDetail).toHaveBeenCalledWith(
      'convo-1',
      expect.objectContaining({ enabled: true }),
    );
  });

  it('shows the unlock form when the users query is unauthorized', () => {
    mockUseGetAdminConversationUsers.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { response: { status: 401 } },
      refetch: jest.fn(),
    });

    render(<AdminConversationsPage />);

    expect(screen.getByText('com_ui_admin_conversations_unlock_required')).toBeInTheDocument();
    expect(
      screen.getByLabelText('com_ui_admin_conversations_function_password'),
    ).toBeInTheDocument();
  });
});

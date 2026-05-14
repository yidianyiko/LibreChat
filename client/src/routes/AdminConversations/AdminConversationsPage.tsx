import { useEffect, useMemo, useState } from 'react';
import { LockKeyhole, MessageSquareText, MessagesSquare, Users } from 'lucide-react';
import { dataService, SystemRoles } from 'librechat-data-provider';
import type { FormEvent } from 'react';
import type { AdminConvoListItem, AdminMessageItem } from 'librechat-data-provider';

import { useLocalize } from '~/hooks';
import { useAuthContext } from '~/hooks/AuthContext';
import {
  useGetAdminConversationDetail,
  useGetAdminConversationUsers,
  useGetAdminUserConversations,
} from '~/data-provider';

type HttpError = {
  response?: {
    status?: number;
  };
};

const isUnauthorized = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  return (error as HttpError).response?.status === 401;
};

const formatDateTime = (value: string): string =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

const getMessageText = (message: AdminMessageItem): string => {
  if (message.text) {
    return message.text;
  }

  const textPart = message.content?.find((part) => 'text' in part && typeof part.text === 'string');

  if (textPart && 'text' in textPart && typeof textPart.text === 'string') {
    return textPart.text;
  }

  return '';
};

export default function AdminConversationsPage() {
  const localize = useLocalize();
  const { user } = useAuthContext();
  const [selectedUserAnchor, setSelectedUserAnchor] = useState<string | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [unlockError, setUnlockError] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const usersQuery = useGetAdminConversationUsers();
  const userConversationsQuery = useGetAdminUserConversations(selectedUserAnchor, {
    enabled: !!selectedUserAnchor,
  });
  const detailQuery = useGetAdminConversationDetail(selectedConversationId, {
    enabled: !!selectedConversationId,
  });

  const users = usersQuery.data?.items ?? [];
  const conversations = useMemo<AdminConvoListItem[]>(
    () => userConversationsQuery.data?.items ?? [],
    [userConversationsQuery.data?.items],
  );
  const needsUnlock =
    isUnauthorized(usersQuery.error) ||
    isUnauthorized(userConversationsQuery.error) ||
    isUnauthorized(detailQuery.error);

  useEffect(() => {
    if (!selectedUserAnchor && users.length > 0) {
      setSelectedUserAnchor(users[0].anchorConversationId);
    }
  }, [selectedUserAnchor, users]);

  useEffect(() => {
    setSelectedConversationId(conversations[0]?.conversationId ?? null);
  }, [conversations, selectedUserAnchor]);

  const handleUnlock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsUnlocking(true);
    setUnlockError(false);

    try {
      await dataService.unlockAdminConversations(password);
      setPassword('');
      await usersQuery.refetch();
    } catch {
      setUnlockError(true);
    } finally {
      setIsUnlocking(false);
    }
  };

  if (user?.role !== SystemRoles.ADMIN) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary">
            {localize('com_ui_access_denied')}
          </h1>
          <p className="mt-2 text-text-secondary">{localize('com_ui_admin_privilege_required')}</p>
        </div>
      </div>
    );
  }

  if (needsUnlock) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-primary-alt p-6">
        <form
          onSubmit={handleUnlock}
          className="w-full max-w-sm rounded-lg border border-border-light bg-surface-primary p-5 shadow-sm"
        >
          <div className="mb-4 flex items-center gap-2 text-text-primary">
            <LockKeyhole className="h-5 w-5" aria-hidden="true" />
            <h1 className="text-lg font-semibold">
              {localize('com_ui_admin_conversations_unlock_required')}
            </h1>
          </div>
          <label
            htmlFor="admin-conversation-password"
            className="mb-2 block text-sm font-medium text-text-secondary"
          >
            {localize('com_ui_admin_conversations_function_password')}
          </label>
          <input
            id="admin-conversation-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mb-3 w-full rounded-md border border-border-medium bg-surface-secondary px-3 py-2 text-text-primary outline-none focus:border-blue-500"
          />
          {unlockError && (
            <p className="mb-3 text-sm text-red-500">
              {localize('com_ui_admin_conversations_unlock_failed')}
            </p>
          )}
          <button
            type="submit"
            disabled={password.length === 0 || isUnlocking}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {localize(isUnlocking ? 'com_ui_loading' : 'com_ui_unlock')}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-surface-primary-alt text-text-primary">
      <header className="border-b border-border-light px-6 py-4">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <MessagesSquare className="h-6 w-6" aria-hidden="true" />
          {localize('com_ui_admin_conversation_review')}
        </h1>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[280px_360px_minmax(0,1fr)]">
        <section className="min-h-0 border-r border-border-light bg-surface-primary">
          <div className="flex items-center gap-2 border-b border-border-light px-4 py-3 font-semibold">
            <Users className="h-4 w-4" aria-hidden="true" />
            {localize('com_ui_admin_conversations_users')}
          </div>
          <div className="h-full overflow-y-auto p-2">
            {usersQuery.isLoading && (
              <div className="p-3 text-sm">{localize('com_ui_loading')}</div>
            )}
            {users.map((item) => (
              <button
                key={item.anchorConversationId}
                type="button"
                onClick={() => setSelectedUserAnchor(item.anchorConversationId)}
                className={`mb-1 w-full rounded-md px-3 py-2 text-left text-sm hover:bg-surface-active-alt ${
                  selectedUserAnchor === item.anchorConversationId ? 'bg-surface-active-alt' : ''
                }`}
              >
                <div className="font-medium">{item.anonUserId}</div>
                <div className="mt-1 text-xs text-text-secondary">
                  {localize('com_ui_admin_conversations_count', {
                    0: item.conversationCount.toLocaleString(),
                  })}
                </div>
                <div className="mt-1 text-xs text-text-secondary">
                  {formatDateTime(item.latestUpdatedAt)}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="min-h-0 border-r border-border-light bg-surface-primary">
          <div className="flex items-center gap-2 border-b border-border-light px-4 py-3 font-semibold">
            <MessageSquareText className="h-4 w-4" aria-hidden="true" />
            {localize('com_ui_admin_conversations_conversations')}
          </div>
          <div className="h-full overflow-y-auto p-2">
            {userConversationsQuery.isLoading && (
              <div className="p-3 text-sm">{localize('com_ui_loading')}</div>
            )}
            {conversations.map((conversation) => (
              <button
                key={conversation.conversationId}
                type="button"
                onClick={() => setSelectedConversationId(conversation.conversationId)}
                className={`mb-1 w-full rounded-md px-3 py-2 text-left text-sm hover:bg-surface-active-alt ${
                  selectedConversationId === conversation.conversationId
                    ? 'bg-surface-active-alt'
                    : ''
                }`}
              >
                <div className="line-clamp-2 font-medium">{conversation.title}</div>
                <div className="mt-1 truncate text-xs text-text-secondary">
                  {[conversation.endpoint, conversation.model].filter(Boolean).join(' / ')}
                </div>
                <div className="mt-1 text-xs text-text-secondary">
                  {formatDateTime(conversation.updatedAt)}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="min-h-0 bg-surface-primary">
          <div className="border-b border-border-light px-5 py-3">
            <h2 className="font-semibold">
              {detailQuery.data?.title ?? localize('com_ui_admin_conversations_messages')}
            </h2>
            {detailQuery.data?.truncated === true && (
              <p className="mt-1 text-xs text-yellow-600">
                {localize('com_ui_admin_conversations_truncated')}
              </p>
            )}
          </div>
          <div className="h-full overflow-y-auto px-5 py-4">
            {detailQuery.isLoading && <div className="text-sm">{localize('com_ui_loading')}</div>}
            {detailQuery.data?.messages.map((message) => (
              <article key={message.messageId} className="mb-4">
                <div className="mb-1 flex items-center justify-between gap-3 text-xs text-text-secondary">
                  <span>
                    {message.isCreatedByUser
                      ? localize('com_ui_admin_conversations_user_message')
                      : localize('com_ui_admin_conversations_assistant_message')}
                  </span>
                  <span>{formatDateTime(message.createdAt)}</span>
                </div>
                <div className="whitespace-pre-wrap rounded-md border border-border-light bg-surface-secondary px-3 py-2 text-sm leading-6">
                  {getMessageText(message) || localize('com_ui_admin_conversations_empty_message')}
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

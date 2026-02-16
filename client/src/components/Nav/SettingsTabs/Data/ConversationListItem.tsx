// client/src/components/Nav/SettingsTabs/Data/ConversationListItem.tsx
import { memo } from 'react';
import { Checkbox } from '@librechat/client';
import type { ConversationPreview } from '~/utils/conversationParser';

interface ConversationListItemProps {
  conversation: ConversationPreview;
  isSelected: boolean;
  onToggle: (id: string) => void;
  disabled?: boolean;
}

function ConversationListItem({
  conversation,
  isSelected,
  onToggle,
  disabled = false,
}: ConversationListItemProps) {
  const handleClick = () => {
    if (!disabled && !conversation.isDuplicate) {
      onToggle(conversation.id);
    }
  };

  return (
    <div
      className={`flex items-start gap-3 border-b border-border-light p-3 ${
        conversation.isDuplicate
          ? 'cursor-not-allowed bg-surface-secondary opacity-60'
          : 'cursor-pointer hover:bg-surface-hover'
      }`}
      onClick={handleClick}
    >
      <Checkbox
        checked={isSelected}
        disabled={disabled || conversation.isDuplicate}
        onChange={() => onToggle(conversation.id)}
        className="mt-1"
        aria-label={`选择对话: ${conversation.title}`}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="font-medium text-sm truncate text-text-primary">{conversation.title}</div>
          <div className="text-xs text-text-secondary whitespace-nowrap">
            #{conversation.id.split('-')[1]}
          </div>
        </div>

        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-secondary">
          <span>{conversation.createdAt.toLocaleDateString()}</span>
          <span>{conversation.model}</span>
          <span>{conversation.messageCount} 条消息</span>
        </div>

        {conversation.firstMessagePreview && (
          <div className="mt-1 text-xs text-text-secondary line-clamp-2">
            预览: {conversation.firstMessagePreview}
          </div>
        )}

        {conversation.isDuplicate && (
          <div className="mt-1 text-xs text-orange-600 dark:text-orange-400">
            ⚠️ 已存在（重复）
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(ConversationListItem);

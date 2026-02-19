// client/src/components/Nav/SettingsTabs/Data/SelectiveImportDialog.tsx
import { useState, useMemo, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Dialog, DialogContent, DialogHeader, DialogTitle, Input, Button } from '@librechat/client';
import { useLocalize } from '~/hooks';
import type { ConversationPreview } from '~/utils/conversationParser';
import ConversationListItem from './ConversationListItem';

interface SelectiveImportDialogProps {
  open: boolean;
  conversations: ConversationPreview[];
  onClose: () => void;
  onImport: (selectedIds: string[]) => void;
}

export default function SelectiveImportDialog({
  open,
  conversations,
  onClose,
  onImport,
}: SelectiveImportDialogProps) {
  const localize = useLocalize();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | '7days' | '30days'>('all');

  const parentRef = useRef<HTMLDivElement>(null);

  // Filter conversations
  const filteredConversations = useMemo(() => {
    let filtered = conversations;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (conv) =>
          conv.title.toLowerCase().includes(query) ||
          conv.firstMessagePreview.toLowerCase().includes(query),
      );
    }

    // Date filter
    if (dateFilter !== 'all') {
      const cutoffDate = new Date();
      if (dateFilter === '7days') {
        cutoffDate.setDate(cutoffDate.getDate() - 7);
      } else if (dateFilter === '30days') {
        cutoffDate.setDate(cutoffDate.getDate() - 30);
      }
      filtered = filtered.filter((conv) => conv.createdAt >= cutoffDate);
    }

    return filtered;
  }, [conversations, searchQuery, dateFilter]);

  // Virtual scrolling
  const virtualizer = useVirtualizer({
    count: filteredConversations.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5,
  });
  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    if (!open) {
      return;
    }

    const rafId = window.requestAnimationFrame(() => {
      virtualizer.measure();
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [open, filteredConversations.length, virtualizer]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= 500) {
          alert('最多选择 500 条对话');
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  };

  const selectAllVisible = () => {
    const newSelected = new Set(selected);
    for (const conv of filteredConversations) {
      if (!conv.isDuplicate && newSelected.size < 500) {
        newSelected.add(conv.id);
      }
    }
    setSelected(newSelected);
  };

  const clearSelection = () => {
    setSelected(new Set());
  };

  const handleImport = () => {
    if (selected.size === 0) {
      alert('请至少选择一条对话');
      return;
    }
    onImport(Array.from(selected));
  };

  const availableCount = conversations.filter((c) => !c.isDuplicate).length;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="flex h-[80vh] max-w-4xl flex-col bg-surface-primary text-text-primary">
        <DialogHeader>
          <DialogTitle className="text-text-primary">
            精选导入 - 从 {conversations.length.toLocaleString()} 条对话中选择
          </DialogTitle>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-border-light pb-3">
          <div className="flex items-center gap-3">
            <Input
              type="text"
              placeholder="🔍 搜索标题或内容..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="rounded-md border border-border-light bg-surface-primary px-3 py-2 text-text-primary"
            >
              <option value="all">📅 全部</option>
              <option value="7days">最近7天</option>
              <option value="30days">最近30天</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="font-semibold">已选择 {selected.size} / 500 条</span>
              <span className="ml-2 text-text-secondary">
                (可用: {availableCount.toLocaleString()})
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={selectAllVisible}>
                全选本页
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                清空选择
              </Button>
            </div>
          </div>
        </div>

        {/* Virtual List */}
        <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualItems.length > 0
              ? virtualItems.map((virtualItem) => {
                  const conversation = filteredConversations[virtualItem.index];
                  return (
                    <div
                      key={virtualItem.key}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualItem.size}px`,
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                    >
                      <ConversationListItem
                        conversation={conversation}
                        isSelected={selected.has(conversation.id)}
                        onToggle={toggleSelect}
                        disabled={selected.size >= 500 && !selected.has(conversation.id)}
                      />
                    </div>
                  );
                })
              : filteredConversations.slice(0, 100).map((conversation) => {
                  return (
                    <ConversationListItem
                      key={conversation.id}
                      conversation={conversation}
                      isSelected={selected.has(conversation.id)}
                      onToggle={toggleSelect}
                      disabled={selected.size >= 500 && !selected.has(conversation.id)}
                    />
                  );
                })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border-light pt-3">
          <div className="text-sm text-text-secondary">
            显示 {filteredConversations.length.toLocaleString()} 条对话
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button onClick={handleImport} disabled={selected.size === 0}>
              导入选中项 ({selected.size})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

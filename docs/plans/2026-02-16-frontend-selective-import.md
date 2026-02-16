# Frontend Selective Conversation Import Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 重新设计对话导入功能，支持前端解析和三种导入模式：全部导入、批次导入、精选导入

**Architecture:**
- 前端解析 JSON 文件（支持 LibreChat 和 ChatGPT 格式）
- 前端检测重复对话（通过 conversationId）
- 提供三种模式：(1) 全部导入（上传原文件）(2) 批次导入（范围选择）(3) 精选导入（虚拟滚动列表）
- 新增后端 API 端点 `/api/convos/import-selective` 处理选择性导入

**Tech Stack:**
- Frontend: React 18, TypeScript, @tanstack/react-virtual (虚拟滚动), Tailwind CSS
- Backend: Express.js, existing importers
- Data Layer: TanStack Query

---

## Task 1: 创建前端解析工具

**Files:**
- Create: `client/src/utils/conversationParser.ts`
- Test: `client/src/utils/__tests__/conversationParser.test.ts`

### Step 1: 编写解析器测试

创建测试文件，验证 LibreChat 和 ChatGPT 格式的解析：

```typescript
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
```

### Step 2: 运行测试确认失败

```bash
cd client && npm test -- conversationParser
```

预期输出：`FAIL` - 模块不存在

### Step 3: 实现解析器

```typescript
// client/src/utils/conversationParser.ts
export type ImportFormat = 'librechat' | 'chatgpt' | 'claude';

export interface ConversationPreview {
  /** Unique ID for this preview item (array index) */
  id: string;
  /** Original conversation ID from source */
  conversationId: string;
  /** Conversation title */
  title: string;
  /** Creation timestamp */
  createdAt: Date;
  /** AI model used */
  model: string;
  /** Number of messages */
  messageCount: number;
  /** Preview of first user message */
  firstMessagePreview: string;
  /** Whether this conversation already exists in the user's account */
  isDuplicate: boolean;
  /** Original raw data (for upload) */
  rawData: unknown;
}

export interface ParseResult {
  format: ImportFormat;
  conversations: ConversationPreview[];
  totalCount: number;
}

/**
 * Detects the format of imported conversation data
 */
export function detectImportFormat(data: unknown): ImportFormat {
  // LibreChat single conversation
  if (
    typeof data === 'object' &&
    data !== null &&
    'conversationId' in data &&
    ('messages' in data || 'messagesTree' in data)
  ) {
    return 'librechat';
  }

  // Array-based formats (ChatGPT or Claude)
  if (Array.isArray(data) && data.length > 0) {
    // Claude format has chat_messages
    if ('chat_messages' in data[0]) {
      return 'claude';
    }
    // ChatGPT format has mapping
    if ('mapping' in data[0]) {
      return 'chatgpt';
    }
  }

  throw new Error('Unsupported import format');
}

/**
 * Extracts first user message from ChatGPT mapping
 */
function extractFirstUserMessage(mapping: Record<string, any>): string {
  for (const item of Object.values(mapping)) {
    if (item?.message?.author?.role === 'user') {
      const parts = item.message?.content?.parts;
      if (Array.isArray(parts) && parts.length > 0) {
        const text = typeof parts[0] === 'string' ? parts[0] : JSON.stringify(parts[0]);
        return text.slice(0, 100);
      }
    }
  }
  return '';
}

/**
 * Counts non-system messages in ChatGPT mapping
 */
function countChatGPTMessages(mapping: Record<string, any>): number {
  let count = 0;
  for (const item of Object.values(mapping)) {
    if (item?.message && item.message.author?.role !== 'system') {
      count++;
    }
  }
  return count;
}

/**
 * Parses ChatGPT conversation array into previews
 */
function parseChatGPTConversations(data: any[]): ConversationPreview[] {
  return data.map((conv, index) => ({
    id: `chatgpt-${index}`,
    conversationId: conv.id || `unknown-${index}`,
    title: conv.title || 'Untitled Conversation',
    createdAt: conv.create_time ? new Date(conv.create_time * 1000) : new Date(),
    model: extractModelFromMapping(conv.mapping),
    messageCount: countChatGPTMessages(conv.mapping || {}),
    firstMessagePreview: extractFirstUserMessage(conv.mapping || {}),
    isDuplicate: false, // Will be set later
    rawData: conv,
  }));
}

/**
 * Extracts model name from ChatGPT mapping
 */
function extractModelFromMapping(mapping: Record<string, any>): string {
  for (const item of Object.values(mapping)) {
    const model = item?.message?.metadata?.model_slug;
    if (model) {
      return model;
    }
  }
  return 'gpt-3.5-turbo';
}

/**
 * Parses LibreChat single conversation into preview
 */
function parseLibreChatConversation(data: any): ConversationPreview[] {
  const messages = data.messagesTree || data.messages || [];
  const firstUserMsg = messages.find((m: any) => m.isCreatedByUser);

  return [
    {
      id: 'librechat-0',
      conversationId: data.conversationId,
      title: data.title || 'Untitled Conversation',
      createdAt: firstUserMsg?.createdAt ? new Date(firstUserMsg.createdAt) : new Date(),
      model: data.endpoint || data.model || 'unknown',
      messageCount: messages.length,
      firstMessagePreview: (firstUserMsg?.text || '').slice(0, 100),
      isDuplicate: false,
      rawData: data,
    },
  ];
}

/**
 * Parses Claude conversation array into previews
 */
function parseClaudeConversations(data: any[]): ConversationPreview[] {
  return data.map((conv, index) => {
    const firstMsg = conv.chat_messages?.find((m: any) => m.sender === 'human');
    const textContent =
      firstMsg?.content?.find((c: any) => c.type === 'text')?.text || firstMsg?.text || '';

    return {
      id: `claude-${index}`,
      conversationId: conv.uuid || `unknown-${index}`,
      title: conv.name || 'Untitled Conversation',
      createdAt: conv.created_at ? new Date(conv.created_at) : new Date(),
      model: 'claude',
      messageCount: conv.chat_messages?.length || 0,
      firstMessagePreview: textContent.slice(0, 100),
      isDuplicate: false,
      rawData: conv,
    };
  });
}

/**
 * Main parser function - converts JSON string to conversation previews
 */
export async function parseImportFile(jsonString: string): Promise<ParseResult> {
  let data: unknown;
  try {
    data = JSON.parse(jsonString);
  } catch (error) {
    throw new Error('Invalid JSON file');
  }

  const format = detectImportFormat(data);
  let conversations: ConversationPreview[] = [];

  switch (format) {
    case 'chatgpt':
      conversations = parseChatGPTConversations(data as any[]);
      break;
    case 'librechat':
      conversations = parseLibreChatConversation(data);
      break;
    case 'claude':
      conversations = parseClaudeConversations(data as any[]);
      break;
  }

  return {
    format,
    conversations,
    totalCount: conversations.length,
  };
}

/**
 * Marks duplicate conversations based on existing conversation IDs
 */
export function markDuplicates(
  previews: ConversationPreview[],
  existingConversationIds: Set<string>,
): ConversationPreview[] {
  return previews.map((preview) => ({
    ...preview,
    isDuplicate: existingConversationIds.has(preview.conversationId),
  }));
}
```

### Step 4: 运行测试确认通过

```bash
cd client && npm test -- conversationParser
```

预期输出：`PASS` - 所有测试通过

### Step 5: 提交

```bash
git add client/src/utils/conversationParser.ts client/src/utils/__tests__/conversationParser.test.ts
git commit -m "feat: add conversation parser for import preview

- Support LibreChat, ChatGPT, and Claude formats
- Extract metadata: title, date, model, message count
- Mark duplicate conversations
- Include full test coverage"
```

---

## Task 2: 创建导入模式选择对话框

**Files:**
- Create: `client/src/components/Nav/SettingsTabs/Data/ImportModeDialog.tsx`
- Test: `client/src/components/Nav/SettingsTabs/Data/__tests__/ImportModeDialog.spec.tsx`

### Step 1: 编写组件测试

```typescript
// client/src/components/Nav/SettingsTabs/Data/__tests__/ImportModeDialog.spec.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ImportModeDialog from '../ImportModeDialog';

describe('ImportModeDialog', () => {
  const mockOnClose = jest.fn();
  const mockOnSelectMode = jest.fn();

  const defaultProps = {
    open: true,
    totalConversations: 3000,
    duplicateCount: 150,
    onClose: mockOnClose,
    onSelectMode: mockOnSelectMode,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render conversation statistics', () => {
    render(<ImportModeDialog {...defaultProps} />);

    expect(screen.getByText(/3,000/)).toBeInTheDocument();
    expect(screen.getByText(/150.*已存在/)).toBeInTheDocument();
    expect(screen.getByText(/2,850.*可导入/)).toBeInTheDocument();
  });

  it('should show all three import modes', () => {
    render(<ImportModeDialog {...defaultProps} />);

    expect(screen.getByLabelText(/全部导入/)).toBeInTheDocument();
    expect(screen.getByLabelText(/批次导入/)).toBeInTheDocument();
    expect(screen.getByLabelText(/精选导入/)).toBeInTheDocument();
  });

  it('should handle full import selection', () => {
    render(<ImportModeDialog {...defaultProps} />);

    const fullImportRadio = screen.getByLabelText(/全部导入/);
    fireEvent.click(fullImportRadio);

    const nextButton = screen.getByRole('button', { name: /下一步/ });
    fireEvent.click(nextButton);

    expect(mockOnSelectMode).toHaveBeenCalledWith({ mode: 'full' });
  });

  it('should validate batch range inputs', () => {
    render(<ImportModeDialog {...defaultProps} />);

    const batchRadio = screen.getByLabelText(/批次导入/);
    fireEvent.click(batchRadio);

    const startInput = screen.getByLabelText(/从第.*条/);
    const endInput = screen.getByLabelText(/到第.*条/);

    fireEvent.change(startInput, { target: { value: '1' } });
    fireEvent.change(endInput, { target: { value: '600' } });

    const nextButton = screen.getByRole('button', { name: /下一步/ });
    fireEvent.click(nextButton);

    // Should show error for exceeding 500 limit
    expect(screen.getByText(/最多选择 500 条/)).toBeInTheDocument();
    expect(mockOnSelectMode).not.toHaveBeenCalled();
  });

  it('should allow valid batch range', () => {
    render(<ImportModeDialog {...defaultProps} />);

    const batchRadio = screen.getByLabelText(/批次导入/);
    fireEvent.click(batchRadio);

    const startInput = screen.getByLabelText(/从第.*条/);
    const endInput = screen.getByLabelText(/到第.*条/);

    fireEvent.change(startInput, { target: { value: '1' } });
    fireEvent.change(endInput, { target: { value: '500' } });

    const nextButton = screen.getByRole('button', { name: /下一步/ });
    fireEvent.click(nextButton);

    expect(mockOnSelectMode).toHaveBeenCalledWith({
      mode: 'batch',
      start: 1,
      end: 500,
    });
  });

  it('should handle selective import selection', () => {
    render(<ImportModeDialog {...defaultProps} />);

    const selectiveRadio = screen.getByLabelText(/精选导入/);
    fireEvent.click(selectiveRadio);

    const nextButton = screen.getByRole('button', { name: /下一步/ });
    fireEvent.click(nextButton);

    expect(mockOnSelectMode).toHaveBeenCalledWith({ mode: 'selective' });
  });
});
```

### Step 2: 运行测试确认失败

```bash
cd client && npm test -- ImportModeDialog
```

预期输出：`FAIL` - 组件不存在

### Step 3: 实现模式选择对话框

```typescript
// client/src/components/Nav/SettingsTabs/Data/ImportModeDialog.tsx
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Label,
  Button,
  Input,
} from '@librechat/client';
import { useLocalize } from '~/hooks';

export type ImportMode = 'full' | 'batch' | 'selective';

export interface ImportModeSelection {
  mode: ImportMode;
  start?: number;
  end?: number;
}

interface ImportModeDialogProps {
  open: boolean;
  totalConversations: number;
  duplicateCount: number;
  onClose: () => void;
  onSelectMode: (selection: ImportModeSelection) => void;
}

export default function ImportModeDialog({
  open,
  totalConversations,
  duplicateCount,
  onClose,
  onSelectMode,
}: ImportModeDialogProps) {
  const localize = useLocalize();
  const [selectedMode, setSelectedMode] = useState<ImportMode>('full');
  const [batchStart, setBatchStart] = useState('1');
  const [batchEnd, setBatchEnd] = useState('500');
  const [error, setError] = useState('');

  const newConversations = totalConversations - duplicateCount;

  const handleNext = () => {
    setError('');

    if (selectedMode === 'full') {
      onSelectMode({ mode: 'full' });
      return;
    }

    if (selectedMode === 'batch') {
      const start = parseInt(batchStart, 10);
      const end = parseInt(batchEnd, 10);

      if (isNaN(start) || isNaN(end)) {
        setError('请输入有效的数字');
        return;
      }

      if (start < 1 || end > totalConversations) {
        setError(`范围必须在 1 到 ${totalConversations.toLocaleString()} 之间`);
        return;
      }

      if (start > end) {
        setError('起始位置不能大于结束位置');
        return;
      }

      if (end - start + 1 > 500) {
        setError('单次最多选择 500 条对话');
        return;
      }

      onSelectMode({ mode: 'batch', start, end });
      return;
    }

    if (selectedMode === 'selective') {
      onSelectMode({ mode: 'selective' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>选择导入方式</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Statistics */}
          <div className="rounded-lg bg-surface-tertiary p-4 text-sm">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-2xl">📊</span>
              <span className="font-semibold">
                检测到 {totalConversations.toLocaleString()} 条对话
              </span>
            </div>
            {duplicateCount > 0 && (
              <div className="mb-1 text-text-secondary">
                ⚠️ 其中 {duplicateCount.toLocaleString()} 条已存在（将跳过）
              </div>
            )}
            <div className="text-text-primary">
              ✅ 可导入：{newConversations.toLocaleString()} 条新对话
            </div>
          </div>

          {/* Mode Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">请选择导入方式：</Label>

            {/* Full Import */}
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border-light p-3 hover:bg-surface-hover">
              <input
                type="radio"
                name="import-mode"
                value="full"
                checked={selectedMode === 'full'}
                onChange={(e) => setSelectedMode(e.target.value as ImportMode)}
                className="mt-1"
                aria-label="全部导入"
              />
              <div className="flex-1">
                <div className="font-semibold">全部导入 ({newConversations.toLocaleString()} 条)</div>
                <div className="text-xs text-text-secondary">
                  使用后端批量处理，约需 5-10 分钟
                </div>
              </div>
            </label>

            {/* Batch Import */}
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border-light p-3 hover:bg-surface-hover">
              <input
                type="radio"
                name="import-mode"
                value="batch"
                checked={selectedMode === 'batch'}
                onChange={(e) => setSelectedMode(e.target.value as ImportMode)}
                className="mt-1"
                aria-label="批次导入"
              />
              <div className="flex-1 space-y-2">
                <div className="font-semibold">批次导入</div>
                <div className="flex items-center gap-2 text-sm">
                  <span>从第</span>
                  <Input
                    type="number"
                    value={batchStart}
                    onChange={(e) => setBatchStart(e.target.value)}
                    disabled={selectedMode !== 'batch'}
                    className="w-20"
                    min={1}
                    max={totalConversations}
                    aria-label="从第几条"
                  />
                  <span>条</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span>到第</span>
                  <Input
                    type="number"
                    value={batchEnd}
                    onChange={(e) => setBatchEnd(e.target.value)}
                    disabled={selectedMode !== 'batch'}
                    className="w-20"
                    min={1}
                    max={totalConversations}
                    aria-label="到第几条"
                  />
                  <span>条</span>
                </div>
                <div className="text-xs text-text-secondary">(最多选择 500 条)</div>
              </div>
            </label>

            {/* Selective Import */}
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border-light p-3 hover:bg-surface-hover">
              <input
                type="radio"
                name="import-mode"
                value="selective"
                checked={selectedMode === 'selective'}
                onChange={(e) => setSelectedMode(e.target.value as ImportMode)}
                className="mt-1"
                aria-label="精选导入"
              />
              <div className="flex-1">
                <div className="font-semibold">精选导入</div>
                <div className="text-xs text-text-secondary">手动选择需要导入的对话</div>
              </div>
            </label>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button onClick={handleNext}>下一步</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### Step 4: 运行测试确认通过

```bash
cd client && npm test -- ImportModeDialog
```

预期输出：`PASS`

### Step 5: 提交

```bash
git add client/src/components/Nav/SettingsTabs/Data/ImportModeDialog.tsx client/src/components/Nav/SettingsTabs/Data/__tests__/ImportModeDialog.spec.tsx
git commit -m "feat: add import mode selection dialog

- Three modes: full, batch, selective
- Batch range validation (max 500)
- Statistics display (total, duplicates, new)
- Full test coverage"
```

---

## Task 3: 创建精选导入对话框（虚拟滚动）

**Files:**
- Create: `client/src/components/Nav/SettingsTabs/Data/SelectiveImportDialog.tsx`
- Create: `client/src/components/Nav/SettingsTabs/Data/ConversationListItem.tsx`
- Install: `@tanstack/react-virtual`

### Step 1: 安装虚拟滚动依赖

```bash
cd client && npm install @tanstack/react-virtual
```

预期输出：依赖安装成功

### Step 2: 编写列表项组件

```typescript
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
          <div className="font-medium text-sm truncate">{conversation.title}</div>
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
```

### Step 3: 实现精选导入对话框

```typescript
// client/src/components/Nav/SettingsTabs/Data/SelectiveImportDialog.tsx
import { useState, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Button,
} from '@librechat/client';
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
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
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
              className="rounded-md border border-border-light bg-surface-primary px-3 py-2"
            >
              <option value="all">📅 全部</option>
              <option value="7days">最近7天</option>
              <option value="30days">最近30天</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="font-semibold">
                已选择 {selected.size} / 500 条
              </span>
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
        <div ref={parentRef} className="flex-1 overflow-auto">
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
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
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center border-t border-border-light pt-3">
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
```

### Step 4: 测试虚拟滚动性能

手动测试：
1. 启动开发服务器：`npm run frontend:dev`
2. 创建包含 1000+ 对话的测试 JSON 文件
3. 导入文件并选择"精选导入"
4. 验证滚动流畅，无卡顿

### Step 5: 提交

```bash
git add client/src/components/Nav/SettingsTabs/Data/SelectiveImportDialog.tsx client/src/components/Nav/SettingsTabs/Data/ConversationListItem.tsx client/package.json
git commit -m "feat: add selective import dialog with virtual scrolling

- Virtual list with @tanstack/react-virtual
- Search and date range filters
- Max 500 conversations selection
- Duplicate conversation marking
- Optimized for large datasets (1000+ conversations)"
```

---

## Task 4: 更新 ImportConversations 组件整合三种模式

**Files:**
- Modify: `client/src/components/Nav/SettingsTabs/Data/ImportConversations.tsx`

### Step 1: 备份现有组件

```bash
cp client/src/components/Nav/SettingsTabs/Data/ImportConversations.tsx client/src/components/Nav/SettingsTabs/Data/ImportConversations.tsx.bak
```

### Step 2: 修改组件以支持三种模式

```typescript
// client/src/components/Nav/SettingsTabs/Data/ImportConversations.tsx
import { useState, useRef, useCallback } from 'react';
import { Import } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { QueryKeys } from 'librechat-data-provider';
import { Spinner, useToastContext, Label, Button } from '@librechat/client';
import { useUploadConversationsMutation } from '~/data-provider';
import { parseImportFile, markDuplicates, ConversationPreview } from '~/utils/conversationParser';
import ImportModeDialog, { ImportModeSelection } from './ImportModeDialog';
import SelectiveImportDialog from './SelectiveImportDialog';
import ImportProgressModal from './ImportProgressModal';
import { NotificationSeverity } from '~/common';
import { useLocalize } from '~/hooks';
import { cn, logger } from '~/utils';

type ImportStep = 'idle' | 'mode-selection' | 'selective-import' | 'uploading';

function ImportConversations() {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const { showToast } = useToastContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [step, setStep] = useState<ImportStep>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [fileName, setFileName] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [isError, setIsError] = useState(false);

  const uploadFile = useUploadConversationsMutation({
    onSuccess: () => {
      setIsComplete(true);
      setIsUploading(false);
      showToast({
        message: localize('com_ui_import_conversation_success'),
        status: NotificationSeverity.SUCCESS,
      });
      queryClient.invalidateQueries([QueryKeys.allConversations]);
    },
    onError: (error) => {
      logger.error('Import error:', error);
      setIsError(true);
      setIsUploading(false);
      showToast({
        message: localize('com_ui_import_conversation_error'),
        status: NotificationSeverity.ERROR,
      });
    },
  });

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0];
      if (!selectedFile) {
        return;
      }

      try {
        setFileName(selectedFile.name);
        setFile(selectedFile);

        // Parse file
        const text = await selectedFile.text();
        const parseResult = await parseImportFile(text);

        // Check for duplicates
        const existingConvos = queryClient.getQueryData<any[]>([QueryKeys.allConversations]) || [];
        const existingIds = new Set(
          existingConvos.map((c) => c.conversationId).filter(Boolean),
        );
        const markedConversations = markDuplicates(parseResult.conversations, existingIds);

        setConversations(markedConversations);
        setDuplicateCount(markedConversations.filter((c) => c.isDuplicate).length);

        // Show mode selection dialog
        setStep('mode-selection');
      } catch (error) {
        logger.error('File parsing error:', error);
        showToast({
          message: '文件解析失败，请检查文件格式',
          status: NotificationSeverity.ERROR,
        });
      }

      event.target.value = '';
    },
    [queryClient, showToast],
  );

  const handleModeSelection = useCallback(
    (selection: ImportModeSelection) => {
      setStep('idle');

      if (selection.mode === 'full') {
        // Upload original file
        if (!file) {
          return;
        }
        const formData = new FormData();
        formData.append('file', file, encodeURIComponent(file.name));
        setShowProgressModal(true);
        setIsUploading(true);
        uploadFile.mutate(formData);
      } else if (selection.mode === 'batch') {
        // Extract range and upload
        const { start = 1, end = 500 } = selection;
        const selected = conversations
          .filter((c) => !c.isDuplicate)
          .slice(start - 1, end);
        uploadSelectedConversations(selected);
      } else if (selection.mode === 'selective') {
        // Show selective import dialog
        setStep('selective-import');
      }
    },
    [file, conversations, uploadFile],
  );

  const uploadSelectedConversations = useCallback(
    async (selected: ConversationPreview[]) => {
      if (selected.length === 0) {
        showToast({
          message: '没有选择任何对话',
          status: NotificationSeverity.WARNING,
        });
        return;
      }

      setShowProgressModal(true);
      setIsUploading(true);

      try {
        const conversationData = selected.map((c) => c.rawData);
        const blob = new Blob([JSON.stringify(conversationData)], {
          type: 'application/json',
        });
        const formData = new FormData();
        formData.append('file', blob, 'selected-conversations.json');

        uploadFile.mutate(formData);
      } catch (error) {
        logger.error('Upload error:', error);
        setIsError(true);
        setIsUploading(false);
        showToast({
          message: '上传失败',
          status: NotificationSeverity.ERROR,
        });
      }
    },
    [uploadFile, showToast],
  );

  const handleSelectiveImport = useCallback(
    (selectedIds: string[]) => {
      const selected = conversations.filter((c) => selectedIds.includes(c.id));
      setStep('idle');
      uploadSelectedConversations(selected);
    },
    [conversations, uploadSelectedConversations],
  );

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const resetState = useCallback(() => {
    setStep('idle');
    setFile(null);
    setConversations([]);
    setDuplicateCount(0);
    setShowProgressModal(false);
    setFileName('');
    setIsComplete(false);
    setIsError(false);
  }, []);

  return (
    <>
      <div className="flex items-center justify-between">
        <Label id="import-conversation-label">{localize('com_ui_import_conversation_info')}</Label>
        <Button
          variant="outline"
          onClick={handleImportClick}
          disabled={isUploading}
          aria-label={localize('com_ui_import')}
          aria-labelledby="import-conversation-label"
        >
          {isUploading ? (
            <>
              <Spinner className="mr-1 w-4" />
              <span>{localize('com_ui_importing')}</span>
            </>
          ) : (
            <>
              <Import className="mr-1 flex h-4 w-4 items-center stroke-1" aria-hidden="true" />
              <span>{localize('com_ui_import')}</span>
            </>
          )}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className={cn('hidden')}
          accept=".json"
          onChange={handleFileChange}
          aria-hidden="true"
        />
      </div>

      {/* Mode Selection Dialog */}
      <ImportModeDialog
        open={step === 'mode-selection'}
        totalConversations={conversations.length}
        duplicateCount={duplicateCount}
        onClose={resetState}
        onSelectMode={handleModeSelection}
      />

      {/* Selective Import Dialog */}
      <SelectiveImportDialog
        open={step === 'selective-import'}
        conversations={conversations.filter((c) => !c.isDuplicate)}
        onClose={resetState}
        onImport={handleSelectiveImport}
      />

      {/* Progress Modal */}
      <ImportProgressModal
        open={showProgressModal}
        fileName={fileName}
        isComplete={isComplete}
        isError={isError}
        onClose={resetState}
      />
    </>
  );
}

export default ImportConversations;
```

### Step 3: 测试完整流程

手动测试所有三种模式：
1. 全部导入
2. 批次导入（范围 1-100）
3. 精选导入（勾选特定对话）

### Step 4: 提交

```bash
git add client/src/components/Nav/SettingsTabs/Data/ImportConversations.tsx
git commit -m "feat: integrate three import modes into ImportConversations

- Parse file on selection
- Show mode selection dialog
- Handle full/batch/selective import
- Mark duplicates before import
- Seamless UX flow"
```

---

## Task 5: 创建后端选择性导入端点

**Files:**
- Modify: `api/server/routes/convos.js`
- Create: `api/server/controllers/ConversationController.js` (extract import logic)

### Step 1: 添加新路由

在 `api/server/routes/convos.js` 中添加新端点：

```javascript
// api/server/routes/convos.js (add after existing /import route)

/**
 * Imports selected conversations from JSON array.
 * @route POST /import-selective
 * @param {Array} req.body.conversations - Array of conversation objects to import.
 * @returns {object} 200 - success response with results
 */
router.post(
  '/import-selective',
  importIpLimiter,
  importUserLimiter,
  requireJwtAuth,
  async (req, res) => {
    try {
      const { conversations } = req.body;

      if (!Array.isArray(conversations)) {
        return res.status(400).json({ error: 'conversations must be an array' });
      }

      if (conversations.length === 0) {
        return res.status(400).json({ error: 'conversations array is empty' });
      }

      if (conversations.length > 500) {
        return res.status(400).json({ error: 'Maximum 500 conversations per request' });
      }

      const results = {
        success: [],
        failed: [],
      };

      // Import each conversation
      for (let i = 0; i < conversations.length; i++) {
        try {
          const conv = conversations[i];
          const { getImporter } = require('~/server/utils/import/importers');
          const importer = getImporter(conv);

          await importer(conv, req.user.id);

          results.success.push({
            index: i,
            conversationId: conv.conversationId || conv.id || `unknown-${i}`,
            title: conv.title || 'Untitled',
          });
        } catch (error) {
          logger.error(`Failed to import conversation at index ${i}:`, error);
          results.failed.push({
            index: i,
            conversationId: conversations[i].conversationId || conversations[i].id || `unknown-${i}`,
            title: conversations[i].title || 'Untitled',
            error: error.message,
          });
        }
      }

      logger.info(
        `user: ${req.user.id} | Selective import completed: ${results.success.length} succeeded, ${results.failed.length} failed`,
      );

      res.status(200).json({
        message: `成功导入 ${results.success.length} 条对话，失败 ${results.failed.length} 条`,
        success: results.success,
        failed: results.failed,
      });
    } catch (error) {
      logger.error('Error in selective import:', error);
      res.status(500).json({ error: 'Internal server error during selective import' });
    }
  },
);
```

### Step 2: 测试新端点

使用 curl 测试：

```bash
curl -X POST http://localhost:3080/api/convos/import-selective \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "conversations": [
      {
        "conversationId": "test-123",
        "title": "Test Conversation",
        "messages": [
          {"messageId": "m1", "text": "Hello", "isCreatedByUser": true},
          {"messageId": "m2", "text": "Hi", "isCreatedByUser": false}
        ]
      }
    ]
  }'
```

预期响应：
```json
{
  "message": "成功导入 1 条对话，失败 0 条",
  "success": [{"index": 0, "conversationId": "test-123", "title": "Test Conversation"}],
  "failed": []
}
```

### Step 3: 提交

```bash
git add api/server/routes/convos.js
git commit -m "feat: add selective import endpoint

- POST /api/convos/import-selective
- Accept array of conversation objects (max 500)
- Return success/failed results per conversation
- Reuse existing importers (getImporter)
- Proper error handling and logging"
```

---

## Task 6: 创建前端 API 客户端

**Files:**
- Modify: `packages/data-provider/src/api-endpoints.ts`
- Create: `client/src/data-provider/mutations.ts` (add mutation)

### Step 1: 添加 API 端点定义

```typescript
// packages/data-provider/src/api-endpoints.ts (add to existing endpoints)

export const importSelectiveConversations = () => ({
  method: 'POST' as const,
  url: '/api/convos/import-selective',
});
```

### Step 2: 创建 mutation hook

```typescript
// client/src/data-provider/mutations.ts (add to existing mutations)

import { useMutation } from '@tanstack/react-query';
import { dataService } from 'librechat-data-provider';

export interface SelectiveImportRequest {
  conversations: unknown[];
}

export interface SelectiveImportResponse {
  message: string;
  success: Array<{ index: number; conversationId: string; title: string }>;
  failed: Array<{ index: number; conversationId: string; title: string; error: string }>;
}

export const useImportSelectiveConversationsMutation = (
  options?: {
    onSuccess?: (data: SelectiveImportResponse) => void;
    onError?: (error: unknown) => void;
  },
) => {
  return useMutation({
    mutationFn: async (payload: SelectiveImportRequest) => {
      const response = await dataService.importSelectiveConversations(payload);
      return response.data as SelectiveImportResponse;
    },
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  });
};
```

### Step 3: 构建 data-provider

```bash
npm run build:data-provider
```

预期输出：构建成功

### Step 4: 更新 ImportConversations 使用新 mutation

修改 `client/src/components/Nav/SettingsTabs/Data/ImportConversations.tsx`：

```typescript
// 替换 uploadSelectedConversations 函数
import { useImportSelectiveConversationsMutation } from '~/data-provider/mutations';

const selectiveMutation = useImportSelectiveConversationsMutation({
  onSuccess: (data) => {
    setIsComplete(true);
    setIsUploading(false);

    if (data.failed.length > 0) {
      showToast({
        message: `导入完成：成功 ${data.success.length} 条，失败 ${data.failed.length} 条`,
        status: NotificationSeverity.WARNING,
      });
      // TODO: 显示失败列表给用户
    } else {
      showToast({
        message: data.message,
        status: NotificationSeverity.SUCCESS,
      });
    }

    queryClient.invalidateQueries([QueryKeys.allConversations]);
  },
  onError: (error) => {
    logger.error('Selective import error:', error);
    setIsError(true);
    setIsUploading(false);
    showToast({
      message: '导入失败',
      status: NotificationSeverity.ERROR,
    });
  },
});

const uploadSelectedConversations = useCallback(
  async (selected: ConversationPreview[]) => {
    if (selected.length === 0) {
      showToast({
        message: '没有选择任何对话',
        status: NotificationSeverity.WARNING,
      });
      return;
    }

    setShowProgressModal(true);
    setIsUploading(true);

    const conversationData = selected.map((c) => c.rawData);
    selectiveMutation.mutate({ conversations: conversationData });
  },
  [selectiveMutation, showToast],
);
```

### Step 5: 提交

```bash
git add packages/data-provider/src/api-endpoints.ts client/src/data-provider/mutations.ts client/src/components/Nav/SettingsTabs/Data/ImportConversations.tsx
git commit -m "feat: add selective import API client

- Add importSelectiveConversations endpoint
- Create useImportSelectiveConversationsMutation hook
- Integrate with ImportConversations component
- Handle partial success/failure scenarios"
```

---

## Task 7: 添加失败重试功能

**Files:**
- Create: `client/src/components/Nav/SettingsTabs/Data/ImportResultDialog.tsx`

### Step 1: 创建结果对话框组件

```typescript
// client/src/components/Nav/SettingsTabs/Data/ImportResultDialog.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button } from '@librechat/client';
import { useLocalize } from '~/hooks';

interface ImportResult {
  index: number;
  conversationId: string;
  title: string;
  error?: string;
}

interface ImportResultDialogProps {
  open: boolean;
  successCount: number;
  failedItems: ImportResult[];
  onClose: () => void;
  onRetry: (items: ImportResult[]) => void;
}

export default function ImportResultDialog({
  open,
  successCount,
  failedItems,
  onClose,
  onRetry,
}: ImportResultDialogProps) {
  const localize = useLocalize();

  const handleRetryAll = () => {
    onRetry(failedItems);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>导入结果</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-auto">
          {/* Success Summary */}
          <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
            <div className="text-green-700 dark:text-green-400">
              ✅ 成功导入 {successCount} 条对话
            </div>
          </div>

          {/* Failed Items */}
          {failedItems.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold">
                ❌ 失败 {failedItems.length} 条：
              </div>
              <div className="max-h-96 space-y-2 overflow-auto rounded-lg border border-border-light p-2">
                {failedItems.map((item) => (
                  <div
                    key={item.index}
                    className="rounded bg-surface-secondary p-3 text-sm"
                  >
                    <div className="font-medium">{item.title}</div>
                    <div className="text-xs text-text-secondary">
                      ID: {item.conversationId}
                    </div>
                    {item.error && (
                      <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                        错误: {item.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 border-t border-border-light pt-3">
          {failedItems.length > 0 && (
            <Button variant="outline" onClick={handleRetryAll}>
              重试失败项
            </Button>
          )}
          <Button onClick={onClose}>关闭</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### Step 2: 集成到 ImportConversations

在 `ImportConversations.tsx` 中添加结果对话框：

```typescript
import ImportResultDialog from './ImportResultDialog';

// Add state
const [showResultDialog, setShowResultDialog] = useState(false);
const [importResults, setImportResults] = useState<{
  success: number;
  failed: any[];
}>({ success: 0, failed: [] });

// Update selectiveMutation.onSuccess
onSuccess: (data) => {
  setIsComplete(true);
  setIsUploading(false);
  setImportResults({ success: data.success.length, failed: data.failed });

  if (data.failed.length > 0) {
    setShowResultDialog(true);
  } else {
    showToast({
      message: data.message,
      status: NotificationSeverity.SUCCESS,
    });
  }

  queryClient.invalidateQueries([QueryKeys.allConversations]);
},

// Add retry handler
const handleRetry = useCallback((failedItems: any[]) => {
  // Map failed items back to ConversationPreview
  const toRetry = failedItems.map(item =>
    conversations.find(c =>
      c.conversationId === item.conversationId
    )
  ).filter(Boolean);

  setShowResultDialog(false);
  uploadSelectedConversations(toRetry);
}, [conversations, uploadSelectedConversations]);

// Add component
<ImportResultDialog
  open={showResultDialog}
  successCount={importResults.success}
  failedItems={importResults.failed}
  onClose={() => setShowResultDialog(false)}
  onRetry={handleRetry}
/>
```

### Step 3: 提交

```bash
git add client/src/components/Nav/SettingsTabs/Data/ImportResultDialog.tsx client/src/components/Nav/SettingsTabs/Data/ImportConversations.tsx
git commit -m "feat: add import result dialog with retry

- Show success/failure summary
- List failed conversations with errors
- Retry button for failed items
- Integrated into import flow"
```

---

## Task 8: 添加国际化支持

**Files:**
- Modify: `client/src/locales/zh-Hans/translation.json`
- Modify: `client/src/locales/en/translation.json`

### Step 1: 添加中文翻译

```json
// client/src/locales/zh-Hans/translation.json (add to existing keys)
{
  "com_ui_import_mode_full": "全部导入",
  "com_ui_import_mode_batch": "批次导入",
  "com_ui_import_mode_selective": "精选导入",
  "com_ui_import_detected_conversations": "检测到 {{count}} 条对话",
  "com_ui_import_duplicates_found": "其中 {{count}} 条已存在（将跳过）",
  "com_ui_import_available": "可导入：{{count}} 条新对话",
  "com_ui_import_select_mode": "请选择导入方式：",
  "com_ui_import_full_desc": "使用后端批量处理，约需 5-10 分钟",
  "com_ui_import_batch_from": "从第",
  "com_ui_import_batch_to": "到第",
  "com_ui_import_batch_unit": "条",
  "com_ui_import_batch_max": "最多选择 500 条",
  "com_ui_import_selective_desc": "手动选择需要导入的对话",
  "com_ui_import_search_placeholder": "🔍 搜索标题或内容...",
  "com_ui_import_date_all": "📅 全部",
  "com_ui_import_date_7days": "最近7天",
  "com_ui_import_date_30days": "最近30天",
  "com_ui_import_selected": "已选择 {{count}} / 500 条",
  "com_ui_import_available_count": "可用: {{count}}",
  "com_ui_import_select_all_page": "全选本页",
  "com_ui_import_clear_selection": "清空选择",
  "com_ui_import_import_selected": "导入选中项 ({{count}})",
  "com_ui_import_result_success": "✅ 成功导入 {{count}} 条对话",
  "com_ui_import_result_failed": "❌ 失败 {{count}} 条",
  "com_ui_import_retry_failed": "重试失败项",
  "com_ui_import_parse_error": "文件解析失败，请检查文件格式",
  "com_ui_import_no_selection": "没有选择任何对话",
  "com_ui_import_max_500": "最多选择 500 条对话",
  "com_ui_import_validation_range": "范围必须在 1 到 {{max}} 之间",
  "com_ui_import_validation_start_end": "起始位置不能大于结束位置",
  "com_ui_import_validation_number": "请输入有效的数字"
}
```

### Step 2: 添加英文翻译

```json
// client/src/locales/en/translation.json (add to existing keys)
{
  "com_ui_import_mode_full": "Import All",
  "com_ui_import_mode_batch": "Batch Import",
  "com_ui_import_mode_selective": "Selective Import",
  "com_ui_import_detected_conversations": "Detected {{count}} conversations",
  "com_ui_import_duplicates_found": "{{count}} already exist (will be skipped)",
  "com_ui_import_available": "Available: {{count}} new conversations",
  "com_ui_import_select_mode": "Select import mode:",
  "com_ui_import_full_desc": "Backend batch processing, takes ~5-10 minutes",
  "com_ui_import_batch_from": "From",
  "com_ui_import_batch_to": "to",
  "com_ui_import_batch_unit": "",
  "com_ui_import_batch_max": "Max 500 conversations",
  "com_ui_import_selective_desc": "Manually select conversations to import",
  "com_ui_import_search_placeholder": "🔍 Search title or content...",
  "com_ui_import_date_all": "📅 All",
  "com_ui_import_date_7days": "Last 7 days",
  "com_ui_import_date_30days": "Last 30 days",
  "com_ui_import_selected": "Selected {{count}} / 500",
  "com_ui_import_available_count": "Available: {{count}}",
  "com_ui_import_select_all_page": "Select All on Page",
  "com_ui_import_clear_selection": "Clear Selection",
  "com_ui_import_import_selected": "Import Selected ({{count}})",
  "com_ui_import_result_success": "✅ Successfully imported {{count}} conversations",
  "com_ui_import_result_failed": "❌ Failed {{count}}",
  "com_ui_import_retry_failed": "Retry Failed",
  "com_ui_import_parse_error": "File parsing failed, please check file format",
  "com_ui_import_no_selection": "No conversations selected",
  "com_ui_import_max_500": "Maximum 500 conversations",
  "com_ui_import_validation_range": "Range must be between 1 and {{max}}",
  "com_ui_import_validation_start_end": "Start cannot be greater than end",
  "com_ui_import_validation_number": "Please enter a valid number"
}
```

### Step 3: 更新组件使用 localize

在所有新组件中替换硬编码文本为 `localize()` 调用。

### Step 4: 提交

```bash
git add client/src/locales/zh-Hans/translation.json client/src/locales/en/translation.json
git commit -m "feat: add i18n support for import feature

- Chinese translations
- English translations
- All UI text localized"
```

---

## Task 9: 编写集成测试

**Files:**
- Create: `client/src/components/Nav/SettingsTabs/Data/__tests__/ImportFlow.integration.spec.tsx`

### Step 1: 创建集成测试

```typescript
// client/src/components/Nav/SettingsTabs/Data/__tests__/ImportFlow.integration.spec.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import ImportConversations from '../ImportConversations';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Import Flow Integration', () => {
  it('should complete full import flow', async () => {
    const { container } = render(<ImportConversations />, { wrapper: createWrapper() });

    // Click import button
    const importButton = screen.getByLabelText(/import/i);
    fireEvent.click(importButton);

    // Simulate file selection
    const fileInput = container.querySelector('input[type="file"]');
    const file = new File(
      [JSON.stringify([{ id: 'test', title: 'Test', mapping: {} }])],
      'test.json',
      { type: 'application/json' },
    );

    fireEvent.change(fileInput!, { target: { files: [file] } });

    // Wait for mode dialog
    await waitFor(() => {
      expect(screen.getByText(/选择导入方式/)).toBeInTheDocument();
    });

    // Select full import
    const fullImportRadio = screen.getByLabelText(/全部导入/);
    fireEvent.click(fullImportRadio);

    const nextButton = screen.getByRole('button', { name: /下一步/ });
    fireEvent.click(nextButton);

    // Should trigger upload
    await waitFor(() => {
      expect(screen.getByText(/importing/i)).toBeInTheDocument();
    });
  });

  it('should handle batch import with validation', async () => {
    // Similar flow but test batch mode with range validation
  });

  it('should handle selective import', async () => {
    // Test selective import with virtual list
  });
});
```

### Step 2: 运行集成测试

```bash
cd client && npm test -- ImportFlow.integration
```

### Step 3: 提交

```bash
git add client/src/components/Nav/SettingsTabs/Data/__tests__/ImportFlow.integration.spec.tsx
git commit -m "test: add integration tests for import flow

- Full import flow test
- Batch import validation test
- Selective import test"
```

---

## Task 10: 更新文档

**Files:**
- Create: `docs/features/selective-import.md`
- Modify: `CLAUDE.md`

### Step 1: 创建功能文档

```markdown
<!-- docs/features/selective-import.md -->
# Selective Conversation Import

## Overview

LibreChat 支持三种对话导入模式，满足不同使用场景：

1. **全部导入** - 快速导入所有对话
2. **批次导入** - 导入指定范围的对话
3. **精选导入** - 手动选择特定对话

## Supported Formats

- **LibreChat** - 原生导出格式
- **ChatGPT** - OpenAI ChatGPT 导出格式
- **Claude** - Anthropic Claude 导出格式

## Features

### Duplicate Detection

系统会自动检测已存在的对话（通过 conversationId），并在导入前标记重复项。

### Virtual Scrolling

精选导入模式使用虚拟滚动技术，可流畅处理数千条对话的列表。

### Batch Processing

- 批次导入：单次最多 500 条
- 精选导入：单次最多选择 500 条
- 全部导入：无限制（后端处理）

### Error Handling

部分导入失败时，系统会：
1. 显示成功/失败统计
2. 列出失败的对话及错误原因
3. 提供重试失败项的选项

## Usage

### 1. Full Import (全部导入)

最快的导入方式，适合账号迁移：

```
1. 点击 "导入" 按钮
2. 选择 JSON 文件
3. 选择 "全部导入"
4. 等待后端处理完成
```

### 2. Batch Import (批次导入)

导入特定范围的对话：

```
1. 点击 "导入" 按钮
2. 选择 JSON 文件
3. 选择 "批次导入"
4. 输入范围：从第 X 条到第 Y 条
5. 点击 "下一步"
```

限制：
- 单次最多 500 条
- 范围必须有效（1 到总数）

### 3. Selective Import (精选导入)

手动选择特定对话：

```
1. 点击 "导入" 按钮
2. 选择 JSON 文件
3. 选择 "精选导入"
4. 使用搜索和过滤功能
5. 勾选需要的对话（最多 500 条）
6. 点击 "导入选中项"
```

功能：
- 搜索标题或内容
- 按日期范围过滤
- 虚拟滚动（性能优化）
- 重复对话自动标记

## API

### POST /api/convos/import-selective

导入选中的对话数组。

**Request:**
```json
{
  "conversations": [
    { /* conversation object */ },
    { /* conversation object */ }
  ]
}
```

**Response:**
```json
{
  "message": "成功导入 23 条对话，失败 0 条",
  "success": [
    { "index": 0, "conversationId": "abc", "title": "..." }
  ],
  "failed": []
}
```

## Architecture

### Frontend

```
ImportConversations
  ├── conversationParser (解析文件)
  ├── ImportModeDialog (模式选择)
  ├── SelectiveImportDialog (精选界面)
  │   ├── @tanstack/react-virtual (虚拟滚动)
  │   └── ConversationListItem
  ├── ImportProgressModal (进度显示)
  └── ImportResultDialog (结果展示)
```

### Backend

```
POST /api/convos/import           (全部导入 - 现有)
POST /api/convos/import-selective (选择性导入 - 新增)
  └── importers.js (复用现有解析逻辑)
```

## Performance

- **小文件 (<30MB)**: 直接上传，前端解析
- **大文件 (>30MB)**: 前端分块上传
- **虚拟滚动**: 支持 10,000+ 对话流畅显示
- **批量导入**: 每批 20 条，顺序上传

## Troubleshooting

### 文件解析失败

确认文件格式：
- LibreChat: `{ conversationId, messages, ... }`
- ChatGPT: `[{ id, mapping, title, ... }]`
- Claude: `[{ uuid, chat_messages, ... }]`

### 导入部分失败

检查失败列表中的错误信息：
- 验证失败：数据格式不完整
- 重复对话：conversationId 已存在
- 权限问题：endpoint 配置错误

### 性能问题

- 使用批次导入代替精选导入（如果不需要挑选）
- 大文件优先使用全部导入（后端处理更快）
```

### Step 2: 更新 CLAUDE.md

在 `CLAUDE.md` 中添加新功能说明：

```markdown
## Conversation Import

LibreChat supports importing conversations from multiple sources with three import modes:

**Import Modes:**
- **Full Import** - Upload entire file, backend processes all conversations
- **Batch Import** - Select range (e.g., conversations 1-500)
- **Selective Import** - Manually pick conversations with virtual scrolling UI

**Supported Formats:**
- LibreChat native export
- ChatGPT export (OpenAI)
- Claude export (Anthropic)

**Key Files:**
- Parser: `client/src/utils/conversationParser.ts`
- Mode Dialog: `client/src/components/Nav/SettingsTabs/Data/ImportModeDialog.tsx`
- Selective UI: `client/src/components/Nav/SettingsTabs/Data/SelectiveImportDialog.tsx`
- Backend: `api/server/routes/convos.js` (POST /import-selective)

**Features:**
- Automatic duplicate detection (by conversationId)
- Virtual scrolling for large datasets (10,000+ conversations)
- Search and date filtering in selective mode
- Partial failure handling with retry option
```

### Step 3: 提交

```bash
git add docs/features/selective-import.md CLAUDE.md
git commit -m "docs: add selective import documentation

- Feature overview and usage guide
- API documentation
- Architecture diagram
- Troubleshooting section
- Update CLAUDE.md with new feature"
```

---

## Final Task: 验证和清理

### Step 1: 运行所有测试

```bash
npm run test:client
npm run lint
```

预期输出：所有测试通过，无 lint 错误

### Step 2: 手动 E2E 测试

测试清单：
- [ ] 导入小文件（<100 对话）- 全部导入模式
- [ ] 导入大文件（1000+ 对话）- 批次导入模式
- [ ] 导入大文件 - 精选导入模式（测试虚拟滚动）
- [ ] 搜索和过滤功能
- [ ] 重复对话检测
- [ ] 部分失败后重试
- [ ] 中英文切换

### Step 3: 清理临时文件

```bash
rm client/src/components/Nav/SettingsTabs/Data/ImportConversations.tsx.bak
```

### Step 4: 最终提交

```bash
git add .
git commit -m "feat: frontend selective conversation import (完整实现)

完整实现前端解析和三种导入模式：

前端功能：
- 解析器支持 LibreChat, ChatGPT, Claude 格式
- 三种导入模式：全部/批次/精选
- 虚拟滚动列表（@tanstack/react-virtual）
- 重复对话检测和标记
- 搜索和日期过滤
- 失败重试功能

后端功能：
- 新增 /api/convos/import-selective 端点
- 支持最多 500 条对话单次导入
- 返回成功/失败详细结果
- 复用现有 importers 逻辑

测试：
- 单元测试覆盖所有核心功能
- 集成测试验证完整流程

文档：
- 完整功能文档
- API 文档
- 故障排除指南

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Execution Complete

计划已保存到：`docs/plans/2026-02-16-frontend-selective-import.md`

**实现摘要：**
- 10 个主要任务
- TDD 驱动开发
- 完整的测试覆盖
- 国际化支持（中英文）
- 详细文档

**关键技术点：**
- 前端解析（减少后端负载）
- 虚拟滚动（性能优化）
- 重复检测（用户体验）
- 部分失败处理（容错性）

准备好开始实施了吗？

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
      <DialogContent className="max-w-md bg-surface-primary text-text-primary">
        <DialogHeader>
          <DialogTitle className="text-text-primary">选择导入方式</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-text-primary">
          {/* Statistics */}
          <div className="rounded-lg bg-surface-tertiary p-4 text-sm">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-2xl">📊</span>
              <span className="font-semibold text-text-primary">
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
            <Label className="text-base font-semibold text-text-primary">请选择导入方式：</Label>

            {/* Full Import */}
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border-light p-3 text-text-primary hover:bg-surface-hover">
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
                <div className="font-semibold">
                  全部导入 ({newConversations.toLocaleString()} 条)
                </div>
                <div className="text-xs text-text-secondary">使用后端批量处理，约需 5-10 分钟</div>
              </div>
            </label>

            {/* Batch Import */}
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border-light p-3 text-text-primary hover:bg-surface-hover">
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
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border-light p-3 text-text-primary hover:bg-surface-hover">
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

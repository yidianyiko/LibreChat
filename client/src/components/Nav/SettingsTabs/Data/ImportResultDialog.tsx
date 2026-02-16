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

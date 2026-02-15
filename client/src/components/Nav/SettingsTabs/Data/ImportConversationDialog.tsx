import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, Lightbulb } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  Button,
} from '@librechat/client';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

interface ImportConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartImport: (file: File) => void;
  isUploading: boolean;
}

export default function ImportConversationDialog({
  open,
  onOpenChange,
  onStartImport,
  isUploading,
}: ImportConversationDialogProps) {
  const localize = useLocalize();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const resetSelection = useCallback(() => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleClose = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        resetSelection();
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, resetSelection],
  );

  const acceptFile = useCallback((file: File) => {
    const isJson =
      file.name.toLowerCase().endsWith('.json') || file.type === 'application/json';
    if (isJson) {
      setSelectedFile(file);
    }
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        acceptFile(file);
      }
      e.target.value = '';
    },
    [acceptFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) {
        acceptFile(file);
      }
    },
    [acceptFile],
  );

  const handleStartImport = useCallback(() => {
    if (selectedFile) {
      onStartImport(selectedFile);
      handleClose(false);
    }
  }, [selectedFile, onStartImport, handleClose]);

  const fileCount = selectedFile ? 1 : 0;
  const startLabel = `${localize('com_ui_import')} (${fileCount})`;
  const chatGptSteps = [
    localize('com_ui_import_conversation_dialog_step_1'),
    localize('com_ui_import_conversation_dialog_step_2'),
    localize('com_ui_import_conversation_dialog_step_3'),
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-md overflow-hidden p-0 shadow-2xl dark:bg-gray-800"
        showCloseButton={true}
      >
        <DialogHeader className="border-b border-black/10 px-6 pb-3 pt-6 dark:border-white/10">
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-gray-600 dark:text-gray-400" aria-hidden="true" />
            <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-50">
              {localize('com_ui_import_conversation_dialog_title')}
            </DialogTitle>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {localize('com_ui_import_conversation_dialog_subtitle')}
          </p>
        </DialogHeader>

        <div className="px-6 py-4">
          {/* Upload zone */}
          <div
            role="button"
            tabIndex={0}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed py-8 transition-colors',
              isDragging
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 bg-gray-50 hover:border-gray-400 dark:border-gray-600 dark:bg-gray-700/50 dark:hover:border-gray-500',
            )}
          >
            <FileText className="mb-2 h-12 w-12 text-blue-500 dark:text-blue-400" aria-hidden="true" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {localize('com_ui_import_conversation_dialog_upload_hint')}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {localize('com_ui_import_conversation_dialog_format_hint')}
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              {localize('com_ui_import_conversation_dialog_select_file')}
            </Button>
            {selectedFile && (
              <p className="mt-2 max-w-full truncate px-2 text-xs text-gray-600 dark:text-gray-300">
                {selectedFile.name}
              </p>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
            aria-hidden="true"
          />

          {/* How to export - ChatGPT steps */}
          <div className="mt-4 rounded-lg bg-blue-50 px-4 py-3 dark:bg-blue-900/20">
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {localize('com_ui_import_conversation_dialog_how_to_export')}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {localize('com_ui_import_conversation_dialog_export_subtitle')}
                </p>
                <div className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <p className="font-medium">ChatGPT</p>
                  <ol className="list-decimal space-y-1 pl-4">
                    {chatGptSteps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-black/10 px-6 py-4 dark:border-white/10">
          <DialogClose>{localize('com_ui_cancel')}</DialogClose>
          <Button
            onClick={handleStartImport}
            disabled={!selectedFile || isUploading}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 disabled:opacity-50"
          >
            {startLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import React, { useEffect, useState, useCallback } from 'react';
import { FileText } from 'lucide-react';
import { Dialog, DialogContent, Spinner } from '@librechat/client';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

interface ImportProgressModalProps {
  open: boolean;
  fileName: string;
  isComplete: boolean;
  isError: boolean;
  onClose: () => void;
  currentChunk?: number;
  totalChunks?: number;
}

export default function ImportProgressModal({
  open,
  fileName,
  isComplete,
  isError,
  onClose,
  currentChunk,
  totalChunks,
}: ImportProgressModalProps) {
  const localize = useLocalize();
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  // Progress messages to cycle through
  const progressMessages = [
    localize('com_ui_import_progress_reading'),
    localize('com_ui_import_progress_parsing'),
    localize('com_ui_import_progress_saving'),
  ];

  // Simulate progress
  useEffect(() => {
    if (!open || isComplete || isError) {
      return;
    }

    setProgress(0);
    setMessageIndex(0);

    // Gradually increase progress
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        // Slow down as we approach 90% (never reach 100% until actually complete)
        if (prev >= 90) {
          return prev + 0.1;
        }
        if (prev >= 70) {
          return prev + 0.5;
        }
        if (prev >= 50) {
          return prev + 1;
        }
        return prev + 2;
      });
    }, 200);

    // Cycle through messages
    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % progressMessages.length);
    }, 3000);

    return () => {
      clearInterval(progressInterval);
      clearInterval(messageInterval);
    };
  }, [open, isComplete, isError, progressMessages.length]);

  // Override simulated progress with chunk-based progress when chunked upload is active
  useEffect(() => {
    if (currentChunk != null && totalChunks != null && totalChunks > 0) {
      const chunkWeight = 100 / totalChunks;
      const completedChunksProgress = (currentChunk - 1) * chunkWeight;
      const intraChunkTarget = chunkWeight * 0.9;
      setProgress(completedChunksProgress + intraChunkTarget);
    }
  }, [currentChunk, totalChunks]);

  // Complete the progress when done
  useEffect(() => {
    if (isComplete && !isError) {
      setProgress(100);
      // Auto close after showing 100%
      const timer = setTimeout(onClose, 800);
      return () => clearTimeout(timer);
    }
  }, [isComplete, isError, onClose]);

  // Close on error after a short delay
  useEffect(() => {
    if (isError) {
      const timer = setTimeout(onClose, 500);
      return () => clearTimeout(timer);
    }
  }, [isError, onClose]);

  const displayProgress = Math.min(Math.round(progress), 100);

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          'w-11/12 max-w-md overflow-hidden p-6 shadow-2xl',
          'dark:bg-gray-800 dark:text-white',
        )}
        showCloseButton={false}
      >
        <div className="flex flex-col items-center space-y-4">
          {/* File icon and name */}
          <div className="flex items-center space-x-3 text-gray-600 dark:text-gray-300">
            <FileText className="h-6 w-6" />
            <span className="max-w-[200px] truncate text-sm font-medium">{fileName}</span>
          </div>

          {/* Chunk progress indicator */}
          {totalChunks != null && totalChunks > 1 && currentChunk != null && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {localize('com_ui_import_chunk_progress', {
                current: String(currentChunk),
                total: String(totalChunks),
              })}
            </span>
          )}

          {/* Progress bar */}
          <div className="w-full">
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                {progressMessages[messageIndex]}
              </span>
              <span className="font-medium text-blue-600 dark:text-blue-400">
                {displayProgress}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-300 ease-out"
                style={{ width: `${displayProgress}%` }}
              />
            </div>
          </div>

          {/* Status message */}
          <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
            <Spinner className="h-4 w-4" />
            <span>{localize('com_ui_import_progress_please_wait')}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

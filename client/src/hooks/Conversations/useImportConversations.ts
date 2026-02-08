import { useState, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { QueryKeys, TStartupConfig } from 'librechat-data-provider';
import { useToastContext } from '@librechat/client';
import { useUploadConversationsMutation } from '~/data-provider';
import { NotificationSeverity } from '~/common';
import { useLocalize } from '~/hooks';
import { logger } from '~/utils';

const CHUNK_THRESHOLD = 90 * 1024 * 1024; // 90MB

export function useImportConversations() {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const { showToast } = useToastContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [fileName, setFileName] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [isError, setIsError] = useState(false);
  const [currentChunk, setCurrentChunk] = useState<number | undefined>(undefined);
  const [totalChunks, setTotalChunks] = useState<number | undefined>(undefined);

  const resetProgressState = useCallback(() => {
    setShowProgressModal(false);
    setFileName('');
    setIsComplete(false);
    setIsError(false);
    setCurrentChunk(undefined);
    setTotalChunks(undefined);
  }, []);

  const handleSuccess = useCallback(
    (data?: { message?: string }) => {
      const serverMessage = data?.message?.trim();
      const isProcessing = serverMessage?.toLowerCase().includes('processing');

      setIsComplete(true);
      setIsUploading(false);

      showToast({
        message: isProcessing
          ? localize('com_ui_import_conversation_processing')
          : localize('com_ui_import_conversation_success'),
        status: isProcessing ? NotificationSeverity.INFO : NotificationSeverity.SUCCESS,
      });
    },
    [localize, showToast],
  );

  const handleError = useCallback(
    (error: unknown) => {
      logger.error('Import error:', error);
      setIsError(true);
      setIsUploading(false);

      const isUnsupportedType = error?.toString().includes('Unsupported import type');

      showToast({
        message: localize(
          isUnsupportedType
            ? 'com_ui_import_conversation_file_type_error'
            : 'com_ui_import_conversation_error',
        ),
        status: NotificationSeverity.ERROR,
      });
    },
    [localize, showToast],
  );

  const uploadFile = useUploadConversationsMutation({
    onSuccess: handleSuccess,
    onError: handleError,
    onMutate: () => setIsUploading(true),
  });

  const uploadSingleFile = useCallback(
    (blob: Blob, name: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', blob, encodeURIComponent(name));
        uploadFile.mutate(formData, {
          onSuccess: () => resolve(),
          onError: (err) => reject(err),
        });
      });
    },
    [uploadFile],
  );

  const handleFileUpload = useCallback(
    async (file: File) => {
      try {
        const startupConfig = queryClient.getQueryData<TStartupConfig>([QueryKeys.startupConfig]);
        const maxFileSize = startupConfig?.conversationImportMaxFileSize;
        if (maxFileSize && file.size > maxFileSize) {
          const size = (maxFileSize / (1024 * 1024)).toFixed(2);
          showToast({
            message: localize('com_error_files_upload_too_large', { 0: size }),
            status: NotificationSeverity.ERROR,
          });
          setIsUploading(false);
          resetProgressState();
          return;
        }

        // For files under the chunk threshold, use the existing simple upload
        if (file.size < CHUNK_THRESHOLD) {
          const formData = new FormData();
          formData.append('file', file, encodeURIComponent(file.name || 'File'));
          uploadFile.mutate(formData);
          return;
        }

        // Large file: read, parse, and potentially chunk
        const text = await file.text();
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          // Not valid JSON - let the server handle the error via normal upload
          const formData = new FormData();
          formData.append('file', file, encodeURIComponent(file.name || 'File'));
          uploadFile.mutate(formData);
          return;
        }

        if (!Array.isArray(parsed)) {
          // Not an array - upload as-is and let the server handle it
          const formData = new FormData();
          formData.append('file', file, encodeURIComponent(file.name || 'File'));
          uploadFile.mutate(formData);
          return;
        }

        // Dynamic import of the chunker utility
        const { splitJsonArrayIntoChunks } = await import('~/utils/importChunker');
        const chunks = splitJsonArrayIntoChunks(parsed, CHUNK_THRESHOLD);

        if (chunks.length <= 1) {
          // Only one chunk needed - upload normally
          const formData = new FormData();
          formData.append('file', file, encodeURIComponent(file.name || 'File'));
          uploadFile.mutate(formData);
          return;
        }

        // Multiple chunks: upload sequentially
        setTotalChunks(chunks.length);
        setIsUploading(true);

        for (let i = 0; i < chunks.length; i++) {
          setCurrentChunk(i + 1);
          const chunkJson = JSON.stringify(chunks[i]);
          const blob = new Blob([chunkJson], { type: 'application/json' });
          const chunkName = `${file.name || 'File'}_part${i + 1}of${chunks.length}.json`;

          await uploadSingleFile(blob, chunkName);
        }

        // All chunks uploaded successfully
        queryClient.invalidateQueries([QueryKeys.allConversations]);
        setIsComplete(true);
        setIsUploading(false);

        showToast({
          message: localize('com_ui_import_conversation_success'),
          status: NotificationSeverity.SUCCESS,
        });
      } catch (error) {
        logger.error('File processing error:', error);
        setIsUploading(false);
        setIsError(true);
        showToast({
          message: localize('com_ui_import_conversation_upload_error'),
          status: NotificationSeverity.ERROR,
        });
      }
    },
    [uploadFile, uploadSingleFile, showToast, localize, queryClient, resetProgressState],
  );

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        setIsUploading(true);
        setFileName(file.name);
        setShowProgressModal(true);
        setIsComplete(false);
        setIsError(false);
        handleFileUpload(file);
      }
      event.target.value = '';
    },
    [handleFileUpload],
  );

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return {
    fileInputRef,
    isUploading,
    handleFileChange,
    handleImportClick,
    // Modal state
    showProgressModal,
    fileName,
    isComplete,
    isError,
    resetProgressState,
    // Chunk state
    currentChunk,
    totalChunks,
  };
}

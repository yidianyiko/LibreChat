import { useState, useRef, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { QueryKeys, TStartupConfig } from 'librechat-data-provider';
import { useToastContext } from '@librechat/client';
import { useUploadConversationsMutation } from '~/data-provider';
import { NotificationSeverity } from '~/common';
import { useLocalize } from '~/hooks';
import { logger } from '~/utils';
import { DEFAULT_CHUNK_THRESHOLD } from '~/utils/importChunker';

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
  const [isPolling, setIsPolling] = useState(false);
  const [pollingAttempt, setPollingAttempt] = useState(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const resetProgressState = useCallback(() => {
    setShowProgressModal(false);
    setFileName('');
    setIsComplete(false);
    setIsError(false);
    setCurrentChunk(undefined);
    setTotalChunks(undefined);
    setIsPolling(false);
    setPollingAttempt(0);
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const startPollingForCompletion = useCallback(
    (maxAttempts = 24) => {
      // Clear any existing interval first to prevent orphaned intervals
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

      // Poll every 5 seconds for up to 2 minutes (24 attempts)
      let attempt = 0;
      setIsPolling(true);
      setPollingAttempt(0);

      pollingIntervalRef.current = setInterval(() => {
        attempt++;
        setPollingAttempt(attempt);

        // Invalidate queries to trigger refetch
        queryClient.invalidateQueries([QueryKeys.allConversations]);

        if (attempt >= maxAttempts) {
          // Stop polling after max attempts
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setIsPolling(false);
          showToast({
            message: localize('com_ui_import_conversation_timeout_warning'),
            status: NotificationSeverity.WARNING,
            duration: 8000,
          });
        }
      }, 5000);
    },
    [queryClient, showToast, localize],
  );

  const handleSuccess = useCallback(
    (data?: { message?: string }) => {
      const serverMessage = data?.message?.trim();
      const isProcessing = serverMessage?.toLowerCase().includes('processing');

      setIsComplete(true);
      setIsUploading(false);

      if (isProcessing) {
        // Backend returned 202 - processing in background
        showToast({
          message: localize('com_ui_import_conversation_background'),
          status: NotificationSeverity.INFO,
          duration: 6000,
        });
        // Start polling for completion
        startPollingForCompletion();
      } else {
        // Immediate success (201)
        showToast({
          message: localize('com_ui_import_conversation_success'),
          status: NotificationSeverity.SUCCESS,
        });
      }
    },
    [localize, showToast, startPollingForCompletion],
  );

  const handleError = useCallback(
    (error: unknown) => {
      logger.error('Import error:', error);
      setIsUploading(false);

      const errorString = error?.toString() ?? '';
      const isUnsupportedType = errorString.includes('Unsupported import type');

      // Check for network errors that might indicate Cloudflare/proxy timeout
      // These errors often occur when the upload succeeds but server processing takes too long
      const isNetworkError =
        errorString.includes('Network Error') ||
        errorString.includes('ERR_SSL') ||
        errorString.includes('timeout') ||
        errorString.includes('ECONNRESET') ||
        (error instanceof Error && error.message === 'Network Error');

      if (isNetworkError) {
        // Don't mark as error - the import may have succeeded in the background
        setIsError(false);
        showToast({
          message: localize('com_ui_import_conversation_network_error'),
          status: NotificationSeverity.WARNING,
          duration: 8000,
        });
        // Start polling to check if import succeeded
        startPollingForCompletion();
      } else {
        setIsError(true);
        showToast({
          message: localize(
            isUnsupportedType
              ? 'com_ui_import_conversation_file_type_error'
              : 'com_ui_import_conversation_error',
          ),
          status: NotificationSeverity.ERROR,
        });
      }
    },
    [localize, showToast, startPollingForCompletion],
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
        // For files under the chunk threshold, use the existing simple upload
        if (file.size < DEFAULT_CHUNK_THRESHOLD) {
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
        const chunks = splitJsonArrayIntoChunks(parsed, DEFAULT_CHUNK_THRESHOLD);

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

  /** Start import with a File (e.g. from custom dialog). Validates JSON and triggers upload. */
  const startImport = useCallback(
    (file: File) => {
      const isJson =
        file.name.toLowerCase().endsWith('.json') || file.type === 'application/json';
      if (!isJson) {
        showToast({
          message: localize('com_ui_import_conversation_file_type_error'),
          status: NotificationSeverity.ERROR,
        });
        return;
      }
      setFileName(file.name);
      setShowProgressModal(true);
      setIsUploading(true);
      setIsComplete(false);
      setIsError(false);
      handleFileUpload(file);
    },
    [handleFileUpload, localize, showToast],
  );

  useEffect(() => {
    return () => {
      // Cleanup polling on unmount
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  return {
    fileInputRef,
    isUploading,
    handleFileChange,
    handleImportClick,
    startImport,
    // Modal state
    showProgressModal,
    fileName,
    isComplete,
    isError,
    resetProgressState,
    // Chunk state
    currentChunk,
    totalChunks,
    // Polling state
    isPolling,
    pollingAttempt,
  };
}

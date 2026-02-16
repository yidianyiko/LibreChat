import { useState, useRef, useCallback } from 'react';
import { Import } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { QueryKeys } from 'librechat-data-provider';
import { Spinner, useToastContext, Label, Button } from '@librechat/client';
import { useUploadConversationsMutation } from '~/data-provider';
import { useImportSelectiveConversationsMutation } from '~/data-provider/mutations';
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

  const selectiveMutation = useImportSelectiveConversationsMutation({
    onSuccess: (data) => {
      setIsComplete(true);
      setIsUploading(false);

      if (data.failed.length > 0) {
        showToast({
          message: data.message,
          status: NotificationSeverity.WARNING,
        });
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

      const conversationData = selected.map((c) => c.rawData);
      selectiveMutation.mutate({ conversations: conversationData });
    },
    [selectiveMutation, showToast],
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

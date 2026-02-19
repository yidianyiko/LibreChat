import { useMemo } from 'react';
import { OGDialog, DialogTemplate } from '@librechat/client';
import MarkdownLite from '~/components/Chat/Messages/Content/MarkdownLite';
import { useLocalize } from '~/hooks';

type TermsViewModalProps = {
  open: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

const TermsViewModal = ({ open, onOpenChange }: TermsViewModalProps) => {
  const localize = useLocalize();

  const title = useMemo(() => {
    const localizedTitle = localize('com_ui_terms_modal_title');
    // Only use localized title if it's not the key itself
    if (localizedTitle && localizedTitle !== 'com_ui_terms_modal_title') {
      return localizedTitle;
    }
    return localize('com_ui_terms_and_conditions');
  }, [localize]);

  const content = useMemo(() => {
    const localizedContent = localize('com_ui_terms_modal_content');
    // Only use localized content if it's not the key itself
    if (localizedContent && localizedContent !== 'com_ui_terms_modal_content') {
      return localizedContent;
    }
    return '';
  }, [localize]);

  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      <DialogTemplate
        title={title}
        className="w-11/12 max-w-3xl sm:w-3/4 md:w-1/2 lg:w-2/5"
        showCloseButton={true}
        showCancelButton={false}
        main={
          <section
            tabIndex={0}
            className="max-h-[60vh] overflow-y-auto p-4"
            aria-label={localize('com_ui_terms_and_conditions')}
          >
            <div className="prose dark:prose-invert w-full max-w-none !text-text-primary">
              {content !== '' ? (
                <MarkdownLite content={content} />
              ) : (
                <p>{localize('com_ui_no_terms_content')}</p>
              )}
            </div>
          </section>
        }
        buttons={
          <button
            onClick={() => onOpenChange(false)}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-border-heavy bg-surface-secondary px-4 py-2 text-sm text-text-primary hover:bg-green-500 hover:text-white focus:bg-green-500 focus:text-white dark:hover:bg-green-600 dark:focus:bg-green-600"
          >
            {localize('com_ui_close')}
          </button>
        }
      />
    </OGDialog>
  );
};

export default TermsViewModal;

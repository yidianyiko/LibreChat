import { memo, useRef, useState } from 'react';
import * as Select from '@ariakit/react/select';
import { BarChart3, FileText, Import, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar, DropdownMenuSeparator, GearIcon, LinkIcon } from '@librechat/client';
import { useGetStartupConfig, useGetUserBalance, SystemRoles } from '~/data-provider';
import { MyFilesModal } from '~/components/Chat/Input/Files/MyFilesModal';
import { useLocalize } from '~/hooks';
import { useAuthContext } from '~/hooks/AuthContext';
import ImportConversationDialog from './SettingsTabs/Data/ImportConversationDialog';
import ImportConversations from './SettingsTabs/Data/ImportConversations';
import Settings from './Settings';
import WeChatQuickAction from './WeChat/WeChatQuickAction';

function AccountSettings() {
  const localize = useLocalize();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuthContext();
  const { data: startupConfig } = useGetStartupConfig();
  const balanceQuery = useGetUserBalance({
    enabled: !!isAuthenticated && startupConfig?.balance?.enabled,
  });
  const [showFiles, setShowFiles] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [isImportUploading, setIsImportUploading] = useState(false);
  const accountSettingsButtonRef = useRef<HTMLButtonElement>(null);
  const tokenCredits = balanceQuery.data?.tokenCredits ?? 0;
  const approxUsd = tokenCredits / 1000000;

  return (
    <div className="mt-1 flex flex-col gap-1">
      <ImportConversations
        importFile={pendingImportFile}
        onImportFileHandled={() => setPendingImportFile(null)}
        onUploadingChange={setIsImportUploading}
        renderTrigger={({ isUploading, importingLabel }) => (
          <button
            type="button"
            onClick={() => setShowImportDialog(true)}
            disabled={isUploading}
            aria-label={localize('com_ui_import_conversation_info')}
            className="account-settings-migrate flex w-full items-center gap-2 rounded-xl p-2 text-sm text-text-primary transition-all duration-200 ease-in-out hover:bg-surface-active-alt disabled:opacity-50"
          >
            <Import className="icon-md flex-shrink-0" aria-hidden="true" />
            <span className="truncate text-left">
              {isUploading ? importingLabel : localize('com_ui_import_conversation_info')}
            </span>
          </button>
        )}
      />
      <ImportConversationDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onStartImport={(file) => setPendingImportFile(file)}
        isUploading={isImportUploading}
      />
      <div className="account-settings-wechat-quick-action [&>button]:!h-auto [&>button]:!w-full [&>button]:!justify-start [&>button]:!gap-2 [&>button]:!rounded-xl [&>button]:!bg-transparent [&>button]:!p-2 [&>button]:!text-sm [&>button]:!font-normal [&>button]:!text-text-primary [&>button]:!shadow-none [&>button]:transition-all [&>button]:duration-200 [&>button]:ease-in-out [&>button]:hover:!bg-surface-active-alt">
        <WeChatQuickAction />
      </div>
      {user?.role === SystemRoles.ADMIN && (
        <button
          type="button"
          onClick={() => navigate('/d/stats')}
          aria-label="Admin Statistics"
          className="account-settings-stats flex w-full items-center gap-2 rounded-xl p-2 text-sm text-text-primary transition-all duration-200 ease-in-out hover:bg-surface-active-alt"
        >
          <BarChart3 className="icon-md flex-shrink-0" aria-hidden="true" />
          <span className="truncate">{localize('com_nav_statistics')}</span>
        </button>
      )}
      <Select.SelectProvider>
        <Select.Select
          ref={accountSettingsButtonRef}
          aria-label={localize('com_nav_account_settings')}
          data-testid="nav-user"
          className="account-settings-trigger mt-text-sm flex h-auto w-full items-center gap-2 rounded-xl p-2 text-sm transition-all duration-200 ease-in-out hover:bg-surface-active-alt aria-[expanded=true]:bg-surface-active-alt"
        >
          <div className="-ml-0.9 -mt-0.8 h-8 w-8 flex-shrink-0">
            <div className="relative flex">
              <Avatar user={user} size={32} />
            </div>
          </div>
          <div
            className="mt-2 grow overflow-hidden text-ellipsis whitespace-nowrap text-left text-text-primary"
            style={{ marginTop: '0', marginLeft: '0' }}
          >
            {user?.name ?? user?.username ?? localize('com_nav_user')}
          </div>
        </Select.Select>
        <Select.SelectPopover
          className="account-settings-popover popover-ui z-[125] w-[305px] rounded-lg md:w-[244px]"
          style={{
            transformOrigin: 'bottom',
            translate: '0 -4px',
          }}
        >
          <div
            className="bg-surface-secondary/50 dark:bg-surface-secondary/30 rounded-lg border border-border-medium px-3 py-3"
            role="group"
            aria-label="Account info"
          >
            <div className="text-token-text-secondary text-sm" role="note">
              {user?.email ?? localize('com_nav_user')}
            </div>
            {startupConfig?.balance?.enabled === true && balanceQuery.data != null && (
              <div
                className="text-token-text-secondary mt-1.5 flex items-center justify-between gap-2 text-sm"
                role="note"
              >
                <span>
                  {localize('com_nav_balance')}:{' '}
                  {new Intl.NumberFormat().format(Math.round(tokenCredits))}
                </span>
                <span className="text-xs">
                  {localize('com_nav_balance_approx_usd', { 0: approxUsd.toFixed(2) })}
                </span>
              </div>
            )}
            <div className="mt-3 flex items-center justify-center">
              <button
                type="button"
                onClick={() => navigate('/recharge')}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
                title={localize('com_nav_add_credits')}
              >
                {localize('com_nav_add_credits_cta')}
              </button>
            </div>
          </div>

          <div className="account-settings-actions mt-2 flex flex-col gap-1">
            <Select.SelectItem
              value="my-files"
              onClick={() => setShowFiles(true)}
              className="select-item account-settings-item text-sm"
            >
              <FileText className="icon-md flex-shrink-0" aria-hidden="true" />
              {localize('com_nav_my_files')}
            </Select.SelectItem>
            {startupConfig?.helpAndFaqURL !== '/' && (
              <Select.SelectItem
                value="help-faq"
                onClick={() => window.open(startupConfig?.helpAndFaqURL, '_blank')}
                className="select-item account-settings-item text-sm"
              >
                <LinkIcon className="icon-md flex-shrink-0" aria-hidden="true" />
                {localize('com_nav_help_faq')}
              </Select.SelectItem>
            )}
            <DropdownMenuSeparator />
            <Select.SelectItem
              value="settings"
              onClick={() => setShowSettings(true)}
              className="select-item account-settings-item text-sm"
            >
              <GearIcon className="icon-md flex-shrink-0" aria-hidden="true" />
              {localize('com_nav_settings')}
            </Select.SelectItem>
            <Select.SelectItem
              aria-selected={true}
              onClick={() => logout()}
              value="logout"
              className="select-item account-settings-item text-sm"
            >
              <LogOut className="icon-md flex-shrink-0" aria-hidden="true" />
              {localize('com_nav_log_out')}
            </Select.SelectItem>
          </div>
        </Select.SelectPopover>
        {showFiles && (
          <MyFilesModal
            open={showFiles}
            onOpenChange={setShowFiles}
            triggerRef={accountSettingsButtonRef}
          />
        )}
        {showSettings && <Settings open={showSettings} onOpenChange={setShowSettings} />}
      </Select.SelectProvider>
    </div>
  );
}

export default memo(AccountSettings);

import { useState, memo, useRef } from 'react';
import * as Select from '@ariakit/react/select';
import { useNavigate } from 'react-router-dom';
import { LogOut, Import, BarChart3 } from 'lucide-react';
import { GearIcon, Avatar } from '@librechat/client';
import { useGetStartupConfig, useGetUserBalance, SystemRoles } from '~/data-provider';
import ImportConversations from './SettingsTabs/Data/ImportConversations';
import ImportConversationDialog from './SettingsTabs/Data/ImportConversationDialog';
import { useAuthContext } from '~/hooks/AuthContext';
import { useLocalize } from '~/hooks';
import Settings from './Settings';

function AccountSettings() {
  const localize = useLocalize();
  const { user, isAuthenticated, logout } = useAuthContext();
  const navigate = useNavigate();
  const { data: startupConfig } = useGetStartupConfig();
  const balanceQuery = useGetUserBalance({
    enabled: !!isAuthenticated && startupConfig?.balance?.enabled,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [isImportUploading, setIsImportUploading] = useState(false);
  const accountSettingsButtonRef = useRef<HTMLButtonElement>(null);
  const tokenCredits = balanceQuery.data?.tokenCredits ?? 0;
  const approxUsd = tokenCredits / 1000000;

  return (
    <div className="mt-1 flex flex-col gap-1">
      {/* Migrate History: above user avatar in sidebar — opens import dialog */}
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
      {/* Admin Stats Link - only visible to admins */}
      {user?.role === SystemRoles.ADMIN && (
        <button
          type="button"
          onClick={() => navigate('/d/stats')}
          aria-label="Admin Statistics"
          className="account-settings-stats flex w-full items-center gap-2 rounded-xl p-2 text-sm text-text-primary transition-all duration-200 ease-in-out hover:bg-surface-active-alt"
        >
          <BarChart3 className="icon-md flex-shrink-0" aria-hidden="true" />
          <span className="truncate">Statistics</span>
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
        {/* User info block: email, balance, Add Credits — unified visual block */}
        <div
          className="rounded-lg border border-border-medium bg-surface-secondary/50 px-3 py-3 dark:bg-surface-secondary/30"
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
                {localize('com_nav_balance')}: {new Intl.NumberFormat().format(Math.round(tokenCredits))}
              </span>
              <span className="text-xs">≈ ${approxUsd.toFixed(2)}</span>
            </div>
          )}
          <div className="mt-3 flex items-center justify-center">
            <button
              type="button"
              onClick={() => navigate('/recharge')}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
              title="Add Credits"
            >
              + Add Credits
            </button>
          </div>
        </div>

        {/* Action list: Settings, Log out (Migrate History is in sidebar above avatar) */}
        <div className="account-settings-actions mt-2 flex flex-col gap-1">
          <Select.SelectItem
            value=""
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
        {showSettings && <Settings open={showSettings} onOpenChange={setShowSettings} />}
      </Select.SelectProvider>
    </div>
  );
}

export default memo(AccountSettings);

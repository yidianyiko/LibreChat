import React from 'react';
import { SystemRoles } from 'librechat-data-provider';
import { useGetStartupConfig } from '~/data-provider';
import DisplayUsernameMessages from './DisplayUsernameMessages';
import DeleteAccount from './DeleteAccount';
import Avatar from './Avatar';
import EnableTwoFactorItem from './TwoFactorAuthentication';
import BackupCodesItem from './BackupCodesItem';
import WeChatBinding from './WeChatBinding';
import { useAuthContext } from '~/hooks';

function Account() {
  const { user } = useAuthContext();
  const { data: startupConfig } = useGetStartupConfig();
  const showDeleteAccount =
    startupConfig?.allowAccountDeletion !== false || user?.role === SystemRoles.ADMIN;

  return (
    <div className="flex flex-col gap-3 p-1 text-sm text-text-primary">
      <div className="pb-3">
        <DisplayUsernameMessages />
      </div>
      <div className="pb-3">
        <Avatar />
      </div>
      <div className="pb-3">
        <WeChatBinding />
      </div>
      {user?.provider === 'local' && (
        <>
          <div className="pb-3">
            <EnableTwoFactorItem />
          </div>
          {user?.twoFactorEnabled && (
            <div className="pb-3">
              <BackupCodesItem />
            </div>
          )}
        </>
      )}
      {showDeleteAccount && (
        <div className="pb-3">
          <DeleteAccount />
        </div>
      )}
    </div>
  );
}

export default React.memo(Account);

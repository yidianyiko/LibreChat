import React from 'react';
import { Label, InfoHoverCard, ESide } from '@librechat/client';
import { useLocalize } from '~/hooks';

interface TokenCreditsItemProps {
  tokenCredits?: number;
}

const TokenCreditsItem: React.FC<TokenCreditsItemProps> = ({ tokenCredits }) => {
  const localize = useLocalize();
  const credits = tokenCredits ?? 0;
  const approxUsd = credits / 1000000;

  return (
    <div className="flex items-center justify-between">
      {/* Left Section: Label */}
      <div className="flex items-center space-x-2">
        <Label className="font-light">{localize('com_nav_balance')}</Label>
        <InfoHoverCard side={ESide.Bottom} text={localize('com_nav_info_balance')} />
      </div>

      {/* Right Section: tokenCredits Value */}
      <div className="text-right" role="note">
        <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{credits.toFixed(2)}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">≈ ${approxUsd.toFixed(2)}</div>
      </div>
    </div>
  );
};

export default TokenCreditsItem;

import React, { act } from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import PWAUpdatePrompt from '../PWAUpdatePrompt';
import { PWA_UPDATE_AVAILABLE_EVENT, applyPWAUpdate } from '~/utils/pwaUpdate';

jest.mock('~/hooks/useLocalize', () => ({
  __esModule: true,
  default: () => (key: string) =>
    (
      ({
        com_ui_update_available_title: 'A new version is available.',
        com_ui_update_available_description: 'Refresh to load the latest version of the app.',
        com_ui_refresh_page: 'Refresh page',
        com_ui_cancel: 'Cancel',
      }) as Record<string, string>
    )[key] ?? key,
}));

jest.mock('~/utils/pwaUpdate', () => ({
  PWA_UPDATE_AVAILABLE_EVENT: 'librechat:pwa-update-available',
  applyPWAUpdate: jest.fn().mockResolvedValue(undefined),
}));

describe('PWAUpdatePrompt', () => {
  it('stays hidden until an update is announced', () => {
    render(<PWAUpdatePrompt />);

    expect(screen.queryByText('A new version is available.')).not.toBeInTheDocument();
  });

  it('shows a refresh prompt when an update event is dispatched', async () => {
    render(<PWAUpdatePrompt />);

    await act(async () => {
      window.dispatchEvent(new Event(PWA_UPDATE_AVAILABLE_EVENT));
    });

    expect(await screen.findByText('A new version is available.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh page' })).toBeInTheDocument();
  });

  it('applies the update only after the user clicks refresh', async () => {
    const user = userEvent.setup();
    render(<PWAUpdatePrompt />);

    await act(async () => {
      window.dispatchEvent(new Event(PWA_UPDATE_AVAILABLE_EVENT));
    });

    expect(await screen.findByText('A new version is available.')).toBeInTheDocument();
    expect(applyPWAUpdate).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Refresh page' }));

    expect(applyPWAUpdate).toHaveBeenCalledTimes(1);
  });

  it('lets the user dismiss the prompt for later', async () => {
    const user = userEvent.setup();
    render(<PWAUpdatePrompt />);

    await act(async () => {
      window.dispatchEvent(new Event(PWA_UPDATE_AVAILABLE_EVENT));
    });

    expect(await screen.findByText('A new version is available.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('A new version is available.')).not.toBeInTheDocument();
  });
});

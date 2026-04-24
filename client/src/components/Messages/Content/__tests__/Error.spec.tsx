import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Error from '../Error';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock(
  '@librechat/client',
  () => ({
    Button: ({ children, ...props }: React.ComponentProps<'button'>) => (
      <button type="button" {...props}>
        {children}
      </button>
    ),
    Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
      open ? <div data-testid="token-balance-dialog">{children}</div> : null,
    DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
    DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogClose: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  }),
  { virtual: true },
);

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => {
    if (key === 'com_error_token_balance_title') {
      return 'Token credits are low';
    }
    if (key === 'com_error_token_balance_description') {
      return 'Your message could not be sent because this account does not have enough token credits.';
    }
    if (key === 'com_error_token_balance_action') {
      return 'Add Credits';
    }
    if (key === 'com_ui_cancel') {
      return 'Cancel';
    }
    return key;
  },
}));

const tokenBalanceError = JSON.stringify({
  type: 'token_balance',
  balance: 0,
  tokenCost: 100,
  promptTokens: 100,
  prev_count: 0,
  violation_count: 0,
  date: '2026-04-24T00:00:00.000Z',
});

describe('Message content Error', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it('shows an inline recharge action for token balance errors', () => {
    render(<Error text={tokenBalanceError} />);

    expect(screen.getByText(/Insufficient Funds!/)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Add Credits' })[0]);

    expect(mockNavigate).toHaveBeenCalledWith('/recharge');
  });

  it('opens a recharge dialog for token balance errors', () => {
    render(<Error text={tokenBalanceError} />);

    expect(screen.getByTestId('token-balance-dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Token credits are low' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Your message could not be sent because this account does not have enough token credits.',
      ),
    ).toBeInTheDocument();
  });
});

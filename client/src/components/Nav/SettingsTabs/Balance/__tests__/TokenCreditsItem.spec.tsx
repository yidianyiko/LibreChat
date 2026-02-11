import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TokenCreditsItem from '../TokenCreditsItem';

jest.mock('@librechat/client', () => ({
  Label: ({ children }) => <span>{children}</span>,
  InfoHoverCard: () => null,
  ESide: { Bottom: 'bottom' },
}));

jest.mock('~/hooks', () => ({
  useLocalize: jest.fn(),
}));

const mockUseLocalize = jest.requireMock('~/hooks').useLocalize;

describe('TokenCreditsItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLocalize.mockReturnValue((key: string) => {
      if (key === 'com_nav_balance') {
        return 'Token Credits';
      }
      return key;
    });
  });

  it('renders token credits label and approximate USD hint', () => {
    render(<TokenCreditsItem tokenCredits={1250000} />);

    expect(screen.getByText('Token Credits')).toBeInTheDocument();
    expect(screen.getByText('1250000.00')).toBeInTheDocument();
    expect(screen.getByText('≈ $1.25')).toBeInTheDocument();
  });
});

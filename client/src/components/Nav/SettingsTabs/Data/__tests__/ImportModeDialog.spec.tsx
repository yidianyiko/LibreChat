// client/src/components/Nav/SettingsTabs/Data/__tests__/ImportModeDialog.spec.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ImportModeDialog from '../ImportModeDialog';

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

describe('ImportModeDialog', () => {
  const mockOnClose = jest.fn();
  const mockOnSelectMode = jest.fn();

  const defaultProps = {
    open: true,
    totalConversations: 3000,
    duplicateCount: 150,
    onClose: mockOnClose,
    onSelectMode: mockOnSelectMode,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render conversation statistics', () => {
    render(<ImportModeDialog {...defaultProps} />);

    expect(screen.getByText(/3,000/)).toBeInTheDocument();
    expect(screen.getByText(/150.*已存在/)).toBeInTheDocument();
    expect(screen.getByText(/可导入：2,850/)).toBeInTheDocument();
  });

  it('should use themed text colors instead of browser default black text', () => {
    render(<ImportModeDialog {...defaultProps} />);
    const dialog = screen.getByRole('dialog');
    const content = dialog.querySelector('.space-y-4');

    expect(content).toHaveClass('text-text-primary');
  });

  it('should show all three import modes', () => {
    render(<ImportModeDialog {...defaultProps} />);

    expect(screen.getByLabelText(/全部导入/)).toBeInTheDocument();
    expect(screen.getByLabelText(/批次导入/)).toBeInTheDocument();
    expect(screen.getByLabelText(/精选导入/)).toBeInTheDocument();
  });

  it('should handle full import selection', () => {
    render(<ImportModeDialog {...defaultProps} />);

    const fullImportRadio = screen.getByLabelText(/全部导入/);
    fireEvent.click(fullImportRadio);

    const nextButton = screen.getByRole('button', { name: /下一步/ });
    fireEvent.click(nextButton);

    expect(mockOnSelectMode).toHaveBeenCalledWith({ mode: 'full' });
  });

  it('should validate batch range inputs', () => {
    render(<ImportModeDialog {...defaultProps} />);

    const batchRadio = screen.getByLabelText(/批次导入/);
    fireEvent.click(batchRadio);

    const startInput = screen.getByLabelText(/从第几条/);
    const endInput = screen.getByLabelText(/到第几条/);

    fireEvent.change(startInput, { target: { value: '1' } });
    fireEvent.change(endInput, { target: { value: '600' } });

    const nextButton = screen.getByRole('button', { name: /下一步/ });
    fireEvent.click(nextButton);

    // Should show error for exceeding 500 limit
    expect(screen.getByText(/单次最多选择 500 条对话/)).toBeInTheDocument();
    expect(mockOnSelectMode).not.toHaveBeenCalled();
  });

  it('should allow valid batch range', () => {
    render(<ImportModeDialog {...defaultProps} />);

    const batchRadio = screen.getByLabelText(/批次导入/);
    fireEvent.click(batchRadio);

    const startInput = screen.getByLabelText(/从第几条/);
    const endInput = screen.getByLabelText(/到第几条/);

    fireEvent.change(startInput, { target: { value: '1' } });
    fireEvent.change(endInput, { target: { value: '500' } });

    const nextButton = screen.getByRole('button', { name: /下一步/ });
    fireEvent.click(nextButton);

    expect(mockOnSelectMode).toHaveBeenCalledWith({
      mode: 'batch',
      start: 1,
      end: 500,
    });
  });

  it('should handle selective import selection', () => {
    render(<ImportModeDialog {...defaultProps} />);

    const selectiveRadio = screen.getByLabelText(/精选导入/);
    fireEvent.click(selectiveRadio);

    const nextButton = screen.getByRole('button', { name: /下一步/ });
    fireEvent.click(nextButton);

    expect(mockOnSelectMode).toHaveBeenCalledWith({ mode: 'selective' });
  });
});

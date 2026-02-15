import React from 'react';
import { render, screen } from '@testing-library/react';
import ImportConversationDialog from '../ImportConversationDialog';

jest.mock('@librechat/client', () => ({
  ...jest.requireActual('@librechat/client'),
  Dialog: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogClose: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) =>
    (
      {
        com_ui_import_conversation_dialog_title: '迁移历史记录',
        com_ui_import_conversation_dialog_subtitle: '从 JSON 文件导入聊天记录。',
        com_ui_import_conversation_dialog_upload_hint: '点击或拖拽文件到此处',
        com_ui_import_conversation_dialog_format_hint: '仅支持 JSON 格式',
        com_ui_import_conversation_dialog_select_file: '选择文件',
        com_ui_import_conversation_dialog_how_to_export: '如何导出聊天记录？',
        com_ui_import_conversation_dialog_export_subtitle: '查看你所用平台的导出步骤。',
        com_ui_import_conversation_dialog_step_1:
          '步骤 1：前往 设置 → 数据控制 → 导出数据。',
        com_ui_import_conversation_dialog_step_2: '步骤 2：下载后，解压 ZIP 文件。',
        com_ui_import_conversation_dialog_step_3: '步骤 3：提取 conversations.json 文件。',
      } as Record<string, string>
    )[key] ?? key,
}));

describe('ImportConversationDialog', () => {
  it('renders localized copy in dialog content', () => {
    render(
      <ImportConversationDialog
        open={true}
        onOpenChange={jest.fn()}
        onStartImport={jest.fn()}
        isUploading={false}
      />,
    );

    expect(screen.getByText('迁移历史记录')).toBeInTheDocument();
    expect(screen.getByText('从 JSON 文件导入聊天记录。')).toBeInTheDocument();
    expect(screen.getByText('点击或拖拽文件到此处')).toBeInTheDocument();
    expect(screen.getByText('仅支持 JSON 格式')).toBeInTheDocument();
    expect(screen.getByText('选择文件')).toBeInTheDocument();
    expect(screen.getByText('如何导出聊天记录？')).toBeInTheDocument();
    expect(screen.getByText('查看你所用平台的导出步骤。')).toBeInTheDocument();
    expect(screen.getByText('步骤 1：前往 设置 → 数据控制 → 导出数据。')).toBeInTheDocument();
    expect(screen.getByText('步骤 2：下载后，解压 ZIP 文件。')).toBeInTheDocument();
    expect(screen.getByText('步骤 3：提取 conversations.json 文件。')).toBeInTheDocument();
  });
});

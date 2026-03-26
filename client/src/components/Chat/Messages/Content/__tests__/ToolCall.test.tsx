import React from 'react';
import { RecoilRoot } from 'recoil';
import { Tools, Constants } from 'librechat-data-provider';
import { fireEvent, render, screen } from '@testing-library/react';
import ToolCall from '../ToolCall';

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string, values?: Record<number, string>) => {
    const translations: Record<string, string> = {
      com_assistants_function_use: `Used ${values?.[0]}`,
      com_assistants_completed_function: `Completed ${values?.[0]}`,
      com_assistants_completed_action: `Completed action on ${values?.[0]}`,
      com_assistants_running_var: `Running ${values?.[0]}`,
      com_assistants_running_action: 'Running action',
      com_ui_sign_in_to_domain: `Sign in to ${values?.[0]}`,
      com_ui_cancelled: 'Cancelled',
      com_ui_requires_auth: 'Requires authentication',
      com_assistants_allow_sites_you_trust: 'Only allow sites you trust',
    };

    return translations[key] || key;
  },
  useProgress: (initialProgress: number) => (initialProgress >= 1 ? 1 : initialProgress),
}));

jest.mock('~/components/Chat/Messages/Content/MessageContent', () => ({
  __esModule: true,
  default: ({ content }: { content: string }) => <div data-testid="message-content">{content}</div>,
}));

jest.mock('../ToolCallInfo', () => ({
  __esModule: true,
  default: ({ attachments, ...props }: any) => (
    <div data-testid="tool-call-info" data-attachments={JSON.stringify(attachments)}>
      {JSON.stringify(props)}
    </div>
  ),
}));

jest.mock('../ProgressText', () => ({
  __esModule: true,
  default: ({
    onClick,
    inProgressText,
    finishedText,
    subtitle,
  }: {
    onClick?: () => void;
    inProgressText?: string;
    finishedText?: string;
    subtitle?: string;
  }) => (
    <div data-testid="progress-text" onClick={onClick}>
      {finishedText || inProgressText}
      {subtitle && <span data-testid="subtitle">{subtitle}</span>}
    </div>
  ),
}));

jest.mock('../Parts', () => ({
  AttachmentGroup: ({ attachments }: any) => (
    <div data-testid="attachment-group">{JSON.stringify(attachments)}</div>
  ),
}));

jest.mock('@librechat/client', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

jest.mock('lucide-react', () => ({
  ChevronDown: () => <span>{'ChevronDown'}</span>,
  ChevronUp: () => <span>{'ChevronUp'}</span>,
  TriangleAlert: () => <span>{'TriangleAlert'}</span>,
}));

jest.mock('~/utils', () => ({
  logger: {
    error: jest.fn(),
  },
  cn: (...classes: string[]) => classes.filter(Boolean).join(' '),
}));

describe('ToolCall', () => {
  const mockProps = {
    args: '{"test": "input"}',
    name: 'testFunction',
    output: 'Test output',
    initialProgress: 1,
    isSubmitting: false,
  };

  const renderWithRecoil = (component: React.ReactElement) =>
    render(<RecoilRoot>{component}</RecoilRoot>);

  const openToolCallInfo = () => fireEvent.click(screen.getByTestId('progress-text'));

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('attachments prop passing', () => {
    it('should pass attachments to ToolCallInfo when provided', () => {
      const attachments = [
        {
          type: Tools.ui_resources,
          messageId: 'msg123',
          toolCallId: 'tool456',
          conversationId: 'conv789',
          [Tools.ui_resources]: {
            '0': { type: 'button', label: 'Click me' },
          },
        },
      ];

      renderWithRecoil(<ToolCall {...mockProps} attachments={attachments as any} />);

      openToolCallInfo();

      const toolCallInfo = screen.getByTestId('tool-call-info');
      expect(toolCallInfo).toBeInTheDocument();
      expect(toolCallInfo.getAttribute('data-attachments')).toBe(JSON.stringify(attachments));
    });

    it('should pass empty array when no attachments', () => {
      renderWithRecoil(<ToolCall {...mockProps} />);

      openToolCallInfo();

      const toolCallInfo = screen.getByTestId('tool-call-info');
      expect(toolCallInfo.getAttribute('data-attachments')).toBeNull();
    });

    it('should pass multiple attachments of different types', () => {
      const attachments = [
        {
          type: Tools.ui_resources,
          messageId: 'msg1',
          toolCallId: 'tool1',
          conversationId: 'conv1',
          [Tools.ui_resources]: {
            '0': { type: 'form', fields: [] },
          },
        },
        {
          type: Tools.web_search,
          messageId: 'msg2',
          toolCallId: 'tool2',
          conversationId: 'conv2',
          [Tools.web_search]: {
            results: ['result1', 'result2'],
          },
        },
      ];

      renderWithRecoil(<ToolCall {...mockProps} attachments={attachments as any} />);

      openToolCallInfo();

      const toolCallInfo = screen.getByTestId('tool-call-info');
      const attachmentsData = toolCallInfo.getAttribute('data-attachments');
      expect(JSON.parse(attachmentsData!)).toEqual(attachments);
    });
  });

  describe('attachment group rendering', () => {
    it('should render AttachmentGroup when attachments are provided', () => {
      const attachments = [
        {
          type: Tools.ui_resources,
          messageId: 'msg123',
          toolCallId: 'tool456',
          conversationId: 'conv789',
          [Tools.ui_resources]: {
            '0': { type: 'chart', data: [] },
          },
        },
      ];

      renderWithRecoil(<ToolCall {...mockProps} attachments={attachments as any} />);

      const attachmentGroup = screen.getByTestId('attachment-group');
      expect(attachmentGroup).toBeInTheDocument();
      expect(attachmentGroup.textContent).toBe(JSON.stringify(attachments));
    });

    it('should not render AttachmentGroup when no attachments', () => {
      renderWithRecoil(<ToolCall {...mockProps} />);

      expect(screen.queryByTestId('attachment-group')).not.toBeInTheDocument();
    });

    it('should not render AttachmentGroup when attachments is empty array', () => {
      renderWithRecoil(<ToolCall {...mockProps} attachments={[]} />);

      expect(screen.queryByTestId('attachment-group')).not.toBeInTheDocument();
    });
  });

  describe('tool call info visibility', () => {
    it('should toggle tool call info when clicking header', () => {
      renderWithRecoil(<ToolCall {...mockProps} />);

      expect(screen.queryByTestId('tool-call-info')).not.toBeInTheDocument();

      openToolCallInfo();
      expect(screen.getByTestId('tool-call-info')).toBeInTheDocument();

      openToolCallInfo();
      expect(screen.queryByTestId('tool-call-info')).not.toBeInTheDocument();
    });

    it('should pass all required props to ToolCallInfo', () => {
      const attachments = [
        {
          type: Tools.ui_resources,
          messageId: 'msg123',
          toolCallId: 'tool456',
          conversationId: 'conv789',
          [Tools.ui_resources]: {
            '0': { type: 'button', label: 'Test' },
          },
        },
      ];

      renderWithRecoil(
        <ToolCall
          {...mockProps}
          name="testFunction_action_test---domain---com"
          attachments={attachments as any}
        />,
      );

      openToolCallInfo();

      const toolCallInfo = screen.getByTestId('tool-call-info');
      const props = JSON.parse(toolCallInfo.textContent!);

      expect(props.input).toBe('{"test": "input"}');
      expect(props.output).toBe('Test output');
      expect(props.function_name).toBe('testFunction');
      expect(props.domain).toBe('test.domain.com');
      expect(props.pendingAuth).toBe(false);
    });
  });

  describe('authentication flow', () => {
    it('should show sign-in button when auth URL is provided', () => {
      const originalOpen = window.open;
      window.open = jest.fn();

      renderWithRecoil(
        <ToolCall
          {...mockProps}
          initialProgress={0.5}
          auth="https://auth.example.com"
          isSubmitting={true}
        />,
      );

      const signInButton = screen.getByText('Sign in to auth.example.com');
      expect(signInButton).toBeInTheDocument();

      fireEvent.click(signInButton);
      expect(window.open).toHaveBeenCalledWith(
        'https://auth.example.com',
        '_blank',
        'noopener,noreferrer',
      );

      window.open = originalOpen;
    });

    it('should pass pendingAuth as true when auth is pending', () => {
      renderWithRecoil(
        <ToolCall
          {...mockProps}
          auth="https://auth.example.com"
          initialProgress={0.5}
          isSubmitting={true}
        />,
      );

      openToolCallInfo();

      const toolCallInfo = screen.getByTestId('tool-call-info');
      const props = JSON.parse(toolCallInfo.textContent!);
      expect(props.pendingAuth).toBe(true);
    });

    it('should not show auth section when cancelled', () => {
      renderWithRecoil(
        <ToolCall
          {...mockProps}
          auth="https://auth.example.com"
          initialProgress={0.5}
          isSubmitting={false}
        />,
      );

      expect(screen.queryByText('Sign in to auth.example.com')).not.toBeInTheDocument();
    });

    it('should not show auth section when progress is complete', () => {
      renderWithRecoil(
        <ToolCall
          {...mockProps}
          auth="https://auth.example.com"
          initialProgress={1}
          isSubmitting={false}
        />,
      );

      expect(screen.queryByText('Sign in to auth.example.com')).not.toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle undefined args', () => {
      renderWithRecoil(<ToolCall {...mockProps} args={undefined as any} />);

      openToolCallInfo();

      const toolCallInfo = screen.getByTestId('tool-call-info');
      const props = JSON.parse(toolCallInfo.textContent!);
      expect(props.input).toBe('');
    });

    it('should handle null output', () => {
      renderWithRecoil(<ToolCall {...mockProps} output={null} />);

      openToolCallInfo();

      const toolCallInfo = screen.getByTestId('tool-call-info');
      const props = JSON.parse(toolCallInfo.textContent!);
      expect(props.output).toBeNull();
    });

    it('should handle missing domain', () => {
      renderWithRecoil(<ToolCall {...mockProps} />);

      openToolCallInfo();

      const toolCallInfo = screen.getByTestId('tool-call-info');
      const props = JSON.parse(toolCallInfo.textContent!);
      expect(props.domain).toBe('');
    });

    it('should handle complex nested attachments', () => {
      const complexAttachments = [
        {
          type: Tools.ui_resources,
          messageId: 'msg123',
          toolCallId: 'tool456',
          conversationId: 'conv789',
          [Tools.ui_resources]: {
            '0': {
              type: 'nested',
              data: {
                deep: {
                  value: 'test',
                  array: [1, 2, 3],
                  object: { key: 'value' },
                },
              },
            },
          },
        },
      ];

      renderWithRecoil(<ToolCall {...mockProps} attachments={complexAttachments as any} />);

      openToolCallInfo();

      const toolCallInfo = screen.getByTestId('tool-call-info');
      const attachmentsData = toolCallInfo.getAttribute('data-attachments');
      expect(JSON.parse(attachmentsData!)).toEqual(complexAttachments);

      const attachmentGroup = screen.getByTestId('attachment-group');
      expect(JSON.parse(attachmentGroup.textContent!)).toEqual(complexAttachments);
    });
  });

  describe('MCP OAuth detection', () => {
    const d = Constants.mcp_delimiter;

    it('should display the server name instead of oauth during completion', () => {
      renderWithRecoil(
        <ToolCall
          {...mockProps}
          name={`oauth${d}my-server`}
          initialProgress={1}
          isSubmitting={false}
          output="done"
          auth="https://auth.example.com"
        />,
      );

      const progressText = screen.getByTestId('progress-text');
      expect(progressText.textContent).toContain('Completed my-server');
      expect(progressText.textContent).not.toContain('Completed oauth');
    });

    it('should preserve the full server name when it contains the delimiter substring', () => {
      renderWithRecoil(
        <ToolCall
          {...mockProps}
          name={`oauth${d}foo${d}bar`}
          initialProgress={1}
          isSubmitting={false}
          output="done"
        />,
      );

      expect(screen.getByTestId('progress-text').textContent).toContain(`Completed foo${d}bar`);
    });

    it('should keep showing the server name after auth is cleared', () => {
      renderWithRecoil(
        <ToolCall
          {...mockProps}
          name={`oauth${d}my-server`}
          initialProgress={1}
          isSubmitting={false}
          output="done"
        />,
      );

      const progressText = screen.getByTestId('progress-text');
      expect(progressText.textContent).toContain('Completed my-server');
      expect(progressText.textContent).not.toContain('Completed oauth');
    });

    it('should fallback to the auth redirect_uri when the name lacks the delimiter', () => {
      const authUrl =
        'https://oauth.example.com/authorize?redirect_uri=' +
        encodeURIComponent('https://app.example.com/api/mcp/my-server/oauth/callback');

      renderWithRecoil(
        <ToolCall
          {...mockProps}
          name="bare_name"
          initialProgress={1}
          isSubmitting={false}
          output="done"
          auth={authUrl}
        />,
      );

      const progressText = screen.getByTestId('progress-text');
      expect(progressText.textContent).toContain('Completed my-server');
      expect(progressText.textContent).not.toContain('bare_name');

      openToolCallInfo();

      const props = JSON.parse(screen.getByTestId('tool-call-info').textContent!);
      expect(props.function_name).toBe('my-server');
    });

    it('should not misidentify action OAuth redirects as MCP tool calls', () => {
      const authUrl =
        'https://oauth.example.com/authorize?redirect_uri=' +
        encodeURIComponent('https://app.example.com/api/actions/xyz/oauth/callback');

      renderWithRecoil(
        <ToolCall
          {...mockProps}
          name="action_name"
          initialProgress={1}
          isSubmitting={false}
          output="done"
          auth={authUrl}
        />,
      );

      const progressText = screen.getByTestId('progress-text');
      expect(progressText.textContent).toContain('Completed action_name');

      openToolCallInfo();

      const props = JSON.parse(screen.getByTestId('tool-call-info').textContent!);
      expect(props.function_name).toBe('action_name');
    });
  });
});

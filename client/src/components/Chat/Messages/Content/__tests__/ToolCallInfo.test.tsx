import React from 'react';
import { Tools } from 'librechat-data-provider';
import { UIResourceRenderer } from '@mcp-ui/client';
import { render, screen } from '@testing-library/react';
import type { TAttachment } from 'librechat-data-provider';
import UIResourceCarousel from '~/components/Chat/Messages/Content/UIResourceCarousel';
import ToolCallInfo from '~/components/Chat/Messages/Content/ToolCallInfo';

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string, values?: any) => {
    const translations: Record<string, string> = {
      com_assistants_domain_info: `Used ${values?.[0]}`,
      com_assistants_function_use: `Used ${values?.[0]}`,
      com_assistants_action_attempt: `Attempted to use ${values?.[0]}`,
      com_assistants_attempt_info: 'Attempted to use function',
      com_ui_result: 'Result',
      com_ui_ui_resources: 'UI Resources',
    };
    return translations[key] || key;
  },
}));

jest.mock('@mcp-ui/client', () => ({
  UIResourceRenderer: jest.fn(() => null),
}));

jest.mock('../UIResourceCarousel', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

import { TextEncoder, TextDecoder } from 'util';

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder as any;
  global.TextDecoder = TextDecoder as any;
}

describe('ToolCallInfo', () => {
  const mockProps = {
    input: '{"test": "input"}',
    function_name: 'testFunction',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ui_resources from attachments', () => {
    it('should render single ui_resource from attachments', () => {
      const uiResource = {
        type: 'text',
        data: 'Test resource',
      };

      const attachments: TAttachment[] = [
        {
          type: Tools.ui_resources,
          messageId: 'msg123',
          toolCallId: 'tool456',
          conversationId: 'conv789',
          [Tools.ui_resources]: [uiResource],
        },
      ];

      render(<ToolCallInfo {...mockProps} output="Some output" attachments={attachments} />);

      expect(UIResourceRenderer).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: uiResource,
          onUIAction: expect.any(Function),
          htmlProps: {
            autoResizeIframe: { width: true, height: true },
          },
        }),
        expect.any(Object),
      );

      expect(UIResourceCarousel).not.toHaveBeenCalled();
    });

    it('should render carousel for multiple ui_resources from attachments', () => {
      const attachments: TAttachment[] = [
        {
          type: Tools.ui_resources,
          messageId: 'msg1',
          toolCallId: 'tool1',
          conversationId: 'conv1',
          [Tools.ui_resources]: [
            { type: 'text', data: 'Resource 1' },
            { type: 'text', data: 'Resource 2' },
            { type: 'text', data: 'Resource 3' },
          ],
        },
      ];

      render(<ToolCallInfo {...mockProps} output="Some output" attachments={attachments} />);

      expect(UIResourceCarousel).toHaveBeenCalledWith(
        expect.objectContaining({
          uiResources: [
            { type: 'text', data: 'Resource 1' },
            { type: 'text', data: 'Resource 2' },
            { type: 'text', data: 'Resource 3' },
          ],
        }),
        expect.any(Object),
      );

      expect(UIResourceRenderer).not.toHaveBeenCalled();
    });

    it('should handle attachments with normal output', () => {
      const attachments: TAttachment[] = [
        {
          type: Tools.ui_resources,
          messageId: 'msg123',
          toolCallId: 'tool456',
          conversationId: 'conv789',
          [Tools.ui_resources]: [{ type: 'text', data: 'UI Resource' }],
        },
      ];

      const output = JSON.stringify([
        { type: 'text', text: 'Regular output 1' },
        { type: 'text', text: 'Regular output 2' },
      ]);

      const { container } = render(
        <ToolCallInfo {...mockProps} output={output} attachments={attachments} />,
      );

      const codeBlocks = container.querySelectorAll('code');
      const outputCode = codeBlocks[1]?.textContent;

      expect(outputCode).toContain('Regular output 1');
      expect(outputCode).toContain('Regular output 2');
      expect(UIResourceRenderer).toHaveBeenCalled();
    });

    it('should handle no attachments', () => {
      const output = JSON.stringify([{ type: 'text', text: 'Regular output' }]);

      render(<ToolCallInfo {...mockProps} output={output} />);

      expect(UIResourceRenderer).not.toHaveBeenCalled();
      expect(UIResourceCarousel).not.toHaveBeenCalled();
    });

    it('should handle empty attachments array', () => {
      const attachments: TAttachment[] = [];

      render(<ToolCallInfo {...mockProps} attachments={attachments} />);

      expect(UIResourceRenderer).not.toHaveBeenCalled();
      expect(UIResourceCarousel).not.toHaveBeenCalled();
    });

    it('should handle attachments with non-ui_resources type', () => {
      const attachments: TAttachment[] = [
        {
          type: Tools.web_search as any,
          messageId: 'msg123',
          toolCallId: 'tool456',
          conversationId: 'conv789',
          [Tools.web_search]: {
            organic: [],
          },
        },
      ];

      render(<ToolCallInfo {...mockProps} attachments={attachments} />);

      expect(UIResourceRenderer).not.toHaveBeenCalled();
      expect(UIResourceCarousel).not.toHaveBeenCalled();
    });
  });

  describe('rendering logic', () => {
    it('should render UI Resources heading when ui_resources exist in attachments', () => {
      const attachments: TAttachment[] = [
        {
          type: Tools.ui_resources,
          messageId: 'msg123',
          toolCallId: 'tool456',
          conversationId: 'conv789',
          [Tools.ui_resources]: [{ type: 'text', data: 'Test' }],
        },
      ];

      render(<ToolCallInfo {...mockProps} output="Some output" attachments={attachments} />);

      expect(screen.getByText('UI Resources')).toBeInTheDocument();
    });

    it('should not render UI Resources heading when no ui_resources in attachments', () => {
      render(<ToolCallInfo {...mockProps} />);

      expect(screen.queryByText('UI Resources')).not.toBeInTheDocument();
    });

    it('should pass correct props to UIResourceRenderer', () => {
      const uiResource = {
        type: 'form',
        data: { fields: [{ name: 'test', type: 'text' }] },
      };

      const attachments: TAttachment[] = [
        {
          type: Tools.ui_resources,
          messageId: 'msg123',
          toolCallId: 'tool456',
          conversationId: 'conv789',
          [Tools.ui_resources]: [uiResource],
        },
      ];

      render(<ToolCallInfo {...mockProps} output="Some output" attachments={attachments} />);

      expect(UIResourceRenderer).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: uiResource,
          onUIAction: expect.any(Function),
          htmlProps: {
            autoResizeIframe: { width: true, height: true },
          },
        }),
        expect.any(Object),
      );
    });

    it('should console.log when UIAction is triggered', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const attachments: TAttachment[] = [
        {
          type: Tools.ui_resources,
          messageId: 'msg123',
          toolCallId: 'tool456',
          conversationId: 'conv789',
          [Tools.ui_resources]: [{ type: 'text', data: 'Test' }],
        },
      ];

      render(<ToolCallInfo {...mockProps} output="Some output" attachments={attachments} />);

      const lastCall = (UIResourceRenderer as jest.Mock).mock.calls.at(-1);
      const onUIAction = lastCall?.[0]?.onUIAction;

      expect(onUIAction).toBeDefined();

      await onUIAction({ type: 'test', payload: 'data' });

      expect(consoleSpy).toHaveBeenCalledWith('Action:', { type: 'test', payload: 'data' });
      consoleSpy.mockRestore();
    });
  });
});

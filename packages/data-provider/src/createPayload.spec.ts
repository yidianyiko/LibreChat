import createPayload from './createPayload';
import { EndpointURLs } from './config';
import { EModelEndpoint } from './schemas';

describe('createPayload', () => {
  it('should include useMemoryAgent for non-assistants endpoints', () => {
    const submission = {
      isTemporary: false,
      conversation: {
        conversationId: 'convo-1',
        endpoint: EModelEndpoint.openAI,
      },
      userMessage: {
        text: 'hello',
      },
      endpointOption: {
        endpoint: EModelEndpoint.openAI,
      },
      useMemoryAgent: false,
    } as any;

    const { server, payload } = createPayload(submission);

    expect(server).toBe(`${EndpointURLs[EModelEndpoint.agents]}/${EModelEndpoint.openAI}`);
    expect(payload.useMemoryAgent).toBe(false);
  });

  it('should omit useMemoryAgent for assistants endpoints', () => {
    const submission = {
      isTemporary: false,
      conversation: {
        conversationId: 'convo-1',
        endpoint: EModelEndpoint.assistants,
      },
      userMessage: {
        text: 'hello',
      },
      endpointOption: {
        endpoint: EModelEndpoint.assistants,
        endpointType: EModelEndpoint.assistants,
      },
      useMemoryAgent: false,
    } as any;

    const { payload } = createPayload(submission);

    expect(payload.useMemoryAgent).toBeUndefined();
  });
});

import { useMemo } from 'react';
import { useGetModelRatesQuery, useGetModelsQuery } from 'librechat-data-provider/react-query';
import type { TConversation } from 'librechat-data-provider';
import type { TSetOption } from '~/common';
import { multiChatOptions } from './options';

type TGoogleProps = {
  showExamples: boolean;
  isCodeChat: boolean;
};

type TSelectProps = {
  conversation: TConversation | null;
  setOption: TSetOption;
  extraProps?: TGoogleProps;
  showAbove?: boolean;
  popover?: boolean;
};

export default function ModelSelect({
  conversation,
  setOption,
  popover = false,
  showAbove = true,
}: TSelectProps) {
  const modelsQuery = useGetModelsQuery();
  const modelRatesQuery = useGetModelRatesQuery();
  const endpoint = conversation?.endpointType ?? conversation?.endpoint;

  const modelsWithRates = useMemo(() => {
    if (!conversation?.endpoint) {
      return [];
    }
    const _endpoint = conversation.endpoint;
    const models = modelsQuery.data?.[_endpoint] ?? [];
    const rates = modelRatesQuery.data?.[_endpoint] ?? {};
    return models.map((model) => {
      const rate = rates?.[model];
      if (rate == null) {
        return model;
      }

      return {
        value: model,
        label: model,
        description: `Input $${rate.prompt.toFixed(2)}/M | Output $${rate.completion.toFixed(2)}/M`,
      };
    });
  }, [conversation?.endpoint, modelsQuery.data, modelRatesQuery.data]);

  if (!conversation?.endpoint || !endpoint) {
    return null;
  }

  const OptionComponent = multiChatOptions[endpoint];

  if (!OptionComponent) {
    return null;
  }

  return (
    <OptionComponent
      conversation={conversation}
      setOption={setOption}
      models={modelsWithRates}
      showAbove={showAbove}
      popover={popover}
    />
  );
}

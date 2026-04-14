import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { RecoilRoot, useRecoilValue } from 'recoil';
import type { TPreset, TStartupConfig, TUser } from 'librechat-data-provider';
import usePresets from './usePresets';
import store from '~/store';

const mockShowToast = jest.fn();
const mockSetQueryData = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockGetQueryData = jest.fn();
const mockNewConversation = jest.fn();
const mockUpdatePresetMutate = jest.fn();
const mockRefetch = jest.fn();

const mockUser = {
  id: 'user-123',
  username: 'testuser',
  email: 'test@example.com',
  name: 'Test User',
  avatar: '',
  role: 'USER',
  provider: 'local',
  emailVerified: true,
  createdAt: '2023-01-01T00:00:00.000Z',
  updatedAt: '2023-01-01T00:00:00.000Z',
} as TUser;

const mockDefaultPreset: TPreset = {
  presetId: 'preset-1',
  title: 'User Default',
  user: mockUser.id,
  endpoint: 'openAI',
  model: 'gpt-4o',
  defaultPreset: true,
};

let mockStartupConfig: Partial<TStartupConfig> | undefined;

jest.mock('@librechat/client', () => ({
  useToastContext: () => ({
    showToast: mockShowToast,
  }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    setQueryData: mockSetQueryData,
    invalidateQueries: mockInvalidateQueries,
    getQueryData: mockGetQueryData,
  }),
}));

jest.mock('librechat-data-provider/react-query', () => ({
  ...jest.requireActual('librechat-data-provider/react-query'),
  useCreatePresetMutation: () => ({
    mutate: jest.fn(),
  }),
  useGetModelsQuery: () => ({
    data: undefined,
  }),
}));

jest.mock('~/data-provider', () => ({
  useUpdatePresetMutation: () => ({
    mutate: mockUpdatePresetMutate,
  }),
  useDeletePresetMutation: () => ({
    mutate: jest.fn(),
  }),
  useGetPresetsQuery: () => ({
    data: [mockDefaultPreset],
    refetch: mockRefetch,
  }),
  useGetStartupConfig: () => ({
    data: mockStartupConfig,
  }),
}));

jest.mock('~/utils', () => ({
  cleanupPreset: ({ preset }: { preset: TPreset }) => preset,
  removeUnavailableTools: <TValue,>(value: TValue) => value,
  getConvoSwitchLogic: () => ({
    shouldSwitch: false,
    isNewModular: false,
    newEndpointType: 'openAI',
    isCurrentModular: false,
    isExistingConversation: false,
  }),
}));

jest.mock('~/hooks/Conversations/useGetConversation', () => ({
  __esModule: true,
  default: () => () => null,
}));

jest.mock('~/hooks/Conversations/useDefaultConvo', () => ({
  __esModule: true,
  default: () => jest.fn(),
}));

jest.mock('~/hooks/useNewConvo', () => ({
  __esModule: true,
  default: () => ({
    newConversation: mockNewConversation,
  }),
}));

jest.mock('~/hooks/AuthContext', () => ({
  useAuthContext: () => ({
    user: mockUser,
    isAuthenticated: true,
  }),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <RecoilRoot>{children}</RecoilRoot>
);

describe('usePresets', () => {
  beforeEach(() => {
    mockStartupConfig = undefined;
    jest.clearAllMocks();
    mockGetQueryData.mockReturnValue(undefined);
  });

  it('waits for startup config before adopting any database default preset', () => {
    const { result } = renderHook(
      () => ({
        hook: usePresets(),
        defaultPreset: useRecoilValue(store.defaultPreset),
      }),
      { wrapper },
    );

    expect(result.current.defaultPreset).toBeNull();
    expect(mockNewConversation).not.toHaveBeenCalled();
  });

  it('does not adopt a database default preset when model specs are prioritized', () => {
    mockStartupConfig = {
      modelSpecs: {
        prioritize: true,
      },
    } as Partial<TStartupConfig>;

    const { result } = renderHook(
      () => ({
        hook: usePresets(),
        defaultPreset: useRecoilValue(store.defaultPreset),
      }),
      { wrapper },
    );

    expect(result.current.defaultPreset).toBeNull();
    expect(mockNewConversation).not.toHaveBeenCalled();
  });

  it('ignores attempts to pin a default preset when model specs are prioritized', () => {
    mockStartupConfig = {
      modelSpecs: {
        prioritize: true,
      },
    } as Partial<TStartupConfig>;

    const { result } = renderHook(() => usePresets(), { wrapper });

    act(() => {
      result.current.onSetDefaultPreset(mockDefaultPreset);
    });

    expect(mockUpdatePresetMutate).not.toHaveBeenCalled();
  });
});

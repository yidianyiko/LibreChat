import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { request } from 'librechat-data-provider';

import { useRefreshTokenMutation } from '../mutations';

jest.mock('librechat-data-provider', () => {
  const actual = jest.requireActual('librechat-data-provider');

  return {
    ...actual,
    request: {
      ...actual.request,
      refreshToken: jest.fn(),
    },
  };
});

const mockRefreshToken = jest.mocked(request.refreshToken);

describe('useRefreshTokenMutation', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('does not retry refresh token requests when the network closes the connection', async () => {
    mockRefreshToken.mockRejectedValue(new Error('net::ERR_CONNECTION_CLOSED'));

    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: {
          retry: 1,
          retryDelay: 10,
        },
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useRefreshTokenMutation(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync(undefined)).rejects.toThrow(
        'net::ERR_CONNECTION_CLOSED',
      );
    });

    expect(mockRefreshToken).toHaveBeenCalledTimes(1);
  });
});

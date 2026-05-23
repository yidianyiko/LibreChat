import openclawWeixinPackage from '@tencent-weixin/openclaw-weixin/package.json';
import {
  getOpenClawUpdates,
  sendOpenClawTextMessage,
  startOpenClawQrLogin,
} from '../openclawClient';

type OpenClawWeixinPackage = {
  version: string;
  ilink_appid: string;
};

const packageMetadata = openclawWeixinPackage as OpenClawWeixinPackage;

function buildClientVersion(version: string): number {
  const [major = 0, minor = 0, patch = 0] = version
    .split('.')
    .map((part) => Number.parseInt(part, 10));

  return ((major & 0xff) << 16) | ((minor & 0xff) << 8) | (patch & 0xff);
}

function getFetchCall(index = 0): [string, RequestInit] {
  const fetchMock = fetch as jest.MockedFunction<typeof fetch>;
  return fetchMock.mock.calls[index] as [string, RequestInit];
}

function getHeaders(init: RequestInit): Record<string, string> {
  return init.headers as Record<string, string>;
}

describe('openclawClient', () => {
  beforeEach(() => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          qrcode: 'qr-code',
          qrcode_img_content: 'data:image/png;base64,qr',
          ret: 0,
          msgs: [],
          get_updates_buf: 'cursor-1',
        }),
        { status: 200 },
      ),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.WECHAT_BRIDGE_BOT_AGENT;
  });

  it('requests QR codes with the current iLink app headers and POST body', async () => {
    await startOpenClawQrLogin();

    const [url, init] = getFetchCall();
    const headers = getHeaders(init);

    expect(url).toBe('https://ilinkai.weixin.qq.com/ilink/bot/get_bot_qrcode?bot_type=3');
    expect(init.method).toBe('POST');
    expect(headers['iLink-App-Id']).toBe(packageMetadata.ilink_appid);
    expect(headers['iLink-App-ClientVersion']).toBe(
      String(buildClientVersion(packageMetadata.version)),
    );
    expect(headers).not.toHaveProperty('Content-Length');
    expect(JSON.parse(init.body as string)).toEqual({
      local_token_list: [],
      base_info: {
        channel_version: packageMetadata.version,
        bot_agent: 'OpenClaw',
      },
    });
  });

  it('adds base_info to long-poll requests without overwriting the cursor', async () => {
    await getOpenClawUpdates({
      baseUrl: 'https://redirect.example.com',
      botToken: 'bot-token',
      cursor: 'cursor-0',
    });

    const [, init] = getFetchCall();
    expect(JSON.parse(init.body as string)).toEqual({
      get_updates_buf: 'cursor-0',
      base_info: {
        channel_version: packageMetadata.version,
        bot_agent: 'OpenClaw',
      },
    });
  });

  it('adds base_info to outbound messages and keeps the Authorization token redacted from tests', async () => {
    process.env.WECHAT_BRIDGE_BOT_AGENT = 'LibreChat/0.8.4 (env=prod)';

    await sendOpenClawTextMessage({
      baseUrl: 'https://redirect.example.com',
      botToken: 'bot-token',
      toUserId: 'ilink-user',
      contextToken: 'context-token',
      text: 'hello',
    });

    const [, init] = getFetchCall();
    const headers = getHeaders(init);

    expect(headers.Authorization).toBe('Bearer bot-token');
    expect(JSON.parse(init.body as string)).toMatchObject({
      base_info: {
        channel_version: packageMetadata.version,
        bot_agent: 'LibreChat/0.8.4 (env=prod)',
      },
      msg: {
        to_user_id: 'ilink-user',
        context_token: 'context-token',
        item_list: [
          {
            type: 1,
            text_item: {
              text: 'hello',
            },
          },
        ],
      },
    });
  });
});

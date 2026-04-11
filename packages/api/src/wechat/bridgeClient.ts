import axios from 'axios';

export interface WeChatBridgeBindSessionPayload {
  userId: string;
}

export class WeChatBridgeClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  private headers() {
    return { Authorization: `Bearer ${this.token}` };
  }

  startBindSession(payload: WeChatBridgeBindSessionPayload) {
    return axios.post(`${this.baseUrl}/bind-sessions`, payload, { headers: this.headers() });
  }

  getBindSession(bindSessionId: string) {
    return axios.get(`${this.baseUrl}/bind-sessions/${encodeURIComponent(bindSessionId)}`, {
      headers: this.headers(),
    });
  }

  cancelBindSession(bindSessionId: string) {
    return axios.delete(`${this.baseUrl}/bind-sessions/${encodeURIComponent(bindSessionId)}`, {
      headers: this.headers(),
    });
  }
}

import WebSocket from 'ws';
import {
  createPingMessage,
  createGetConfigMessage,
  createGetAssetsMessage,
  createECDSAMessageSigner,
} from '@erc7824/nitrolite';

export class ClearNodeClient {
  constructor({ wsUrl = 'wss://clearnet.yellow.com/ws', privateKey }) {
    this.wsUrl = wsUrl;
    this.privateKey = this.normalizePrivateKey(privateKey);
    this.signer = createECDSAMessageSigner(this.privateKey);
    this.ws = null;
    this.pending = new Map();
    this.isConnecting = false;
  }

  normalizePrivateKey(input) {
    if (!input) throw new Error('privateKey is required');
    let k = String(input).trim();
    if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
      k = k.slice(1, -1);
    }
    if (!k.startsWith('0x')) k = '0x' + k;
    const body = k.slice(2);
    if (body.length !== 64 || !/^[0-9a-fA-F]+$/.test(body)) {
      throw new Error('privateKey must be 32-byte hex');
    }
    return '0x' + body.toLowerCase();
  }

  async connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    if (this.isConnecting) {
      await new Promise((r) => setTimeout(r, 50));
      return this.connect();
    }
    this.isConnecting = true;
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      const onOpen = () => {
        this.ws.off('error', onError);
        resolve();
      };
      const onError = (err) => {
        this.ws.off('open', onOpen);
        reject(err);
      };
      this.ws.once('open', onOpen);
      this.ws.once('error', onError);
    });
    this.isConnecting = false;
    this.ws.on('message', (data) => this.onMessage(data));
    this.ws.on('close', () => {
      for (const [, { reject }] of this.pending) {
        reject(new Error('WebSocket closed'));
      }
      this.pending.clear();
    });
  }

  onMessage(data) {
    try {
      const text = typeof data === 'string' ? data : data.toString('utf8');
      const msg = JSON.parse(text);
      if (!msg || !msg.res || !Array.isArray(msg.res)) return;
      const requestId = msg.res[0];
      const entry = this.pending.get(requestId);
      if (entry) {
        this.pending.delete(requestId);
        entry.resolve(msg);
      }
    } catch (_) {
      // ignore non-JSON frames
    }
  }

  async sendSigned(createMessageFn) {
    await this.connect();
    const json = await createMessageFn(this.signer);
    const payload = JSON.parse(json);
    const requestId = Array.isArray(payload?.req) ? payload.req[0] : undefined;
    if (!requestId) throw new Error('Invalid request payload');
    const result = new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(requestId)) {
          this.pending.delete(requestId);
          reject(new Error('RPC timeout'));
        }
      }, 10_000);
    });
    this.ws.send(json);
    return result;
  }

  async ping() {
    return this.sendSigned(createPingMessage);
  }

  async getConfig() {
    return this.sendSigned(createGetConfigMessage);
  }

  async getAssets(chainId) {
    return this.sendSigned((signer) => createGetAssetsMessage(signer, chainId));
  }
}



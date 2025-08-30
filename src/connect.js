import WebSocket from 'ws';
import {
  createGetConfigMessage,
  createPingMessage,
  createECDSAMessageSigner,
} from '@erc7824/nitrolite';

const WS_URL = process.env.CLEARNODE_WS_URL || 'wss://clearnet.yellow.com/ws';
// Demo private key (hardcoded). Replace with your own for production use.
const PRIVATE_KEY = '0x59c6995e998f97a5a0044966f094538b292f2f3c5a1e0769f0f4f2159f2c2aa1';

function normalizePrivateKey(input) {
  if (!input) return input;
  let k = String(input).trim();
  // strip surrounding quotes if present
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1);
  }
  k = k.trim();
  if (k.startsWith('0x')) {
    k = '0x' + k.slice(2).trim();
  }
  // if missing 0x, add it
  if (!k.startsWith('0x')) {
    k = '0x' + k;
  }
  // validate hex length & chars (64 hex chars after 0x)
  const body = k.slice(2);
  if (body.length !== 64 || !/^[0-9a-fA-F]+$/.test(body)) {
    throw new Error('YELLOW_PRIV_KEY must be a 32-byte hex string (64 hex chars), with or without 0x');
  }
  return '0x' + body.toLowerCase();
}

const NORMALIZED_PRIVATE_KEY = normalizePrivateKey(PRIVATE_KEY);
const signer = createECDSAMessageSigner(NORMALIZED_PRIVATE_KEY);

function waitOpen(socket) {
  return new Promise((resolve, reject) => {
    const onOpen = () => {
      cleanup();
      resolve();
    };
    const onError = (err) => {
      cleanup();
      reject(err);
    };
    const cleanup = () => {
      socket.off('open', onOpen);
      socket.off('error', onError);
    };
    socket.on('open', onOpen);
    socket.on('error', onError);
  });
}

async function main() {
  console.log('Connecting to', WS_URL);
  const ws = new WebSocket(WS_URL);
  await waitOpen(ws);
  console.log('WebSocket connected');

  ws.on('close', (code, reason) => {
    console.log('WebSocket closed', code, reason?.toString());
  });
  ws.on('error', (err) => {
    console.error('WebSocket error', err);
  });

  ws.on('message', (data) => {
    try {
      const text = typeof data === 'string' ? data : data.toString('utf8');
      const msg = JSON.parse(text);
      console.log('<<', JSON.stringify(msg, null, 2));
    } catch (e) {
      console.log('<< (raw)', data);
    }
  });

  // Send Ping first
  const ping = await createPingMessage(signer);
  console.log('>> Ping');
  ws.send(ping);

  // Request config
  const getConfig = await createGetConfigMessage(signer);
  console.log('>> GetConfig');
  ws.send(getConfig);

  // Give some time to receive messages then exit
  setTimeout(() => {
    ws.close();
  }, 2000);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});



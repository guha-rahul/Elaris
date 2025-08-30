import express from 'express';
import cors from 'cors';
import { ClearNodeClient } from './rpcClient.js';
import { LendingService } from './lendingService.js';

const app = express();
app.use(cors());
app.use(express.json());

// Use same demo key as connect.js for simplicity
const DEMO_KEY = '0x59c6995e998f97a5a0044966f094538b292f2f3c5a1e0769f0f4f2159f2c2aa1';
const client = new ClearNodeClient({ privateKey: DEMO_KEY });
const lending = new LendingService();

function sendJson(res, data) {
  res.setHeader('Content-Type', 'application/json');
  res.send(
    JSON.stringify(
      data,
      (_, v) => (typeof v === 'bigint' ? v.toString() : v)
    )
  );
}

app.get('/api/ping', async (_req, res) => {
  try {
    const msg = await client.ping();
    sendJson(res, msg);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.get('/api/config', async (_req, res) => {
  try {
    const msg = await client.getConfig();
    sendJson(res, msg);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.get('/api/assets', async (req, res) => {
  try {
    const chainId = req.query.chainId ? Number(req.query.chainId) : undefined;
    const msg = await client.getAssets(chainId);
    sendJson(res, msg);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Lending endpoints (in-memory demo)
app.get('/api/lending/state', (_req, res) => {
  sendJson(res, lending.getState());
});

app.post('/api/lending/supply', (req, res) => {
  try {
    const { user = 'demo', symbol, amount } = req.body || {};
    const result = lending.supply(user, symbol, amount);
    sendJson(res, result);
  } catch (e) {
    res.status(400).json({ error: String(e?.message || e) });
  }
});

app.post('/api/lending/borrow', (req, res) => {
  try {
    const { user = 'demo', symbol, amount } = req.body || {};
    const result = lending.borrow(user, symbol, amount);
    sendJson(res, result);
  } catch (e) {
    res.status(400).json({ error: String(e?.message || e) });
  }
});

app.post('/api/lending/repay', (req, res) => {
  try {
    const { user = 'demo', symbol, amount } = req.body || {};
    const result = lending.repay(user, symbol, amount);
    sendJson(res, result);
  } catch (e) {
    res.status(400).json({ error: String(e?.message || e) });
  }
});

app.post('/api/lending/redeem', (req, res) => {
  try {
    const { user = 'demo', symbol, amount } = req.body || {};
    const result = lending.redeem(user, symbol, amount);
    sendJson(res, result);
  } catch (e) {
    res.status(400).json({ error: String(e?.message || e) });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});



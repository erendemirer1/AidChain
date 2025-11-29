// backend/server.js
// Enoki Sponsored Transaction Backend Proxy
// Private API key'i güvenli tutmak için backend gerekli

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { EnokiClient } from '@mysten/enoki';

const app = express();
app.use(cors());
app.use(express.json());

// Environment variables
const ENOKI_PRIVATE_KEY = process.env.ENOKI_PRIVATE_KEY;
const PORT = process.env.PORT || 3001;

console.log('API Key loaded:', ENOKI_PRIVATE_KEY ? `${ENOKI_PRIVATE_KEY.slice(0, 20)}...` : 'NOT SET');

if (!ENOKI_PRIVATE_KEY) {
  console.error('ENOKI_PRIVATE_KEY environment variable is required!');
  process.exit(1);
}

// Enoki client with PRIVATE key
const enokiClient = new EnokiClient({
  apiKey: ENOKI_PRIVATE_KEY,
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Sponsor transaction endpoint
app.post('/api/sponsor', async (req, res) => {
  try {
    const { network, transactionKindBytes, sender, allowedMoveCallTargets } = req.body;

    if (!transactionKindBytes || !sender) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log('Sponsoring transaction for:', sender);

    const response = await enokiClient.createSponsoredTransaction({
      network: network || 'testnet',
      transactionKindBytes,
      sender,
      allowedMoveCallTargets: allowedMoveCallTargets || ['*'],
    });

    console.log('Sponsored transaction created:', response.digest);

    res.json({
      bytes: response.bytes,
      digest: response.digest,
    });
  } catch (error) {
    console.error('Sponsor error:', error);
    res.status(500).json({ 
      error: error.message,
      details: error.errors || [],
    });
  }
});

// Execute sponsored transaction endpoint
app.post('/api/execute', async (req, res) => {
  try {
    const { digest, signature } = req.body;

    if (!digest || !signature) {
      return res.status(400).json({ error: 'Missing digest or signature' });
    }

    console.log('Executing sponsored transaction:', digest);

    const response = await enokiClient.executeSponsoredTransaction({
      digest,
      signature,
    });

    console.log('Transaction executed:', response.digest);

    res.json({
      digest: response.digest,
    });
  } catch (error) {
    console.error('Execute error:', error);
    res.status(500).json({ 
      error: error.message,
      details: error.errors || [],
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Enoki Sponsor Backend running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
});

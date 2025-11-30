// Enoki Sponsored Transaction Backend Proxy

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { EnokiClient } from '@mysten/enoki';

const app = express();
app.use(cors());
app.use(express.json());

const ENOKI_PRIVATE_KEY = process.env.ENOKI_PRIVATE_KEY;
const PORT = process.env.PORT || 3001;

if (!ENOKI_PRIVATE_KEY) {
  console.error('ENOKI_PRIVATE_KEY environment variable is required!');
  process.exit(1);
}

const enokiClient = new EnokiClient({
  apiKey: ENOKI_PRIVATE_KEY,
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/sponsor', async (req, res) => {
  try {
    const { network, transactionKindBytes, sender } = req.body;

    console.log('Sponsor request:', { network, sender });

    if (!transactionKindBytes || !sender) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Send allowed targets directly to Enoki API
    const response = await enokiClient.createSponsoredTransaction({
      network: network || 'testnet',
      transactionKindBytes,
      sender,
      allowedMoveCallTargets: [
        '0x39a75e291a9eb2f71678d6908ca45fb65016961dffe7d344b233a07780bfb721::aidchain::register_recipient',
        '0x39a75e291a9eb2f71678d6908ca45fb65016961dffe7d344b233a07780bfb721::aidchain::create_verification_proposal',
        '0x39a75e291a9eb2f71678d6908ca45fb65016961dffe7d344b233a07780bfb721::aidchain::vote_on_proposal',
        '0x39a75e291a9eb2f71678d6908ca45fb65016961dffe7d344b233a07780bfb721::aidchain::execute_proposal',
        '0x39a75e291a9eb2f71678d6908ca45fb65016961dffe7d344b233a07780bfb721::aidchain::create_aid_package',
        '0x39a75e291a9eb2f71678d6908ca45fb65016961dffe7d344b233a07780bfb721::aidchain::assign_recipient',
        '0x39a75e291a9eb2f71678d6908ca45fb65016961dffe7d344b233a07780bfb721::aidchain::mark_delivered',
        '0x39a75e291a9eb2f71678d6908ca45fb65016961dffe7d344b233a07780bfb721::aidchain::release_funds',
        '0x39a75e291a9eb2f71678d6908ca45fb65016961dffe7d344b233a07780bfb721::impact_nft::mint_impact_nft',
      ],
    });

    console.log('Sponsor success:', response.digest);

    res.json({
      bytes: response.bytes,
      digest: response.digest,
    });
  } catch (error) {
    console.error('Sponsor error:', error.message);
    console.error('Sponsor error details:', JSON.stringify(error.errors || [], null, 2));
    console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    res.status(error.status || 500).json({ 
      error: error.message,
      details: error.errors || [],
    });
  }
});

app.post('/api/execute', async (req, res) => {
  try {
    const { digest, signature } = req.body;

    if (!digest || !signature) {
      return res.status(400).json({ error: 'Missing digest or signature' });
    }

    const response = await enokiClient.executeSponsoredTransaction({
      digest,
      signature,
    });

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
  console.log(`Enoki Sponsor Backend running on port ${PORT}`);
});

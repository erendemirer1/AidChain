// src/config.ts
// AidChain Configuration - V12 (RecipientProfile shared)

export const AIDCHAIN_PACKAGE_ID =
  '0x39a75e291a9eb2f71678d6908ca45fb65016961dffe7d344b233a07780bfb721';

export const AIDCHAIN_REGISTRY_ID =
  '0x9e91dbb52ab2f12c1bc777d73b04b0976ed7e5f0d8353781d6bb6a0f390c69b5';

export const REGISTRY_INITIAL_SHARED_VERSION = 670251457;

// Impact NFT Configuration
export const IMPACT_COUNTER_ID =
  '0xeb6981cf24490e3265c53cc3d769d415a0710dc4227aed53cdbfdb1f292a6097';

export const IMPACT_COUNTER_INITIAL_SHARED_VERSION = 670251444;

// Walrus Testnet URLs
export const WALRUS_AGGREGATOR_URL = 'https://aggregator.walrus-testnet.walrus.space';
export const WALRUS_PUBLISHER_URL = 'https://publisher.walrus-testnet.walrus.space';

// DAO Config Defaults
export const DEFAULT_VOTING_PERIOD = 10;
export const DEFAULT_QUORUM_PERCENT = 50;
export const DEFAULT_APPROVAL_PERCENT = 60;

// Enoki Sponsored Transactions
export const SPONSOR_BACKEND_URL = import.meta.env.VITE_SPONSOR_BACKEND_URL || 'http://localhost:3001';
export const ENOKI_NETWORK = 'testnet' as const;
export const SPONSORED_TX_ENABLED = import.meta.env.VITE_SPONSORED_TX_ENABLED === 'true';

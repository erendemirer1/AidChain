// src/config.ts

// ====== AidChain V10 - PROPOSAL OWNERSHIP FIX ======
// V10 Yenilikler:
// - create_verification_proposal artık profile'a yazmıyor (ownership hatası düzeltildi)
// - profiles_with_proposals registry'de tutuluyor
// - Verifier'lar başka kullanıcıların profile'ları için öneri oluşturabilir

export const AIDCHAIN_PACKAGE_ID =
  '0x1157d993f30167c9d5552d61d5a0e838871f6fe3b1e36312beeb5b8825891ce1';

export const AIDCHAIN_REGISTRY_ID =
  '0x5763027400406393cc10ae18707cb9b9e087ddf618f550db57fc924474608e49';

export const REGISTRY_INITIAL_SHARED_VERSION = 670251448;

// Walrus Testnet Aggregator/Publisher URLs
export const WALRUS_AGGREGATOR_URL = 'https://aggregator.walrus-testnet.walrus.space';
export const WALRUS_PUBLISHER_URL = 'https://publisher.walrus-testnet.walrus.space';

// DAO Config Defaults (blockchain'den de okunur)
export const DEFAULT_VOTING_PERIOD = 10;     // 10 epoch
export const DEFAULT_QUORUM_PERCENT = 50;    // %50 katılım
export const DEFAULT_APPROVAL_PERCENT = 60;  // %60 onay

// ====== ENOKI SPONSORED TRANSACTIONS CONFIG ======
// Sponsored transactions için backend proxy gerekli (private key güvenliği için)
// Backend: /backend/server.js

// Backend URL (local development)
export const SPONSOR_BACKEND_URL = import.meta.env.VITE_SPONSOR_BACKEND_URL || 'http://localhost:3001';

// Sponsored transaction için network
export const ENOKI_NETWORK = 'testnet' as const;

// Sponsored transaction aktif mi?
export const SPONSORED_TX_ENABLED = import.meta.env.VITE_SPONSORED_TX_ENABLED === 'true';


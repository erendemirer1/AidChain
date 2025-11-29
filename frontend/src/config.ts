// src/config.ts

// ====== RECİPİENT REGİSTRY SİSTEMİ V4 - KYC + WALRUS ======
// Yeni özellikler:
// - KYC: TC Kimlik hash, telefon doğrulama
// - Walrus: Hasar kanıtı fotoğraf yükleme
// - Aile büyüklüğü ve detaylı açıklama
// - STK doğrulama sistemi
// - Escrow bağış sistemi
// - Çoklu imza onayı

export const AIDCHAIN_PACKAGE_ID =
  '0x74138037fc19cdf34a2ac04636021db9a1971d1e924198c43525fe13f0efee5e';

export const AIDCHAIN_REGISTRY_ID =
  '0xdbd68aa9f37a583423112f295261750c7b348f5d3dff189dfd44ac9b56340de7';

export const REGISTRY_INITIAL_SHARED_VERSION = 670251434;

// Walrus Testnet Aggregator/Publisher URLs
export const WALRUS_AGGREGATOR_URL = 'https://aggregator.walrus-testnet.walrus.space';
export const WALRUS_PUBLISHER_URL = 'https://publisher.walrus-testnet.walrus.space';

// Coordinator Address (STK Admin)
export const COORDINATOR_ADDRESS = '0x114aa1f7c47970c88eaafac9c127f9ee9fbb91047fa04426f66a26d62034a813';

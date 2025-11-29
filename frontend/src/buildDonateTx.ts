// src/buildDonateTx.ts
import { TransactionBlock } from '@mysten/sui/transactions';
import { AIDCHAIN_PACKAGE_ID, AIDCHAIN_REGISTRY_ID } from './config';

export function buildDonateTx(
  description: string,
  location: string,
  amountSui: number,
) {
  const txb = new TransactionBlock();

  // SUI → MIST (10^9)
  const amountMist = BigInt(Math.floor(amountSui * 1_000_000_000));

  // Bağışçıdan amountMist kadar SUI ayır
  const [donationCoin] = txb.splitCoins(txb.gas, [txb.pure(amountMist)]);

  // aidchain::donate çağrısı
  txb.moveCall({
    target: `${AIDCHAIN_PACKAGE_ID}::aidchain::donate`,
    arguments: [
      txb.object(AIDCHAIN_REGISTRY_ID),   // &mut AidRegistry (shared)
      txb.pure.string(description),
      txb.pure.string(location),
      txb.pure.address(
        // Şimdilik koordinatör = senin admin adresin
        '0xa9778469f5de301ae6d149f8cabb73f76b6984f744479ea3b7e16562433bcf9a',
      ),
      donationCoin,                       // Coin<SUI> – Move tarafında donation_amount’a yazıyoruz
    ],
  });

  return txb;
}

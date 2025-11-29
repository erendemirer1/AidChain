import React, { FormEvent, useState } from 'react';
import {
  ConnectButton,
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';

// ====== SENİN DEĞERLERİN ======
const PACKAGE_ID =
  '0xca55c3c2e7633c537745a8f1402eb009d59165bcf9a880b638ffa2efd270681b';

const REGISTRY_ID =
  '0x044a5051f2b68d7d6e62c763f24ef0118c072e44f9b11e17f8a698724004eaba';

// sui client çıktısında: Shared( 668488924 )
const REGISTRY_INITIAL_SHARED_VERSION = 668488924;

// Şimdilik koordine eden STK/kurum adresi = senin adresin
const COORDINATOR =
  '0xa9778469f5de301ae6d149f8cabb73f76b6984f744479ea3b7e16562433bcf9a';

function DonationForm() {
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecuteTransaction, isPending } =
    useSignAndExecuteTransaction();

  const [status, setStatus] = useState<string>('');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!currentAccount) {
      alert('Önce cüzdanı bağlaman lazım.');
      return;
    }

    const form = e.currentTarget;
    const formData = new FormData(form);

    const description = String(formData.get('description') || '');
    const location = String(formData.get('location') || '');
    const amountStr = String(formData.get('amount') || '0');

    if (!description || !location) {
      alert('Açıklama ve lokasyon zorunlu.');
      return;
    }

    // basit: miktarı SUI cinsinden text olarak alıyoruz, MIST’e çeviriyoruz
    // 1 SUI = 1_000_000_000 MIST
    const suiAmount = Number(amountStr || '0');
    if (isNaN(suiAmount) || suiAmount <= 0) {
      alert('Geçerli bir bağış miktarı gir.');
      return;
    }

    const mistAmount = BigInt(Math.floor(suiAmount * 1_000_000_000));

    // ---- ASIL OLAY: GERÇEK Transaction objesi ----
    const tx = new Transaction();

    // Bağış miktarı için gas coin’den alt coin ayırıyoruz
    const [donationCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(mistAmount)]);

    // Move fonksiyonu çağrısı
    tx.moveCall({
      target: `${PACKAGE_ID}::aidchain::donate`,
      arguments: [
        // &mut AidRegistry (shared object)
        tx.sharedObjectRef({
          objectId: REGISTRY_ID,
          initialSharedVersion: REGISTRY_INITIAL_SHARED_VERSION,
          mutable: true,
        }),
        // description: string
        tx.pure.string(description),
        // location: string
        tx.pure.string(location),
        // coordinator: address
        tx.pure.address(COORDINATOR),
        // donation: Coin<SUI>
        donationCoin,
      ],
    });

    setStatus('İşlem hazırlanıyor, imzalaman için cüzdanda açılacak...');

    signAndExecuteTransaction(
      {
        transaction: tx,            // ÖNEMLİ: BURAYA Transaction objesini veriyoruz
        chain: 'sui:testnet',
      },
      {
        onSuccess: (res) => {
          console.log('Bağış tx başarıyla gönderildi:', res);
          setStatus(
            `Bağış kaydedildi! Tx digest: ${res.digest ?? 'bilinmiyor'}`,
          );
          form.reset();
        },
        onError: (err: any) => {
          console.error('Bağış sırasında hata:', err);
          setStatus(`Hata: ${String(err?.message ?? err)}`);
        },
      },
    );
  }

  return (
    <div className="donation-card">
      <h2>AidChain – Bağışçı Paneli</h2>

      <ConnectButton />

      {!currentAccount && (
        <p style={{ marginTop: '1rem' }}>
          Bağış yapmak için önce cüzdanını bağla.
        </p>
      )}

      {currentAccount && (
        <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
          <div className="form-row">
            <label>
              Açıklama
              <input
                name="description"
                placeholder="Gıda Paketi - Konserve + Su"
                required
              />
            </label>
          </div>

          <div className="form-row">
            <label>
              Lokasyon
              <input
                name="location"
                placeholder="Hatay/Antakya"
                required
              />
            </label>
          </div>

          <div className="form-row">
            <label>
              Miktar (SUI)
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.1"
                required
              />
            </label>
          </div>

          <button type="submit" disabled={isPending}>
            {isPending ? 'İşlem gönderiliyor...' : 'Bağış Yap'}
          </button>
        </form>
      )}

      {status && <p style={{ marginTop: '1rem' }}>{status}</p>}
    </div>
  );
}

export function DonationApp() {
  return <DonationForm />;
}

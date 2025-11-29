// src/DonationForm.tsx
import { useState } from 'react';
import {
  useCurrentAccount,
  useSignAndExecuteTransactionBlock,
} from '@mysten/dapp-kit';
import { buildDonateTx } from './buildDonateTx';

export function DonationForm() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransactionBlock();

  const [description, setDescription] = useState(
    'Gıda Paketi - Konserve + Su',
  );
  const [location, setLocation] = useState('Hatay/Antakya');
  const [amount, setAmount] = useState('0.1'); // SUI
  const [txDigest, setTxDigest] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleDonate = () => {
    if (!account) {
      alert('Önce cüzdanını bağlamalısın.');
      return;
    }

    const amountNumber = Number(amount);
    if (!amountNumber || amountNumber <= 0) {
      alert('Geçerli bir SUI miktarı gir.');
      return;
    }

    const txb = buildDonateTx(description, location, amountNumber);

    setLoading(true);
    setStatusMsg(null);
    setTxDigest(null);

    signAndExecute(
      {
        transactionBlock: txb,
        options: { showEffects: true },
      },
      {
        onSuccess: (res) => {
          setLoading(false);
          setTxDigest(res.digest ?? null);

          const chainStatus = (res as any)?.effects?.status?.status;
          const chainError = (res as any)?.effects?.status?.error;

          if (chainStatus === 'success') {
            setStatusMsg(
              `✅ Bağış zincirde başarıyla işlendi! Tx digest: ${
                res.digest ?? 'bilinmiyor'
              }`,
            );
          } else if (chainStatus === 'failure') {
            setStatusMsg(
              `❌ İşlem zincirde başarısız oldu: ${
                chainError ?? 'Bilinmeyen hata'
              }`,
            );
          } else {
            setStatusMsg(
              `ℹ️ İşlem gönderildi, ancak zincir durumu net değil. Tx digest: ${
                res.digest ?? 'bilinmiyor'
              }`,
            );
          }
        },
        onError: (err) => {
          setLoading(false);
          console.error(err);
          setStatusMsg(
            `❌ İşlem RPC / cüzdan aşamasında başarısız: ${
              (err as Error).message ?? String(err)
            }`,
          );
          alert('İşlem başarısız oldu, detay için konsola bak.');
        },
      },
    );
  };

  return (
    <div className="card donation-card">
      <h2>AidChain – Bağışçı Paneli</h2>

      {!account && (
        <p style={{ color: 'red' }}>
          Cüzdan bağlı değil. Yukarıdan <b>Connect</b> ile bağla.
        </p>
      )}

      {account && (
        <p>
          Bağlı adres: <code>{account.address}</code>
        </p>
      )}

      <label>
        Açıklama:
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      <label>
        Lokasyon:
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </label>

      <label>
        Bağış Tutarı (SUI):
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>

      <button onClick={handleDonate} disabled={loading || !account}>
        {loading ? 'İşlem gönderiliyor...' : 'Bağış Yap'}
      </button>

      {statusMsg && (
        <p style={{ marginTop: '0.5rem' }}>{statusMsg}</p>
      )}

      {txDigest && (
        <p>
          İşlemi Explorer’da görüntüle:{' '}
          <a
            href={`https://suiexplorer.com/txblock/${txDigest}?network=testnet`}
            target="_blank"
            rel="noreferrer"
          >
            {txDigest}
          </a>
        </p>
      )}
    </div>
  );
}

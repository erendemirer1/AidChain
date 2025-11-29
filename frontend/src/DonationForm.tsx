// src/DonationForm.tsx
import { useState } from 'react';
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from '@mysten/dapp-kit';
import { buildDonateTx } from './buildDonateTx';

export function DonationForm() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

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
        transaction: txb,
      },
      {
        onSuccess: (result: any) => {
          setLoading(false);
          console.log('Transaction result:', result);
          
          if (!result.digest) {
            setStatusMsg('❌ İşlem digest bilgisi alınamadı');
            return;
          }
          
          // ÖNEMLİ: Effects kontrolü - transaction gerçekten başarılı mı?
          const effects = result.effects;
          const executionStatus = effects?.status?.status;
          
          console.log('Execution status:', executionStatus);
          console.log('Full effects:', effects);
          
          setTxDigest(result.digest);
          
          // Transaction başarısız olduysa
          if (executionStatus === 'failure') {
            const errorMsg = effects?.status?.error || 'Bilinmeyen hata';
            console.error('Transaction failed:', errorMsg);
            
            // Yetersiz bakiye kontrolü
            if (errorMsg.includes('InsufficientCoinBalance') || 
                errorMsg.toLowerCase().includes('insufficient')) {
              setStatusMsg('❌ Yetersiz bakiye! Cüzdanınızda yeterli SUI yok.');
            } else {
              setStatusMsg(`❌ İşlem başarısız: ${errorMsg}`);
            }
            return;
          }
          
          // Transaction başarılı
          if (executionStatus === 'success') {
            setStatusMsg('✅ Bağış başarıyla blockchain\'e kaydedildi!');
          } else {
            // Status belirsiz
            setStatusMsg(`⚠️ İşlem durumu belirsiz. Tx: ${result.digest}`);
          }
        },
        onError: (err: any) => {
          setLoading(false);
          console.error('Transaction error:', err);
          
          let errorMessage = '❌ ';
          
          // Hata mesajını analiz et
          if (err?.message) {
            errorMessage += err.message;
          } else if (typeof err === 'string') {
            errorMessage += err;
          } else {
            errorMessage += 'İşlem başarısız oldu';
          }
          
          // Yetersiz bakiye kontrolü
          if (errorMessage.toLowerCase().includes('insufficient') || 
              errorMessage.toLowerCase().includes('balance')) {
            errorMessage = '❌ Yetersiz bakiye! Cüzdanınızda yeterli SUI yok.';
          }
          
          // Kullanıcı iptal etti
          if (errorMessage.toLowerCase().includes('rejected') || 
              errorMessage.toLowerCase().includes('cancelled')) {
            errorMessage = '❌ İşlem kullanıcı tarafından iptal edildi.';
          }
          
          // Gas ücreti yetersiz
          if (errorMessage.toLowerCase().includes('gas')) {
            errorMessage = '❌ Gas ücreti için yetersiz bakiye.';
          }
          
          setStatusMsg(errorMessage);
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

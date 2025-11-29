import { FormEvent, useState } from 'react';
import {
  ConnectButton,
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { CoordinatorPanel } from './CoordinatorPanel';

// ====== GÜNCELLEME: ESCROW SİSTEMİ ======
// Yeni Package (Escrow mekanizması ile)
const PACKAGE_ID =
  '0x7615b059d8fc726662be2280a8e336338c82730be2070972d61fa84906a08559';

// Yeni Registry ID (Escrow sistemi için)
const REGISTRY_ID =
  '0xe05fd6498b97b938df1b411b0ecd0e3c7784c5ed38e463e848f0ef1c9658c83e';

// Yeni registry'nin initial shared version
const REGISTRY_INITIAL_SHARED_VERSION = 668488928;

// Koordinatör adresi (aynı kalıyor)
const COORDINATOR =
  '0xa9778469f5de301ae6d149f8cabb73f76b6984f744479ea3b7e16562433bcf9a';

function DonationForm() {
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecuteTransaction, isPending } =
    useSignAndExecuteTransaction();

  const [status, setStatus] = useState<string>('');
  const [txDigest, setTxDigest] = useState<string | null>(null);

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
    setTxDigest(null);

    signAndExecuteTransaction(
      {
        transaction: tx,
        chain: 'sui:testnet',
      },
      {
        onSuccess: (result) => {
          console.log('Transaction result:', result);
          
          // Transaction digest kontrolü
          if (!result.digest) {
            setStatus('❌ İşlem digest bilgisi alınamadı');
            return;
          }

          // ÖNEMLİ: Effects kontrolü - transaction gerçekten başarılı mı?
          const effects = (result as any).effects;
          const executionStatus = effects?.status?.status;
          
          console.log('Execution status:', executionStatus);
          console.log('Full effects:', effects);
          
          // Transaction başarısız olduysa
          if (executionStatus === 'failure') {
            const errorMsg = effects?.status?.error || 'Bilinmeyen hata';
            console.error('Transaction failed:', errorMsg);
            
            // Yetersiz bakiye kontrolü
            if (errorMsg.includes('InsufficientCoinBalance') || 
                errorMsg.toLowerCase().includes('insufficient')) {
              setStatus('❌ Yetersiz bakiye! Cüzdanınızda yeterli SUI yok.');
            } else {
              setStatus(`❌ İşlem başarısız: ${errorMsg}`);
            }
            setTxDigest(result.digest); // Başarısız tx için de digest göster
            return;
          }

          // Transaction başarılı
          if (executionStatus === 'success') {
            setTxDigest(result.digest);
            setStatus('✅ Bağış başarıyla blockchain\'e kaydedildi!');
            form.reset();
          } else {
            // Status belirsiz
            setStatus(`⚠️ İşlem durumu belirsiz. Digest: ${result.digest}`);
            setTxDigest(result.digest);
          }
        },
        onError: (err: any) => {
          console.error('Bağış sırasında hata:', err);
          
          // Daha detaylı hata mesajları
          let errorMessage = '❌ ';
          
          if (err?.message) {
            errorMessage += err.message;
          } else if (typeof err === 'string') {
            errorMessage += err;
          } else {
            errorMessage += 'İşlem başarısız oldu';
          }
          
          // Yetersiz bakiye kontrolü
          if (errorMessage.includes('Insufficient') || 
              errorMessage.includes('insufficient') ||
              errorMessage.includes('balance')) {
            errorMessage = '❌ Yetersiz bakiye! Cüzdanınızda yeterli SUI yok.';
          }
          
          // Kullanıcı işlemi iptal etti
          if (errorMessage.includes('rejected') || 
              errorMessage.includes('cancelled') ||
              errorMessage.includes('User rejected')) {
            errorMessage = '❌ İşlem kullanıcı tarafından iptal edildi.';
          }
          
          setStatus(errorMessage);
        },
      },
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-icon">💝</div>
        <h2>Bağış Yap</h2>
      </div>

      {!currentAccount ? (
        <div className="alert alert-warning">
          <span>⚠️</span>
          <span>Bağış yapmak için önce cüzdanını bağlamalısın.</span>
        </div>
      ) : (
        <>
          <div className="account-info">
            <div className="account-avatar">
              {currentAccount.address.slice(2, 4).toUpperCase()}
            </div>
            <div className="account-details">
              <div className="account-label">Bağlı Cüzdan</div>
              <div className="account-address">{currentAccount.address}</div>
            </div>
          </div>

          <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
            <span>🔒</span>
            <div>
              <strong>Güvenli Escrow Sistemi</strong>
              <br />
              Bağışlar <strong>pakette kilitli kalır</strong> ve sadece teslim edildiğinde koordinatöre aktarılır.
              <br />
              <small style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                ✓ Şeffaf • ✓ Güvenli • ✓ Geri alınabilir (teslim edilmezse)
              </small>
            </div>
          </div>
        </>
      )}

      {currentAccount && (
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">
              Yardım Açıklaması
              <input
                className="form-input"
                name="description"
                placeholder="Örn: Gıda Paketi - Konserve + Su"
                required
              />
            </label>
          </div>

          <div className="form-group">
            <label className="form-label">
              Lokasyon
              <input
                className="form-input"
                name="location"
                placeholder="Örn: Hatay/Antakya"
                required
              />
            </label>
          </div>

          <div className="form-group">
            <label className="form-label">
              Bağış Miktarı (SUI)
              <input
                className="form-input"
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.1"
                required
              />
            </label>
          </div>

          <button 
            type="submit" 
            disabled={isPending}
            className="btn btn-primary btn-block"
          >
            {isPending && <span className="spinner"></span>}
            {isPending ? 'İşlem Gönderiliyor...' : '💰 Bağış Yap'}
          </button>
        </form>
      )}

      {status && (
        <div className={`alert ${status.includes('✅') ? 'alert-success' : status.includes('❌') ? 'alert-error' : 'alert-info'}`}>
          {status}
        </div>
      )}

      {txDigest && (
        <>
          <div className={`tx-link ${status.includes('❌') ? 'tx-link-error' : ''}`}>
            <span>{status.includes('❌') ? '⚠️' : '🔗'}</span>
            <div>
              <strong>{status.includes('❌') ? 'Başarısız İşlem Detayları' : 'İşlem Detayları'}</strong>
              <br />
              <a
                href={`https://testnet.suivision.xyz/txblock/${txDigest}`}
                target="_blank"
                rel="noreferrer"
              >
                SuiVision'da Görüntüle →
              </a>
            </div>
          </div>
          
          {!status.includes('❌') && (
            <div className="alert alert-success" style={{ marginTop: '1rem' }}>
              <span>🔒</span>
              <div>
                <strong>Escrow Aktif!</strong>
                <br />
                <small>
                  ✓ Bağışınız pakette güvenle saklanıyor
                  <br />
                  ✓ Sadece teslim edildiğinde koordinatöre aktarılacak
                  <br />
                  ✓ Teslim edilmezse geri alabilirsiniz
                </small>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function DonationApp() {
  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-header-left">
          <div className="app-logo">🔗</div>
          <div>
            <h1>AidChain</h1>
            <div className="app-subtitle">Blockchain Destekli Afet Yardım Sistemi</div>
          </div>
        </div>
        <div className="wallet-connect-wrapper">
          <ConnectButton />
        </div>
      </header>

      <main className="main-layout">
        <section>
          <DonationForm />
        </section>
        <section>
          <CoordinatorPanel />
        </section>
      </main>
    </div>
  );
}


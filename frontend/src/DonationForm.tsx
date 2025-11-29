// src/DonationForm.tsx
import { useState } from 'react';
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from '@mysten/dapp-kit';
import { buildDonateTx } from './buildDonateTx';
import { RecipientList } from './RecipientList';
import { useSponsoredTransaction } from './useSponsoredTransaction';
import { AIDCHAIN_PACKAGE_ID } from './config';

export function DonationForm() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { executeSponsored, isLoading: sponsoredLoading, isEnabled: sponsoredEnabled } = useSponsoredTransaction();

  const [description] = useState('Yardım Paketi');
  const [location] = useState('-');
  const [amount, setAmount] = useState('0.1'); // SUI
  const [selectedRecipient, setSelectedRecipient] = useState<string>('');
  const [selectedRecipientName, setSelectedRecipientName] = useState<string>('');
  const [selectedRecipientDescription, setSelectedRecipientDescription] = useState<string>('');
  const [showRecipientList, setShowRecipientList] = useState(false);
  const [txDigest, setTxDigest] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [useSponsored, setUseSponsored] = useState(true); // Default: sponsored aktif

  const handleRecipientSelect = (address: string, name: string, recipientDescription?: string) => {
    setSelectedRecipient(address);
    setSelectedRecipientName(name);
    setSelectedRecipientDescription(recipientDescription || '');
    setShowRecipientList(false);
  };

  const handleDonate = async () => {
    if (!account) {
      alert('Önce cüzdanını bağlamalısın.');
      return;
    }

    if (!selectedRecipient) {
      alert('Lütfen yardım alacak kişiyi seçin.');
      return;
    }

    const amountNumber = Number(amount);
    if (!amountNumber || amountNumber <= 0) {
      alert('Geçerli bir SUI miktarı gir.');
      return;
    }

    const txb = buildDonateTx(description, location, selectedRecipient, amountNumber);

    setLoading(true);
    setStatusMsg(null);
    setTxDigest(null);

    // Sponsored transaction kullan (eğer aktifse ve seçiliyse)
    if (useSponsored && sponsoredEnabled) {
      try {
        setStatusMsg('⛽ Gas ücretsiz işlem hazırlanıyor...');
        
        const result = await executeSponsored(txb, [
          `${AIDCHAIN_PACKAGE_ID}::aidchain::donate`,
        ]);

        setLoading(false);

        if (result.success) {
          setTxDigest(result.digest);
          setStatusMsg('🎉 Bağış başarılı! Gas ücreti sponsor tarafından ödendi.');
        } else {
          setStatusMsg(`İşlem başarısız: ${result.error}`);
        }
      } catch (err: any) {
        setLoading(false);
        setStatusMsg(`Sponsored işlem hatası: ${err.message}`);
      }
      return;
    }

    // Normal transaction (fallback)
    signAndExecute(
      {
        transaction: txb,
      },
      {
        onSuccess: (result: any) => {
          setLoading(false);
          console.log('Transaction result:', result);
          
          if (!result.digest) {
            setStatusMsg('İşlem digest bilgisi alınamadı');
            return;
          }
          
          const effects = result.effects;
          const executionStatus = effects?.status?.status;
          
          console.log('Execution status:', executionStatus);
          console.log('Full effects:', effects);
          
          setTxDigest(result.digest);
          
          if (executionStatus === 'failure') {
            const errorMsg = effects?.status?.error || 'Bilinmeyen hata';
            console.error('Transaction failed:', errorMsg);
            
            if (errorMsg.includes('InsufficientCoinBalance') || 
                errorMsg.toLowerCase().includes('insufficient')) {
              setStatusMsg('Yetersiz bakiye! Cüzdanınızda yeterli SUI yok.');
            } else {
              setStatusMsg(`İşlem başarısız: ${errorMsg}`);
            }
            return;
          }
          
          if (executionStatus === 'success') {
            setStatusMsg('Bağış başarıyla blockchain\'e kaydedildi!');
          } else {
            setStatusMsg(`İşlem durumu belirsiz. Tx: ${result.digest}`);
          }
        },
        onError: (err: any) => {
          setLoading(false);
          console.error('Transaction error:', err);
          
          let errorMessage = '';
          
          if (err?.message) {
            errorMessage += err.message;
          } else if (typeof err === 'string') {
            errorMessage += err;
          } else {
            errorMessage += 'İşlem başarısız oldu';
          }
          
          if (errorMessage.toLowerCase().includes('insufficient') || 
              errorMessage.toLowerCase().includes('balance')) {
            errorMessage = 'Yetersiz bakiye! Cüzdanınızda yeterli SUI yok.';
          }
          
          if (errorMessage.toLowerCase().includes('rejected') || 
              errorMessage.toLowerCase().includes('cancelled')) {
            errorMessage = 'İşlem kullanıcı tarafından iptal edildi.';
          }
          
          if (errorMessage.toLowerCase().includes('gas')) {
            errorMessage = 'Gas ücreti için yetersiz bakiye.';
          }
          
          setStatusMsg(errorMessage);
        },
      },
    );
  };

  const isProcessing = loading || sponsoredLoading;

  return (
    <div className="card donation-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>AidChain – Bağışçı Paneli</h2>
        {sponsoredEnabled && (
          <span style={{
            padding: '4px 10px',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: 'white',
            borderRadius: '20px',
            fontSize: '11px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            ⛽ GAS-FREE
          </span>
        )}
      </div>

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
        Bağış Tutarı (SUI):
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>

      {/* Sponsored Transaction Toggle */}
      {sponsoredEnabled && (
        <div style={{
          padding: '12px 16px',
          background: useSponsored 
            ? 'linear-gradient(135deg, #d1fae5, #a7f3d0)' 
            : '#f3f4f6',
          borderRadius: '12px',
          marginBottom: '16px',
          border: useSponsored ? '2px solid #10b981' : '2px solid #e5e7eb',
        }}>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={useSponsored}
              onChange={(e) => setUseSponsored(e.target.checked)}
              style={{ 
                width: '20px', 
                height: '20px',
                accentColor: '#10b981',
              }}
            />
            <div>
              <div style={{ fontWeight: '600', color: useSponsored ? '#065f46' : '#374151' }}>
                ⛽ Gas Ücretsiz İşlem
              </div>
              <div style={{ fontSize: '12px', color: useSponsored ? '#047857' : '#6b7280' }}>
                {useSponsored 
                  ? 'Aktif - Gas ücreti sponsor tarafından ödenecek' 
                  : 'Kapalı - Normal işlem yapılacak'}
              </div>
            </div>
          </label>
        </div>
      )}

      {/* Recipient Selection */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '10px', fontWeight: '500' }}>
          Yardım Alacak Kişi:
        </label>
        {selectedRecipientName ? (
          <div style={{
            padding: '15px',
            background: '#d4edda',
            border: '2px solid #28a745',
            borderRadius: '12px',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: selectedRecipientDescription ? '12px' : 0,
            }}>
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                  {selectedRecipientName}
                </div>
                <div style={{ fontSize: '12px', color: '#155724' }}>
                  {selectedRecipient.slice(0, 8)}...{selectedRecipient.slice(-6)}
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedRecipient('');
                  setSelectedRecipientName('');
                  setSelectedRecipientDescription('');
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#dc3545',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Degistir
              </button>
            </div>
            {selectedRecipientDescription && (
              <div style={{
                padding: '10px 12px',
                background: '#c3e6cb',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#155724',
                lineHeight: '1.5',
              }}>
                <strong>Durumu:</strong> {selectedRecipientDescription}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowRecipientList(true)}
            style={{
              width: '100%',
              padding: '15px',
              borderRadius: '12px',
              border: '2px dashed #667eea',
              background: 'white',
              color: '#667eea',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '500',
            }}
          >
            Alıcı Seç
          </button>
        )}
      </div>

      {/* Recipient List Modal */}
      {showRecipientList && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '80vh',
            overflow: 'auto',
            padding: '20px',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
            }}>
              <h2 style={{ margin: 0 }}>Alıcı Seçin</h2>
              <button
                onClick={() => setShowRecipientList(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#dc3545',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '16px',
                }}
              >
                ✕
              </button>
            </div>
            <RecipientList 
              onSelectRecipient={handleRecipientSelect}
              showVerifiedOnly={true}
            />
          </div>
        </div>
      )}

      <button 
        onClick={handleDonate} 
        disabled={isProcessing || !account}
        style={{
          background: useSponsored && sponsoredEnabled 
            ? 'linear-gradient(135deg, #10b981, #059669)' 
            : undefined,
        }}
      >
        {isProcessing 
          ? (useSponsored && sponsoredEnabled ? '⛽ Gas-Free işlem...' : 'İşlem gönderiliyor...') 
          : (useSponsored && sponsoredEnabled ? '⛽ Gas-Free Bağış Yap' : 'Bağış Yap')}
      </button>

      {statusMsg && (
        <p style={{ 
          marginTop: '0.5rem',
          padding: '12px',
          borderRadius: '8px',
          background: statusMsg.includes('başarı') || statusMsg.includes('🎉') 
            ? '#d1fae5' 
            : statusMsg.includes('hazırlanıyor') 
              ? '#dbeafe' 
              : '#fee2e2',
          color: statusMsg.includes('başarı') || statusMsg.includes('🎉') 
            ? '#065f46' 
            : statusMsg.includes('hazırlanıyor') 
              ? '#1e40af' 
              : '#991b1b',
        }}>
          {statusMsg}
        </p>
      )}

      {txDigest && (
        <p>
          İşlemi Explorer'da görüntüle:{' '}
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

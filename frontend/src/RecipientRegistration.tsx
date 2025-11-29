import { useState } from 'react';
import { useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { AIDCHAIN_PACKAGE_ID, AIDCHAIN_REGISTRY_ID, REGISTRY_INITIAL_SHARED_VERSION } from './config';

export function RecipientRegistration() {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [needCategory, setNeedCategory] = useState('Gıda');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const client = useSuiClient();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !location) {
      setMessage('⚠️ Lütfen tüm alanları doldurun!');
      return;
    }

    setIsSubmitting(true);
    setMessage('');

    try {
      const txb = new Transaction();
      
      txb.moveCall({
        target: `${AIDCHAIN_PACKAGE_ID}::aidchain::register_recipient`,
        arguments: [
          txb.sharedObjectRef({
            objectId: AIDCHAIN_REGISTRY_ID,
            initialSharedVersion: REGISTRY_INITIAL_SHARED_VERSION,
            mutable: true,
          }),
          txb.pure.string(name),
          txb.pure.string(location),
          txb.pure.string(needCategory),
        ],
      });

      signAndExecute(
        {
          transaction: txb,
        },
        {
          onSuccess: async (result) => {
            const status = await client.waitForTransaction({
              digest: result.digest,
              options: {
                showEffects: true,
              },
            });

            if (status.effects?.status?.status === 'success') {
              setMessage('✅ Kayıt başarılı! STK onayı bekleniyor...');
              setName('');
              setLocation('');
              setNeedCategory('Gıda');
            } else {
              setMessage('❌ Kayıt başarısız oldu');
            }
          },
          onError: (error) => {
            console.error('Registration error:', error);
            setMessage(`❌ Hata: ${error.message}`);
          },
        }
      );
    } catch (error) {
      console.error('Transaction build error:', error);
      setMessage(`❌ İşlem hatası: ${(error as Error).message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card">
      <h2>Yardım Alıcısı Kaydı</h2>

      <form onSubmit={handleRegister}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
            İsim Soyisim
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Örn: Ahmet Yılmaz"
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              border: '2px solid #ddd',
              fontSize: '14px',
            }}
            disabled={isSubmitting}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
            Konum
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Örn: Hatay, Antakya"
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              border: '2px solid #ddd',
              fontSize: '14px',
            }}
            disabled={isSubmitting}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
            İhtiyaç Kategorisi
          </label>
          <select
            value={needCategory}
            onChange={(e) => setNeedCategory(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              border: '2px solid #ddd',
              fontSize: '14px',
            }}
            disabled={isSubmitting}
          >
            <option value="Gıda">Gıda</option>
            <option value="Giyim">Giyim</option>
            <option value="Barınma">Barınma</option>
            <option value="Sağlık">Sağlık</option>
            <option value="Eğitim">Eğitim</option>
            <option value="Diğer">Diğer</option>
          </select>
        </div>

        <button
          type="submit"
          className="action-button"
          disabled={isSubmitting}
          style={{
            width: '100%',
            opacity: isSubmitting ? 0.6 : 1,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
          }}
        >
          {isSubmitting ? 'Kaydediliyor...' : 'Kayıt Ol'}
        </button>

        {message && (
          <div style={{
            marginTop: '15px',
            padding: '12px',
            borderRadius: '8px',
            background: message.includes('✅') ? '#d4edda' : '#f8d7da',
            color: message.includes('✅') ? '#155724' : '#721c24',
            border: `1px solid ${message.includes('✅') ? '#c3e6cb' : '#f5c6cb'}`,
            fontSize: '14px',
          }}>
            {message}
          </div>
        )}
      </form>
    </div>
  );
}

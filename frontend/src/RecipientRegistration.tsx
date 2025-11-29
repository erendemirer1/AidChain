import { useState } from 'react';
import { useSignAndExecuteTransaction, useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { 
  AIDCHAIN_PACKAGE_ID, 
  AIDCHAIN_REGISTRY_ID, 
  REGISTRY_INITIAL_SHARED_VERSION,
  WALRUS_PUBLISHER_URL 
} from './config';

export function RecipientRegistration() {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [tcNo, setTcNo] = useState('');
  const [phone, setPhone] = useState('');
  const [familySize, setFamilySize] = useState('1');
  const [description, setDescription] = useState('');
  const [residenceFile, setResidenceFile] = useState<File | null>(null);
  const [incomeFile, setIncomeFile] = useState<File | null>(null);
  const [extraDocumentFile, setExtraDocumentFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [message, setMessage] = useState('');
  
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const client = useSuiClient();
  const currentAccount = useCurrentAccount();

  const hashTC = async (tc: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(tc);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const uploadToWalrus = async (file: File, label: string): Promise<string> => {
    setUploadProgress(`${label} Walrus'a yükleniyor...`);
    
    try {
      const response = await fetch(`${WALRUS_PUBLISHER_URL}/v1/blobs`, {
        method: 'PUT',
        body: file,
      });

      if (!response.ok) {
        throw new Error(`${label} yükleme hatası`);
      }

      const result = await response.json();
      const blobId = result.newlyCreated?.blobObject?.blobId || result.alreadyCertified?.blobId || '';
      
      return blobId;
    } catch (error) {
      console.error(`Walrus upload error (${label}):`, error);
      throw error;
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentAccount) {
      setMessage('Lütfen önce cüzdanınızı bağlayın');
      return;
    }

    if (!name || !location || !tcNo || !phone) {
      setMessage('Lütfen tüm zorunlu alanları doldurun');
      return;
    }

    if (tcNo.length !== 11 || !/^\d+$/.test(tcNo)) {
      setMessage('TC Kimlik numarası 11 haneli olmalıdır');
      return;
    }

    if (phone.length < 10) {
      setMessage('Geçerli bir telefon numarası girin');
      return;
    }

    if (!residenceFile) {
      setMessage('İkametgah belgesi yüklemek zorunludur');
      return;
    }

    if (!incomeFile) {
      setMessage('Gelir belgesi yüklemek zorunludur');
      return;
    }

    setIsSubmitting(true);
    setMessage('');

    try {
      setUploadProgress('TC Kimlik hashleniyor...');
      const tcHash = await hashTC(tcNo);

      const residenceBlobId = await uploadToWalrus(residenceFile, 'İkametgah belgesi');
      const incomeBlobId = await uploadToWalrus(incomeFile, 'Gelir belgesi');
      
      // Ekstra belge opsiyonel - varsa yükle, yoksa boş string
      let extraDocumentBlobId = '';
      if (extraDocumentFile) {
        extraDocumentBlobId = await uploadToWalrus(extraDocumentFile, 'Ekstra belge');
      }

      setUploadProgress('Blockchain kaydediliyor...');

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
          txb.pure.string(tcHash),
          txb.pure.string(phone),
          txb.pure.string(residenceBlobId),
          txb.pure.string(incomeBlobId),
          txb.pure.string(extraDocumentBlobId),
          txb.pure.u64(parseInt(familySize) || 1),
          txb.pure.string(description),
        ],
      });

      signAndExecute(
        { transaction: txb },
        {
          onSuccess: async (result) => {
            const status = await client.waitForTransaction({
              digest: result.digest,
              options: { showEffects: true },
            });

            if (status.effects?.status?.status === 'success') {
              setMessage('Kayıt başarılı! STK onayı bekleniyor...');
              setName('');
              setLocation('');
              setTcNo('');
              setPhone('');
              setFamilySize('1');
              setDescription('');
              setResidenceFile(null);
              setIncomeFile(null);
              setExtraDocumentFile(null);
              setUploadProgress('');
            } else {
              const errorMsg = status.effects?.status?.error || 'Bilinmeyen hata';
              if (errorMsg.includes('23') || errorMsg.includes('E_ADMIN_CANNOT_REGISTER')) {
                setMessage('Admin/STK üyeleri yardım başvurusu yapamaz');
              } else {
                setMessage(`Kayıt başarısız: ${errorMsg}`);
              }
            }
          },
          onError: (error) => {
            if (error.message.includes('23')) {
              setMessage('Admin/STK üyeleri yardım başvurusu yapamaz');
            } else {
              setMessage(`Hata: ${error.message}`);
            }
          },
        }
      );
    } catch (error) {
      setMessage(`İşlem hatası: ${(error as Error).message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card">
      <h2>Yardım Başvurusu</h2>
      
      <p style={{ color: '#64748b', marginBottom: '24px', fontSize: '14px' }}>
        Yardım almak için aşağıdaki formu doldurun. Bilgileriniz STK tarafından doğrulandıktan sonra bağış alabilirsiniz.
      </p>

      <div style={{ 
        padding: '12px 16px', 
        background: '#fef3c7', 
        borderRadius: '8px', 
        marginBottom: '20px',
        fontSize: '13px',
        color: '#92400e',
        border: '1px solid #fcd34d',
      }}>
        <strong>Not:</strong> Admin ve STK üyeleri yardım başvurusu yapamaz.
      </div>

      <form onSubmit={handleRegister}>
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '16px', color: '#334155' }}>Kişisel Bilgiler</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
                Ad Soyad *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ahmet Yılmaz"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
                Telefon *
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05XX XXX XX XX"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
              TC Kimlik No *
            </label>
            <input
              type="text"
              value={tcNo}
              onChange={(e) => setTcNo(e.target.value.replace(/\D/g, '').slice(0, 11))}
              placeholder="11 haneli TC Kimlik numaranız"
              maxLength={11}
              disabled={isSubmitting}
            />
            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
              TC Kimlik numaranız gizlilik için hashlenerek saklanır
            </p>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '16px', color: '#334155' }}>Konum ve Aile Bilgileri</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
                Konum *
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="İl, İlçe"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
                Aile Büyüklüğü
              </label>
              <input
                type="number"
                value={familySize}
                onChange={(e) => setFamilySize(e.target.value)}
                min="1"
                max="20"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
              Durum Açıklaması
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Durumunuzu kısaca açıklayın (hasar durumu, özel ihtiyaçlar vb.)"
              disabled={isSubmitting}
              rows={3}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '16px', color: '#334155' }}>Gerekli Belgeler</h3>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>
              📄 İkametgah Belgesi * (e-Devlet'ten alınabilir)
            </label>
            <div style={{ 
              border: '2px dashed #e2e8f0', 
              borderRadius: '12px', 
              padding: '20px',
              textAlign: 'center',
              background: residenceFile ? '#f0fdf4' : '#f8fafc',
              borderColor: residenceFile ? '#86efac' : '#e2e8f0',
            }}>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setResidenceFile(e.target.files?.[0] || null)}
                disabled={isSubmitting}
                style={{ display: 'none' }}
                id="residence-upload"
              />
              <label 
                htmlFor="residence-upload" 
                style={{ cursor: isSubmitting ? 'not-allowed' : 'pointer', display: 'block' }}
              >
                {residenceFile ? (
                  <div>
                    <div style={{ fontSize: '14px', color: '#059669', fontWeight: '500' }}>
                      {residenceFile.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                      {(residenceFile.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '14px', color: '#64748b' }}>
                      İkametgah belgenizi yükleyin
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                      PNG, JPG, PDF (max 10MB)
                    </div>
                  </div>
                )}
              </label>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>
              Gelir Belgesi * (Maaş bordrosu, SGK dökümü vb.)
            </label>
            <div style={{ 
              border: '2px dashed #e2e8f0', 
              borderRadius: '12px', 
              padding: '20px',
              textAlign: 'center',
              background: incomeFile ? '#f0fdf4' : '#f8fafc',
              borderColor: incomeFile ? '#86efac' : '#e2e8f0',
            }}>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setIncomeFile(e.target.files?.[0] || null)}
                disabled={isSubmitting}
                style={{ display: 'none' }}
                id="income-upload"
              />
              <label 
                htmlFor="income-upload" 
                style={{ cursor: isSubmitting ? 'not-allowed' : 'pointer', display: 'block' }}
              >
                {incomeFile ? (
                  <div>
                    <div style={{ fontSize: '14px', color: '#059669', fontWeight: '500' }}>
                      {incomeFile.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                      {(incomeFile.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '14px', color: '#64748b' }}>
                      Gelir belgenizi yükleyin
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                      PNG, JPG, PDF (max 10MB)
                    </div>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Ekstra Belge (Opsiyonel) */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>
              Ekstra Belge (Opsiyonel - Saglik raporu, engellilik belgesi vb.)
            </label>
            <div style={{ 
              border: '2px dashed #e2e8f0', 
              borderRadius: '12px', 
              padding: '20px',
              textAlign: 'center',
              background: extraDocumentFile ? '#eff6ff' : '#f8fafc',
              borderColor: extraDocumentFile ? '#93c5fd' : '#e2e8f0',
            }}>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setExtraDocumentFile(e.target.files?.[0] || null)}
                disabled={isSubmitting}
                style={{ display: 'none' }}
                id="extra-upload"
              />
              <label 
                htmlFor="extra-upload" 
                style={{ cursor: isSubmitting ? 'not-allowed' : 'pointer', display: 'block' }}
              >
                {extraDocumentFile ? (
                  <div>
                    <div style={{ fontSize: '14px', color: '#2563eb', fontWeight: '500' }}>
                      {extraDocumentFile.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                      {(extraDocumentFile.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '14px', color: '#64748b' }}>
                      Ek belge yukleyin (opsiyonel)
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                      Saglik raporu, engellilik belgesi, sosyal yardım kararı vb.
                    </div>
                  </div>
                )}
              </label>
            </div>
          </div>

          <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '12px' }}>
            Belgeleriniz Walrus decentralized storage'a yuklenir ve STK tarafindan incelenir.
          </p>
        </div>

        {uploadProgress && (
          <div style={{ 
            padding: '12px 16px', 
            background: '#f1f5f9', 
            borderRadius: '8px', 
            marginBottom: '16px',
            fontSize: '14px',
            color: '#475569',
          }}>
            ⏳ {uploadProgress}
          </div>
        )}

        {message && (
          <div className={`message ${message.includes('başarılı') ? 'message-success' : 'message-error'}`}>
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !currentAccount}
          className="btn-primary"
          style={{ width: '100%', padding: '14px' }}
        >
          {!currentAccount ? 'Önce Cüzdan Bağlayın' : isSubmitting ? 'Kaydediliyor...' : 'Başvuru Yap'}
        </button>
      </form>
    </div>
  );
}

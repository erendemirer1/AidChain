import { useState } from 'react';
import { useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
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
  const [needCategory, setNeedCategory] = useState('Gıda');
  const [tcNo, setTcNo] = useState('');
  const [phone, setPhone] = useState('');
  const [familySize, setFamilySize] = useState('1');
  const [description, setDescription] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [message, setMessage] = useState('');
  
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const client = useSuiClient();

  // TC Kimlik hash fonksiyonu (SHA-256)
  const hashTC = async (tc: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(tc);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // Walrus'a dosya yükleme
  const uploadToWalrus = async (file: File): Promise<string> => {
    setUploadProgress('Dosya Walrus\'a yükleniyor...');
    
    try {
      const response = await fetch(`${WALRUS_PUBLISHER_URL}/v1/blobs`, {
        method: 'PUT',
        body: file,
      });

      if (!response.ok) {
        throw new Error('Walrus yükleme hatası');
      }

      const result = await response.json();
      // Walrus response format: { newlyCreated: { blobId: "..." } } or { alreadyCertified: { blobId: "..." } }
      const blobId = result.newlyCreated?.blobObject?.blobId || result.alreadyCertified?.blobId || '';
      
      setUploadProgress('Yükleme tamamlandı');
      return blobId;
    } catch (error) {
      console.error('Walrus upload error:', error);
      setUploadProgress('Yükleme başarısız');
      return '';
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
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

    setIsSubmitting(true);
    setMessage('');

    try {
      // 1. TC Kimlik hash'le (gizlilik için)
      setUploadProgress('TC Kimlik hash\'leniyor...');
      const tcHash = await hashTC(tcNo);

      // 2. Kanıt fotoğrafını Walrus'a yükle (varsa)
      let evidenceBlobId = '';
      if (evidenceFile) {
        evidenceBlobId = await uploadToWalrus(evidenceFile);
      }

      setUploadProgress('Blockchain\'e kaydediliyor...');

      // 3. Smart contract'a kaydet
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
          txb.pure.string(tcHash),
          txb.pure.string(phone),
          txb.pure.string(evidenceBlobId),
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
              // Reset form
              setName('');
              setLocation('');
              setNeedCategory('Gıda');
              setTcNo('');
              setPhone('');
              setFamilySize('1');
              setDescription('');
              setEvidenceFile(null);
              setUploadProgress('');
            } else {
              setMessage('Kayıt başarısız oldu');
            }
          },
          onError: (error) => {
            setMessage(`Hata: ${error.message}`);
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

      <form onSubmit={handleRegister}>
        {/* Kişisel Bilgiler */}
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
              TC Kimlik numaranız gizlilik için hash'lenerek saklanır
            </p>
          </div>
        </div>

        {/* Konum ve İhtiyaç */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '16px', color: '#334155' }}>Konum ve İhtiyaç</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
                İhtiyaç Kategorisi
              </label>
              <select
                value={needCategory}
                onChange={(e) => setNeedCategory(e.target.value)}
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
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginTop: '16px' }}>
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

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
                Durum Açıklaması
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Kısa açıklama (hasar durumu, özel ihtiyaçlar vb.)"
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>

        {/* Kanıt Yükleme */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '16px', color: '#334155' }}>Kanıt Belgesi</h3>
          
          <div style={{ 
            border: '2px dashed #e2e8f0', 
            borderRadius: '12px', 
            padding: '24px',
            textAlign: 'center',
            background: '#f8fafc',
          }}>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
              disabled={isSubmitting}
              style={{ display: 'none' }}
              id="evidence-upload"
            />
            <label 
              htmlFor="evidence-upload" 
              style={{ 
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'block',
              }}
            >
              {evidenceFile ? (
                <div>
                  <div style={{ fontSize: '14px', color: '#059669', fontWeight: '500' }}>
                    {evidenceFile.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                    {(evidenceFile.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '14px', color: '#64748b' }}>
                    Hasar fotoğrafı veya belge yükleyin
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                    PNG, JPG (max 10MB) - Walrus'a yüklenir
                  </div>
                </div>
              )}
            </label>
          </div>
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
            {uploadProgress}
          </div>
        )}

        {message && (
          <div className={`message ${message.includes('başarılı') ? 'message-success' : 'message-error'}`}>
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary"
          style={{ width: '100%', padding: '14px' }}
        >
          {isSubmitting ? 'Kaydediliyor...' : 'Başvuru Yap'}
        </button>
      </form>
    </div>
  );
}

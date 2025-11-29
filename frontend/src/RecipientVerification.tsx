import { useState, useEffect } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { 
  AIDCHAIN_PACKAGE_ID, 
  AIDCHAIN_REGISTRY_ID, 
  REGISTRY_INITIAL_SHARED_VERSION,
  WALRUS_AGGREGATOR_URL 
} from './config';

interface RecipientProfile {
  id: string;
  owner: string;
  name: string;
  location: string;
  needCategory: string;
  isVerified: boolean;
  registeredAtEpoch: string;
  phone: string;
  familySize: number;
  description: string;
  evidenceBlobId: string;
}

export function RecipientVerification() {
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const client = useSuiClient();
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [unverifiedRecipients, setUnverifiedRecipients] = useState<RecipientProfile[]>([]);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [registryAdmin, setRegistryAdmin] = useState<string | null>(null);
  const [creatingRegistry, setCreatingRegistry] = useState(false);

  // Admin'i blockchain'den oku
  useEffect(() => {
    const loadAdmin = async () => {
      try {
        const registryObj = await client.getObject({
          id: AIDCHAIN_REGISTRY_ID,
          options: { showContent: true },
        });
        if (registryObj.data?.content?.dataType === 'moveObject') {
          const fields = registryObj.data.content.fields as any;
          setRegistryAdmin(fields.admin);
        }
      } catch (err) {
        console.error('Error loading registry admin:', err);
      }
    };
    loadAdmin();
  }, [client]);

  const isCoordinator = registryAdmin && currentAccount?.address.toLowerCase() === registryAdmin.toLowerCase();

  useEffect(() => {
    if (currentAccount && isCoordinator) {
      loadUnverifiedRecipients();
    }
  }, [currentAccount, isCoordinator]);

  const loadUnverifiedRecipients = async () => {
    setLoading(true);
    try {
      const registryObj = await client.getObject({
        id: AIDCHAIN_REGISTRY_ID,
        options: { showContent: true },
      });

      if (registryObj.data?.content?.dataType === 'moveObject') {
        const fields = registryObj.data.content.fields as any;
        const profileIds = fields.recipient_profiles || [];

        const profilePromises = profileIds.map(async (profileId: string) => {
          try {
            const profileObj = await client.getObject({
              id: profileId,
              options: { showContent: true, showOwner: true },
            });

            if (profileObj.data?.content?.dataType === 'moveObject') {
              const f = profileObj.data.content.fields as any;
              const owner = profileObj.data.owner;

              if (!f.is_verified) {
                return {
                  id: profileId,
                  owner: typeof owner === 'object' && 'AddressOwner' in owner ? owner.AddressOwner : 'Unknown',
                  name: f.name,
                  location: f.location,
                  needCategory: f.need_category,
                  isVerified: f.is_verified,
                  registeredAtEpoch: f.registered_at_epoch,
                  phone: f.phone || '',
                  familySize: parseInt(f.family_size) || 1,
                  description: f.description || '',
                  evidenceBlobId: f.evidence_blob_id || '',
                };
              }
            }
          } catch (err) {
            console.error(`Error loading profile ${profileId}:`, err);
          }
          return null;
        });

        const profiles = (await Promise.all(profilePromises)).filter(
          (p): p is RecipientProfile => p !== null
        );
        setUnverifiedRecipients(profiles);
      }
    } catch (err) {
      console.error('Error loading recipients:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRegistry = async () => {
    if (!currentAccount) return;
    
    setCreatingRegistry(true);
    setMessage('');

    try {
      const txb = new Transaction();
      txb.moveCall({
        target: `${AIDCHAIN_PACKAGE_ID}::aidchain::init_registry`,
      });

      signAndExecute(
        { transaction: txb },
        {
          onSuccess: async (result) => {
            const status = await client.waitForTransaction({
              digest: result.digest,
              options: { showEffects: true, showObjectChanges: true },
            });

            if (status.effects?.status?.status === 'success') {
              // Yeni registry ID'yi bul
              const created = status.objectChanges?.find(
                (c: any) => c.type === 'created' && c.objectType?.includes('AidRegistry')
              );
              if (created && 'objectId' in created) {
                setMessage(`Yeni Registry oluşturuldu! ID: ${created.objectId} - config.ts'yi güncelle!`);
              } else {
                setMessage('Registry oluşturuldu!');
              }
            } else {
              setMessage('İşlem başarısız');
            }
          },
          onError: (error) => {
            setMessage(`Hata: ${error.message}`);
          },
        }
      );
    } catch (error) {
      setMessage(`Hata: ${(error as Error).message}`);
    } finally {
      setCreatingRegistry(false);
    }
  };

  const handleVerify = async (profileId: string, name: string) => {
    setVerifying(profileId);
    setMessage('');

    try {
      const txb = new Transaction();
      
      txb.moveCall({
        target: `${AIDCHAIN_PACKAGE_ID}::aidchain::verify_recipient`,
        arguments: [
          txb.sharedObjectRef({
            objectId: AIDCHAIN_REGISTRY_ID,
            initialSharedVersion: REGISTRY_INITIAL_SHARED_VERSION,
            mutable: true,
          }),
          txb.object(profileId),
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
              setMessage(`${name} onaylandı`);
              loadUnverifiedRecipients();
            } else {
              setMessage('İşlem başarısız');
            }
          },
          onError: (error) => {
            setMessage(`Hata: ${error.message}`);
          },
        }
      );
    } catch (error) {
      setMessage(`Hata: ${(error as Error).message}`);
    } finally {
      setVerifying(null);
    }
  };

  const getWalrusUrl = (blobId: string) => {
    return `${WALRUS_AGGREGATOR_URL}/v1/blobs/${blobId}`;
  };

  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (!isCoordinator) {
    return (
      <div className="card">
        <h2>Onay Paneli</h2>
        
        <div style={{ 
          padding: '20px', 
          background: '#fef3c7', 
          borderRadius: '12px', 
          marginBottom: '20px',
          border: '1px solid #fcd34d',
        }}>
          <div style={{ fontWeight: '600', color: '#92400e', marginBottom: '8px' }}>
            Yetkisiz Erişim
          </div>
          <div style={{ fontSize: '14px', color: '#78350f', marginBottom: '12px' }}>
            Bu paneli kullanmak için registry admin'i olmanız gerekiyor.
          </div>
          
          {registryAdmin && (
            <div style={{ fontSize: '13px', color: '#92400e', marginBottom: '8px' }}>
              Mevcut Admin: <code style={{ background: '#fde68a', padding: '2px 6px', borderRadius: '4px' }}>{shortenAddress(registryAdmin)}</code>
            </div>
          )}
          
          {currentAccount && (
            <div style={{ fontSize: '13px', color: '#92400e' }}>
              Sizin Adresiniz: <code style={{ background: '#fde68a', padding: '2px 6px', borderRadius: '4px' }}>{shortenAddress(currentAccount.address)}</code>
            </div>
          )}
        </div>

        <div style={{ 
          padding: '20px', 
          background: '#f0fdf4', 
          borderRadius: '12px',
          border: '1px solid #86efac',
        }}>
          <div style={{ fontWeight: '600', color: '#166534', marginBottom: '8px' }}>
            Kendi Registry'nizi Oluşturun
          </div>
          <div style={{ fontSize: '14px', color: '#15803d', marginBottom: '16px' }}>
            Yeni bir registry oluşturarak admin olabilirsiniz. Sonra config.ts'yi güncellemeniz gerekecek.
          </div>
          
          {message && (
            <div style={{ 
              padding: '12px', 
              background: message.includes('oluşturuldu') ? '#dcfce7' : '#fee2e2', 
              borderRadius: '8px', 
              marginBottom: '12px',
              fontSize: '13px',
              wordBreak: 'break-all',
            }}>
              {message}
            </div>
          )}
          
          <button
            onClick={handleCreateRegistry}
            disabled={creatingRegistry || !currentAccount}
            style={{
              width: '100%',
              padding: '14px',
              background: '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: creatingRegistry ? 'not-allowed' : 'pointer',
              opacity: creatingRegistry ? 0.7 : 1,
            }}
          >
            {creatingRegistry ? 'Oluşturuluyor...' : 'Yeni Registry Oluştur'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0 }}>Onay Bekleyen Başvurular</h2>
        <button onClick={loadUnverifiedRecipients} className="btn-primary" style={{ padding: '10px 20px' }}>
          Yenile
        </button>
      </div>

      {message && (
        <div className={`message ${message.includes('onaylandı') ? 'message-success' : 'message-error'}`}>
          {message}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#718096' }}>
          Yükleniyor...
        </div>
      ) : unverifiedRecipients.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#718096' }}>
          Onay bekleyen başvuru bulunmuyor
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {unverifiedRecipients.map((recipient) => (
            <div 
              key={recipient.id} 
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                overflow: 'hidden',
                background: '#fff',
              }}
            >
              {/* Header */}
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid #f3f4f6',
                background: '#fafafa',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '16px', color: '#111827' }}>
                    {recipient.name}
                  </div>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>
                    {recipient.location}
                  </div>
                </div>
                <div style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '600',
                  background: '#fef3c7',
                  color: '#92400e',
                }}>
                  Onay Bekliyor
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: '20px' }}>
                {/* Info Grid */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr 1fr', 
                  gap: '12px',
                  marginBottom: '16px',
                }}>
                  <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px', textTransform: 'uppercase' }}>
                      Kategori
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                      {recipient.needCategory}
                    </div>
                  </div>
                  <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px', textTransform: 'uppercase' }}>
                      Telefon
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                      {recipient.phone || '-'}
                    </div>
                  </div>
                  <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px', textTransform: 'uppercase' }}>
                      Aile Büyüklüğü
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                      {recipient.familySize} kişi
                    </div>
                  </div>
                </div>

                {/* Description */}
                {recipient.description && (
                  <div style={{ 
                    padding: '12px 16px', 
                    background: '#f8fafc', 
                    borderRadius: '8px',
                    marginBottom: '16px',
                  }}>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px', textTransform: 'uppercase' }}>
                      Açıklama
                    </div>
                    <div style={{ fontSize: '14px', color: '#374151' }}>
                      {recipient.description}
                    </div>
                  </div>
                )}

                {/* Evidence Photo */}
                {recipient.evidenceBlobId && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '8px', textTransform: 'uppercase' }}>
                      Kanıt Belgesi (Walrus)
                    </div>
                    <a
                      href={getWalrusUrl(recipient.evidenceBlobId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'block',
                        padding: '12px 16px',
                        background: '#f1f5f9',
                        borderRadius: '8px',
                        color: '#475569',
                        textDecoration: 'none',
                        fontSize: '13px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: '500', color: '#334155' }}>Fotoğrafı Görüntüle</div>
                          <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#94a3b8', marginTop: '2px' }}>
                            {recipient.evidenceBlobId.slice(0, 20)}...
                          </div>
                        </div>
                        <span>→</span>
                      </div>
                    </a>
                  </div>
                )}

                {/* Approve Button */}
                <button
                  onClick={() => handleVerify(recipient.id, recipient.name)}
                  disabled={verifying === recipient.id}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: '#059669',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: verifying === recipient.id ? 'not-allowed' : 'pointer',
                    opacity: verifying === recipient.id ? 0.7 : 1,
                  }}
                >
                  {verifying === recipient.id ? 'Onaylanıyor...' : 'Onayla'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

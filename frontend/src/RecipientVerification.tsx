import { useState, useEffect } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useSuiClient } from '@mysten/dapp-kit';
import { AIDCHAIN_PACKAGE_ID, AIDCHAIN_REGISTRY_ID, REGISTRY_INITIAL_SHARED_VERSION } from './config';

interface RecipientProfile {
  id: string;
  owner: string;
  name: string;
  location: string;
  needCategory: string;
  isVerified: boolean;
  registeredAtEpoch: string;
}

const COORDINATOR_ADDRESS = '0x114aa1f7c47970c88eaafac9c127f9ee9fbb91047fa04426f66a26d62034a813';

export function RecipientVerification() {
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const client = useSuiClient();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [unverifiedRecipients, setUnverifiedRecipients] = useState<RecipientProfile[]>([]);
  const [verifying, setVerifying] = useState<string | null>(null);

  const isCoordinator = currentAccount?.address.toLowerCase() === COORDINATOR_ADDRESS.toLowerCase();

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
              const profileFields = profileObj.data.content.fields as any;
              const owner = profileObj.data.owner;

              if (!profileFields.is_verified) {
                return {
                  id: profileId,
                  owner: typeof owner === 'object' && 'AddressOwner' in owner ? owner.AddressOwner : 'Unknown',
                  name: profileFields.name,
                  location: profileFields.location,
                  needCategory: profileFields.need_category,
                  isVerified: profileFields.is_verified,
                  registeredAtEpoch: profileFields.registered_at_epoch,
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
      console.error('Error loading unverified recipients:', err);
    } finally {
      setLoading(false);
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
              setMessage(`${name} onaylandı!`);
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

  if (!isCoordinator) {
    return (
      <div className="card">
        <h2>Onay Paneli</h2>
        <div className="message message-error">
          Bu işlem için yetkiniz yok.
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Onay Paneli</h2>

      {message && (
        <div className={`message ${message.includes('onaylandı') ? 'message-success' : 'message-error'}`}>
          {message}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>Yükleniyor...</p>
        </div>
      ) : unverifiedRecipients.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
          Onay bekleyen alıcı bulunmuyor
        </div>
      ) : (
        <div>
          {unverifiedRecipients.map((recipient) => (
            <div key={recipient.id} className="package-card">
              <div style={{ marginBottom: '12px' }}>
                <strong style={{ fontSize: '18px' }}>{recipient.name}</strong>
              </div>
              <div style={{ fontSize: '14px', color: '#718096', marginBottom: '8px' }}>
                {recipient.location}
              </div>
              <div style={{ fontSize: '14px', marginBottom: '16px' }}>
                <span className="badge badge-warning">{recipient.needCategory}</span>
              </div>
              <button
                onClick={() => handleVerify(recipient.id, recipient.name)}
                disabled={verifying === recipient.id}
                className="btn-success"
              >
                {verifying === recipient.id ? 'Onaylanıyor...' : 'Onayla'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

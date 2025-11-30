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
  isVerified: boolean;
  registeredAtEpoch: string;
  phone: string;
  familySize: number;
  description: string;
  residenceBlobId: string;
  incomeBlobId: string;
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
  const [verifiers, setVerifiers] = useState<string[]>([]);
  const [creatingRegistry, setCreatingRegistry] = useState(false);

  useEffect(() => {
    const loadAdminAndVerifiers = async () => {
      try {
        const registryObj = await client.getObject({
          id: AIDCHAIN_REGISTRY_ID,
          options: { showContent: true },
        });
        if (registryObj.data?.content?.dataType === 'moveObject') {
          const fields = registryObj.data.content.fields as any;
          setRegistryAdmin(fields.admin);
          setVerifiers(fields.verifiers || []);
        }
      } catch (err) {
        console.error('Error loading registry:', err);
      }
    };
    loadAdminAndVerifiers();
  }, [client]);

  // Admin veya verifier ise yetkili
  const isCoordinator = currentAccount && (
    (registryAdmin && currentAccount.address.toLowerCase() === registryAdmin.toLowerCase()) ||
    verifiers.some(v => v.toLowerCase() === currentAccount.address.toLowerCase())
  );

  useEffect(() => {
    if (currentAccount && isCoordinator) {
      loadUnverifiedRecipients();
    }
  }, [currentAccount, isCoordinator, verifiers]);

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
              const owner = profileObj.data?.owner;

              if (!f.is_verified) {
                return {
                  id: profileId,
                  owner: typeof owner === 'object' && owner && 'AddressOwner' in owner ? owner.AddressOwner : 'Unknown',
                  name: f.name,
                  location: f.location,
                  isVerified: f.is_verified,
                  registeredAtEpoch: f.registered_at_epoch,
                  phone: f.phone || '',
                  familySize: parseInt(f.family_size) || 1,
                  description: f.description || '',
                  residenceBlobId: f.residence_blob_id || '',
                  incomeBlobId: f.income_blob_id || '',
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
              const created = status.objectChanges?.find(
                (c: any) => c.type === 'created' && c.objectType?.includes('AidRegistry')
              );
              if (created && 'objectId' in created) {
                setMessage(`Yeni Registry created! ID: ${created.objectId} - Please update config.ts!`);
              } else {
                setMessage('Registry created!');
              }
            } else {
              setMessage('Transaction failed');
            }
          },
          onError: (error) => {
            setMessage(`Error: ${error.message}`);
          },
        }
      );
    } catch (error) {
      setMessage(`Error: ${(error as Error).message}`);
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
              setMessage(`${name} verified`);
              loadUnverifiedRecipients();
            } else {
              setMessage('Transaction failed');
            }
          },
          onError: (error) => {
            setMessage(`Error: ${error.message}`);
          },
        }
      );
    } catch (error) {
      setMessage(`Error: ${(error as Error).message}`);
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
        <h2>NGO Verification Panel</h2>

        <div style={{
          padding: '20px',
          background: '#fef3c7',
          borderRadius: '12px',
          marginBottom: '20px',
          border: '1px solid #fcd34d',
        }}>
          <div style={{ fontWeight: '600', color: '#92400e', marginBottom: '8px' }}>
            Unauthorized Access
          </div>
          <div style={{ fontSize: '14px', color: '#78350f', marginBottom: '12px' }}>
            You must be a registry admin to use this panel.
          </div>

          {registryAdmin && (
            <div style={{ fontSize: '13px', color: '#92400e', marginBottom: '8px' }}>
              Current Admin: <code style={{ background: '#fde68a', padding: '2px 6px', borderRadius: '4px' }}>{shortenAddress(registryAdmin)}</code>
            </div>
          )}

          {currentAccount && (
            <div style={{ fontSize: '13px', color: '#92400e' }}>
              Your Address: <code style={{ background: '#fde68a', padding: '2px 6px', borderRadius: '4px' }}>{shortenAddress(currentAccount.address)}</code>
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
            Create Your Own Registry
          </div>
          <div style={{ fontSize: '14px', color: '#15803d', marginBottom: '16px' }}>
            You can become an admin by creating a new registry. You will need to update config.ts afterwards.
          </div>

          {message && (
            <div style={{
              padding: '12px',
              background: message.includes('created') ? '#dcfce7' : '#fee2e2',
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
            {creatingRegistry ? 'Creating...' : 'Create New Registry'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0 }}>Pending Verification Applications</h2>
        <button onClick={loadUnverifiedRecipients} className="btn-primary" style={{ padding: '10px 20px' }}>
          Refresh
        </button>
      </div>

      {message && (
        <div className={`message ${message.includes('verified') ? 'message-success' : 'message-error'}`}>
          {message}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#718096' }}>
          Loading...
        </div>
      ) : unverifiedRecipients.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#718096' }}>
          No pending verification applications
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
                  Pending Verification
                </div>
              </div>

              <div style={{ padding: '20px' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  marginBottom: '16px',
                }}>
                  <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px', textTransform: 'uppercase' }}>
                      Phone
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                      {recipient.phone || '-'}
                    </div>
                  </div>
                  <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px', textTransform: 'uppercase' }}>
                      Family Size
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                      {recipient.familySize} people
                    </div>
                  </div>
                </div>

                {recipient.description && (
                  <div style={{
                    padding: '12px 16px',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    marginBottom: '16px',
                  }}>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px', textTransform: 'uppercase' }}>
                      Description
                    </div>
                    <div style={{ fontSize: '14px', color: '#374151' }}>
                      {recipient.description}
                    </div>
                  </div>
                )}

                {/* Documents */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Uploaded Documents (Walrus)
                  </div>
                  
                  <div style={{ display: 'flex', gap: '12px' }}>
                    {recipient.residenceBlobId && (
                      <a
                        href={getWalrusUrl(recipient.residenceBlobId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          flex: 1,
                          display: 'block',
                          padding: '12px 16px',
                          background: '#f0fdf4',
                          borderRadius: '8px',
                          color: '#166534',
                          textDecoration: 'none',
                          fontSize: '13px',
                          border: '1px solid #86efac',
                        }}
                      >
                        <div style={{ fontWeight: '600', marginBottom: '4px' }}>📄 Residence Document</div>
                        <div style={{ fontSize: '10px', fontFamily: 'monospace', color: '#15803d' }}>
                          {recipient.residenceBlobId.slice(0, 16)}...
                        </div>
                      </a>
                    )}

                    {recipient.incomeBlobId && (
                      <a
                        href={getWalrusUrl(recipient.incomeBlobId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          flex: 1,
                          display: 'block',
                          padding: '12px 16px',
                          background: '#eff6ff',
                          borderRadius: '8px',
                          color: '#1e40af',
                          textDecoration: 'none',
                          fontSize: '13px',
                          border: '1px solid #93c5fd',
                        }}
                      >
                        <div style={{ fontWeight: '600', marginBottom: '4px' }}>Income Document</div>
                        <div style={{ fontSize: '10px', fontFamily: 'monospace', color: '#1d4ed8' }}>
                          {recipient.incomeBlobId.slice(0, 16)}...
                        </div>
                      </a>
                    )}
                  </div>
                </div>

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
                  {verifying === recipient.id ? 'Verifying...' : 'Verify'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

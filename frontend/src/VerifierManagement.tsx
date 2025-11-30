import { useState, useEffect } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import {
  AIDCHAIN_PACKAGE_ID,
  AIDCHAIN_REGISTRY_ID,
  REGISTRY_INITIAL_SHARED_VERSION,
} from './config';

export function VerifierManagement() {
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const client = useSuiClient();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [registryAdmin, setRegistryAdmin] = useState<string | null>(null);
  const [verifiers, setVerifiers] = useState<string[]>([]);
  const [newVerifierAddress, setNewVerifierAddress] = useState('');
  const [adding, setAdding] = useState(false);

  const isAdmin = registryAdmin && currentAccount?.address.toLowerCase() === registryAdmin.toLowerCase();

  useEffect(() => {
    loadRegistryData();
  }, [client]);

  const loadRegistryData = async () => {
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  const handleAddVerifier = async () => {
    if (!newVerifierAddress.trim()) {
      setMessage('Please enter an address');
      return;
    }

    // Validate address format
    if (!newVerifierAddress.startsWith('0x') || newVerifierAddress.length !== 66) {
      setMessage('Invalid address format (must start with 0x, 66 characters)');
      return;
    }

    // Check if already a verifier
    if (verifiers.some(v => v.toLowerCase() === newVerifierAddress.toLowerCase())) {
      setMessage('This address is already a DAO member');
      return;
    }

    setAdding(true);
    setMessage('');

    try {
      const txb = new Transaction();

      txb.moveCall({
        target: `${AIDCHAIN_PACKAGE_ID}::aidchain::add_verifier`,
        arguments: [
          txb.sharedObjectRef({
            objectId: AIDCHAIN_REGISTRY_ID,
            initialSharedVersion: REGISTRY_INITIAL_SHARED_VERSION,
            mutable: true,
          }),
          txb.pure.address(newVerifierAddress),
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
              setMessage('DAO member successfully added!');
              setNewVerifierAddress('');
              loadRegistryData();
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
      setAdding(false);
    }
  };

  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  if (loading) {
    return (
      <div className="card">
        <h2>DAO Member Management</h2>
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#718096' }}>
          Loading...
        </div>
      </div>
    );
  }

  if (!currentAccount) {
    return (
      <div className="card">
        <h2>DAO Member Management</h2>
        <div style={{
          padding: '40px',
          textAlign: 'center',
          background: '#f8fafc',
          borderRadius: '12px',
          color: '#64748b',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}></div>
          <div style={{ fontSize: '16px', fontWeight: '500' }}>
            Please connect your wallet
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="card">
        <h2>DAO Member Management</h2>
        
        <div style={{
          padding: '24px',
          background: '#fef2f2',
          borderRadius: '12px',
          border: '1px solid #fecaca',
          marginBottom: '24px',
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            marginBottom: '12px',
          }}>
            <span style={{ fontSize: '24px' }}>🔒</span>
            <div style={{ fontWeight: '600', color: '#991b1b', fontSize: '16px' }}>
              Unauthorized Access
            </div>
          </div>
          <div style={{ fontSize: '14px', color: '#b91c1c' }}>
            This panel can only be viewed by admin.
          </div>
        </div>

        <div style={{
          padding: '20px',
          background: '#f8fafc',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
        }}>
          <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>
            Admin Address:
          </div>
          <code style={{
            display: 'block',
            padding: '12px',
            background: '#e2e8f0',
            borderRadius: '8px',
            fontSize: '12px',
            wordBreak: 'break-all',
            color: '#334155',
          }}>
            {registryAdmin || 'Loading...'}
          </code>
          
          <div style={{ fontSize: '13px', color: '#64748b', marginTop: '16px', marginBottom: '8px' }}>
            Your Address:
          </div>
          <code style={{
            display: 'block',
            padding: '12px',
            background: '#e2e8f0',
            borderRadius: '8px',
            fontSize: '12px',
            wordBreak: 'break-all',
            color: '#334155',
          }}>
            {currentAccount.address}
          </code>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '24px' 
      }}>
        <h2 style={{ margin: 0 }}>DAO Member Management</h2>
        <button 
          onClick={loadRegistryData} 
          className="btn-primary" 
          style={{ padding: '10px 20px' }}
        >
          Refresh
        </button>
      </div>

      {/* Admin Badge */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        background: '#dcfce7',
        borderRadius: '20px',
        marginBottom: '24px',
      }}>
        <span></span>
        <span style={{ fontSize: '14px', fontWeight: '500', color: '#166534' }}>
          Logged in as Admin
        </span>
      </div>

      {message && (
        <div style={{
          padding: '16px',
          borderRadius: '12px',
          marginBottom: '24px',
          background: message.includes('success') ? '#dcfce7' : '#fef2f2',
          color: message.includes('success') ? '#166534' : '#991b1b',
          border: `1px solid ${message.includes('success') ? '#86efac' : '#fecaca'}`,
        }}>
          {message}
        </div>
      )}

      {/* Add Verifier Section */}
      <div style={{
        padding: '24px',
        background: '#f0f9ff',
        borderRadius: '16px',
        border: '1px solid #bae6fd',
        marginBottom: '32px',
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          marginBottom: '16px',
        }}>
          <span style={{ fontSize: '24px' }}>➕</span>
          <div>
            <div style={{ fontWeight: '600', color: '#0369a1', fontSize: '16px' }}>
              Add New DAO Member
            </div>
            <div style={{ fontSize: '13px', color: '#0284c7', marginTop: '2px' }}>
              Added members are permanent on blockchain and cannot be removed
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            value={newVerifierAddress}
            onChange={(e) => setNewVerifierAddress(e.target.value)}
            placeholder="0x... (Sui address)"
            style={{
              flex: 1,
              padding: '14px 16px',
              borderRadius: '10px',
              border: '2px solid #7dd3fc',
              fontSize: '14px',
              fontFamily: 'monospace',
              outline: 'none',
            }}
          />
          <button
            onClick={handleAddVerifier}
            disabled={adding || !newVerifierAddress.trim()}
            style={{
              padding: '14px 28px',
              background: adding ? '#94a3b8' : '#0284c7',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: adding ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {adding ? 'Adding...' : 'Add'}
          </button>
        </div>

        <div style={{
          marginTop: '12px',
          padding: '12px',
          background: '#e0f2fe',
          borderRadius: '8px',
          fontSize: '12px',
          color: '#075985',
        }}>
          <strong>Warning:</strong> DAO members cannot be removed from blockchain once added. 
          This security measure prevents admin from arbitrarily removing members.
        </div>
      </div>

      {/* Current Verifiers List */}
      <div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          marginBottom: '16px',
        }}>
          <span style={{ fontSize: '24px' }}></span>
          <div>
            <div style={{ fontWeight: '600', color: '#374151', fontSize: '16px' }}>
              Current DAO Members
            </div>
            <div style={{ fontSize: '13px', color: '#6b7280' }}>
              Total {verifiers.length + 1} members (including Admin)
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Admin */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            background: '#fef3c7',
            borderRadius: '12px',
            border: '1px solid #fcd34d',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '20px' }}></span>
              <div>
                <div style={{ fontWeight: '600', color: '#92400e', fontSize: '14px' }}>
                  Admin (Founder)
                </div>
                <code style={{ fontSize: '12px', color: '#a16207' }}>
                  {shortenAddress(registryAdmin || '')}
                </code>
              </div>
            </div>
            <div style={{
              padding: '4px 12px',
              background: '#fde68a',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: '600',
              color: '#92400e',
            }}>
              ADMIN
            </div>
          </div>

          {/* Verifiers */}
          {verifiers.length === 0 ? (
            <div style={{
              padding: '32px',
              textAlign: 'center',
              background: '#f8fafc',
              borderRadius: '12px',
              color: '#94a3b8',
            }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
              <div>No DAO members added yet</div>
            </div>
          ) : (
            verifiers.map((verifier, index) => (
              <div
                key={verifier}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  background: '#f8fafc',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ 
                    width: '32px', 
                    height: '32px', 
                    background: '#e0e7ff',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#4f46e5',
                  }}>
                    {index + 1}
                  </span>
                  <div>
                    <div style={{ fontWeight: '500', color: '#374151', fontSize: '14px' }}>
                      DAO Member #{index + 1}
                    </div>
                    <code style={{ fontSize: '12px', color: '#6b7280' }}>
                      {shortenAddress(verifier)}
                    </code>
                  </div>
                </div>
                <div style={{
                  padding: '4px 12px',
                  background: '#e0e7ff',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: '600',
                  color: '#4f46e5',
                }}>
                  VERIFIER
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Info Box */}
      <div style={{
        marginTop: '32px',
        padding: '20px',
        background: '#f8fafc',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
      }}>
        <div style={{ fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
          About DAO Members
        </div>
        <ul style={{ 
          margin: 0, 
          paddingLeft: '20px', 
          fontSize: '14px', 
          color: '#64748b',
          lineHeight: '1.8',
        }}>
          <li>DAO members (verifiers) can approve aid applications</li>
          <li>Members are permanently recorded on blockchain</li>
          <li>Once added, members cannot be removed (security measure)</li>
          <li>Only admin can add new members</li>
        </ul>
      </div>
    </div>
  );
}

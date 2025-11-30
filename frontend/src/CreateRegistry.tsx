import { useState } from 'react';
import { Transaction } from '@mysten/sui/transactions';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { AIDCHAIN_PACKAGE_ID } from './config';

export function CreateRegistry() {
  const currentAccount = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecuteTransaction, isPending } = useSignAndExecuteTransaction();
  
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [createdRegistryId, setCreatedRegistryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreateRegistry = async () => {
    if (!currentAccount) {
      setError('Please connect your wallet first');
      return;
    }

    setStatus('pending');
    setError(null);

    try {
      const txb = new Transaction();
      
      txb.moveCall({
        target: `${AIDCHAIN_PACKAGE_ID}::aidchain::init_registry`,
        arguments: [],
      });

      signAndExecuteTransaction(
        { transaction: txb },
        {
          onSuccess: async (result) => {
            console.log('Registry created:', result);
            
            // Wait for transaction to be indexed
            await client.waitForTransaction({ digest: result.digest });
            
            // Get transaction details to find the created registry
            const txDetails = await client.getTransactionBlock({
              digest: result.digest,
              options: { showObjectChanges: true },
            });

            // Find the created AidRegistry object
            const createdObjects = txDetails.objectChanges?.filter(
              (change) => change.type === 'created'
            );

            const registryObject = createdObjects?.find(
              (obj) => obj.type === 'created' && obj.objectType.includes('AidRegistry')
            );

            if (registryObject && registryObject.type === 'created') {
              setCreatedRegistryId(registryObject.objectId);
              setStatus('success');
            } else {
              setCreatedRegistryId(result.digest);
              setStatus('success');
            }
          },
          onError: (err) => {
            console.error('Transaction error:', err);
            setError(err.message || 'Failed to create registry');
            setStatus('error');
          },
        }
      );
    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  };

  return (
    <div className="card">
      <h2>🏗️ Create New Registry</h2>
      <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
        Create a new AidChain registry where your connected wallet will be the admin.
        The registry will be shared on the blockchain and you will be able to manage
        recipients, verifiers, and DAO settings.
      </p>

      {currentAccount ? (
        <div>
          <div style={{ 
            background: 'var(--bg-secondary)', 
            padding: '1rem', 
            borderRadius: '8px', 
            marginBottom: '1rem' 
          }}>
            <strong>Admin Address:</strong>
            <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', marginTop: '0.5rem', wordBreak: 'break-all' }}>
              {currentAccount.address}
            </div>
          </div>

          <button
            onClick={handleCreateRegistry}
            disabled={isPending || status === 'pending'}
            className="btn btn-primary"
            style={{ width: '100%' }}
          >
            {isPending || status === 'pending' ? 'Creating Registry...' : '🚀 Create Registry'}
          </button>
        </div>
      ) : (
        <div className="alert alert-warning">
          Please connect your wallet to create a registry.
        </div>
      )}

      {status === 'success' && createdRegistryId && (
        <div className="alert alert-success" style={{ marginTop: '1rem' }}>
          <strong>✅ Registry Created Successfully!</strong>
          <div style={{ marginTop: '0.5rem', wordBreak: 'break-all' }}>
            <strong>Registry ID:</strong>
            <div style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
              {createdRegistryId}
            </div>
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <a
              href={`https://testnet.suivision.xyz/object/${createdRegistryId}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: 'inherit' }}
            >
              View on SuiVision →
            </a>
          </div>
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(0,0,0,0.1)', borderRadius: '8px', fontSize: '0.85rem' }}>
            <strong>💡 Next Steps:</strong>
            <ol style={{ margin: '0.5rem 0 0 1.5rem', padding: 0 }}>
              <li>Copy the Registry ID above</li>
              <li>Update <code>AIDCHAIN_REGISTRY_ID</code> in config.ts</li>
              <li>Update the <code>REGISTRY_INITIAL_SHARED_VERSION</code></li>
              <li>Refresh the page to use your new registry</li>
            </ol>
          </div>
        </div>
      )}

      {error && (
        <div className="alert alert-danger" style={{ marginTop: '1rem' }}>
          <strong>❌ Error:</strong> {error}
        </div>
      )}
    </div>
  );
}

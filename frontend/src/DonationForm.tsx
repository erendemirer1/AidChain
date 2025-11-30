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

  const [description] = useState('Aid Package');
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
      alert('Please connect your wallet first.');
      return;
    }

    if (!selectedRecipient) {
      alert('Please select a recipient.');
      return;
    }

    const amountNumber = Number(amount);
    if (!amountNumber || amountNumber <= 0) {
      alert('Please enter a valid SUI amount.');
      return;
    }

    const txb = buildDonateTx(description, location, selectedRecipient, amountNumber);

    setLoading(true);
    setStatusMsg(null);
    setTxDigest(null);

    // Use sponsored transaction (if enabled)
    if (useSponsored && sponsoredEnabled) {
      try {
        setStatusMsg('⛽ Preparing gas-free transaction...');
        
        const result = await executeSponsored(txb, [
          `${AIDCHAIN_PACKAGE_ID}::aidchain::donate`,
        ]);

        setLoading(false);

        if (result.success) {
          setTxDigest(result.digest);
          setStatusMsg('🎉 Donation successful! Gas fee paid by sponsor.');
        } else {
          setStatusMsg(`Transaction failed: ${result.error}`);
        }
      } catch (err: any) {
        setLoading(false);
        setStatusMsg(`Sponsored transaction error: ${err.message}`);
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
            setStatusMsg('Transaction digest not found');
            return;
          }
          
          const effects = result.effects;
          const executionStatus = effects?.status?.status;
          
          console.log('Execution status:', executionStatus);
          console.log('Full effects:', effects);
          
          setTxDigest(result.digest);
          
          if (executionStatus === 'failure') {
            const errorMsg = effects?.status?.error || 'Unknown error';
            console.error('Transaction failed:', errorMsg);
            
            if (errorMsg.includes('InsufficientCoinBalance') || 
                errorMsg.toLowerCase().includes('insufficient')) {
              setStatusMsg('Insufficient balance! Not enough SUI in your wallet.');
            } else {
              setStatusMsg(`Transaction failed: ${errorMsg}`);
            }
            return;
          }
          
          if (executionStatus === 'success') {
            setStatusMsg('Donation successfully recorded on blockchain!');
          } else {
            setStatusMsg(`Transaction status uncertain. Tx: ${result.digest}`);
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
            errorMessage += 'Transaction failed';
          }
          
          if (errorMessage.toLowerCase().includes('insufficient') || 
              errorMessage.toLowerCase().includes('balance')) {
            errorMessage = 'Insufficient balance! Not enough SUI in your wallet.';
          }
          
          if (errorMessage.toLowerCase().includes('rejected') || 
              errorMessage.toLowerCase().includes('cancelled')) {
            errorMessage = 'Transaction cancelled by user.';
          }
          
          if (errorMessage.toLowerCase().includes('gas')) {
            errorMessage = 'Insufficient balance for gas fee.';
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
        <h2 style={{ margin: 0 }}>AidChain – Donor Panel</h2>
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
          Wallet not connected. Click Connect above.
        </p>
      )}

      {account && (
        <p>
          Connected address: <code>{account.address}</code>
        </p>
      )}

      <label>
        Donation Amount (SUI):
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
                ⛽ Gas-Free Transaction
              </div>
              <div style={{ fontSize: '12px', color: useSponsored ? '#047857' : '#6b7280' }}>
                {useSponsored 
                  ? 'Active - Gas fee will be paid by sponsor' 
                  : 'Disabled - Normal transaction will be used'}
              </div>
            </div>
          </label>
        </div>
      )}

      {/* Recipient Selection */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '10px', fontWeight: '500' }}>
          Recipient:
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
                Change
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
                <strong>Status:</strong> {selectedRecipientDescription}
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
            Select Recipient
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
              <h2 style={{ margin: 0 }}>Select Recipientin</h2>
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
          ? (useSponsored && sponsoredEnabled ? '⛽ Gas-Free transaction...' : 'Processing transaction...') 
          : (useSponsored && sponsoredEnabled ? '⛽ Gas-Free Donate' : 'Donate')}
      </button>

      {statusMsg && (
        <p style={{ 
          marginTop: '0.5rem',
          padding: '12px',
          borderRadius: '8px',
          background: statusMsg.includes('success') || statusMsg.includes('🎉') 
            ? '#d1fae5' 
            : statusMsg.includes('preparing') 
              ? '#dbeafe' 
              : '#fee2e2',
          color: statusMsg.includes('success') || statusMsg.includes('🎉') 
            ? '#065f46' 
            : statusMsg.includes('preparing') 
              ? '#1e40af' 
              : '#991b1b',
        }}>
          {statusMsg}
        </p>
      )}

      {txDigest && (
        <p>
          View transaction in Explorer:{' '}
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

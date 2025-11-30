// src/DonationForm.tsx
import { useState, useEffect } from 'react';
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from '@mysten/dapp-kit';
import { buildDonateTx } from './buildDonateTx';
import { useSponsoredTransaction } from './useSponsoredTransaction';
import { AIDCHAIN_REGISTRY_ID } from './config';

interface VerifiedRecipient {
  profileId: string;
  owner: string;
  name: string;
  location: string;
  isVerified: boolean;
}

export function DonationForm() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { executeSponsored, isLoading: sponsoredLoading, isEnabled: sponsoredEnabled } = useSponsoredTransaction();

  const [location, setLocation] = useState('Turkey');
  const [amount, setAmount] = useState('0.1');
  const [txDigest, setTxDigest] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [useSponsored, setUseSponsored] = useState(true);
  
  const [recipients, setRecipients] = useState<VerifiedRecipient[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<string>('');
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  useEffect(() => {
    async function loadRecipients() {
      setLoadingRecipients(true);
      try {
        const registry = await client.getObject({
          id: AIDCHAIN_REGISTRY_ID,
          options: { showContent: true },
        });

        if (registry.data?.content?.dataType === 'moveObject') {
          const fields = registry.data.content.fields as any;
          const profileIds: string[] = fields.recipient_profiles || [];
          const verifiedList: VerifiedRecipient[] = [];

          for (const profileId of profileIds) {
            try {
              const profile = await client.getObject({
                id: profileId,
                options: { showContent: true },
              });

              if (profile.data?.content?.dataType === 'moveObject') {
                const pFields = profile.data.content.fields as any;
                if (pFields.is_verified) {
                  verifiedList.push({
                    profileId: profileId,
                    owner: pFields.recipient,
                    name: pFields.name || 'Unknown',
                    location: pFields.location || 'Unknown',
                    isVerified: true,
                  });
                }
              }
            } catch (err) {
              console.error('Error loading profile:', profileId, err);
            }
          }
          setRecipients(verifiedList);
        }
      } catch (err) {
        console.error('Failed to load recipients:', err);
      }
      setLoadingRecipients(false);
    }
    loadRecipients();
  }, [client]);

  useEffect(() => {
    if (selectedRecipient) {
      const r = recipients.find(x => x.profileId === selectedRecipient);
      if (r) setLocation(r.location);
    }
  }, [selectedRecipient, recipients]);

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

    setLoading(true);
    setStatusMsg(null);
    setTxDigest(null);

    const recipient = recipients.find(r => r.profileId === selectedRecipient);
    const description = 'Aid for ' + (recipient?.name || 'recipient');

    if (useSponsored && sponsoredEnabled) {
      try {
        setStatusMsg('Preparing gas-free transaction...');
        const coinsResponse = await client.getCoins({
          owner: account.address,
          coinType: '0x2::sui::SUI',
        });
        const freshCoins = coinsResponse.data.map(c => ({
          coinObjectId: c.coinObjectId,
          balance: c.balance,
        }));
        const amountMist = BigInt(Math.floor(amountNumber * 1_000_000_000));
        const suitableCoin = freshCoins.find(c => BigInt(c.balance) >= amountMist);
        
        if (!suitableCoin) {
          const totalBalance = freshCoins.reduce((sum, c) => sum + BigInt(c.balance), BigInt(0));
          const totalSui = Number(totalBalance) / 1_000_000_000;
          setLoading(false);
          setStatusMsg('Insufficient balance! You have ' + totalSui.toFixed(4) + ' SUI.');
          return;
        }
        
        const txb = buildDonateTx(description, location, amountNumber, suitableCoin.coinObjectId);
        const result = await executeSponsored(txb);
        setLoading(false);

        if (result.success) {
          setTxDigest(result.digest);
          setStatusMsg('Donation successful! Aid package created for ' + (recipient?.name || 'recipient') + '.');
        } else {
          setStatusMsg('Transaction failed: ' + result.error);
        }
      } catch (err: any) {
        setLoading(false);
        setStatusMsg('Sponsored transaction error: ' + err.message);
      }
      return;
    }

    const txb = buildDonateTx(description, location, amountNumber);
    signAndExecute(
      { transaction: txb },
      {
        onSuccess: (result: any) => {
          setLoading(false);
          if (!result.digest) {
            setStatusMsg('Transaction digest not found');
            return;
          }
          const effects = result.effects;
          const executionStatus = effects?.status?.status;
          setTxDigest(result.digest);
          
          if (executionStatus === 'failure') {
            const errorMsg = effects?.status?.error || 'Unknown error';
            setStatusMsg('Transaction failed: ' + errorMsg);
            return;
          }
          setStatusMsg('Donation successful! Aid package created for ' + (recipient?.name || 'recipient') + '.');
        },
        onError: (err: any) => {
          setLoading(false);
          setStatusMsg(err?.message || 'Transaction failed');
        },
      },
    );
  };

  const isProcessing = loading || sponsoredLoading;

  return (
    <div className="card donation-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <img src="https://cdn-icons-png.flaticon.com/512/2489/2489756.png" alt="donate" style={{ width: '32px', height: '32px' }} />
        <h2 style={{ margin: 0 }}>AidChain - Donor Panel</h2>
        {sponsoredEnabled && (
          <span style={{ padding: '4px 10px', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>
            GAS-FREE
          </span>
        )}
      </div>

      <div style={{ padding: '16px', background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)', borderRadius: '12px', marginBottom: '20px', border: '1px solid #7dd3fc' }}>
        <strong style={{ color: '#0369a1' }}>How Donations Work</strong>
        <ol style={{ margin: '10px 0 0 0', paddingLeft: '20px', color: '#075985', fontSize: '14px', lineHeight: '1.6' }}>
          <li>Select a verified recipient</li>
          <li>Enter donation amount in SUI</li>
          <li>SUI is locked until delivery confirmed</li>
          <li>Funds released when confirmed</li>
        </ol>
      </div>

      {!account && (
        <p style={{ color: 'red', padding: '12px', background: '#fee2e2', borderRadius: '8px' }}>
          Wallet not connected. Click Connect above.
        </p>
      )}

      {account && (
        <p style={{ fontSize: '13px', color: '#666', marginBottom: '20px' }}>
          Connected: <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px' }}>
            {account.address.slice(0, 10)}...{account.address.slice(-8)}
          </code>
        </p>
      )}

      <div style={{ display: 'grid', gap: '16px', marginBottom: '20px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151' }}>
            Select Recipient *
          </label>
          {loadingRecipients ? (
            <div style={{ padding: '12px', background: '#f3f4f6', borderRadius: '8px', color: '#666' }}>
              Loading verified recipients...
            </div>
          ) : recipients.length === 0 ? (
            <div style={{ padding: '12px', background: '#fef3c7', borderRadius: '8px', color: '#92400e' }}>
              No verified recipients available.
            </div>
          ) : (
            <select
              value={selectedRecipient}
              onChange={(e) => setSelectedRecipient(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '16px', boxSizing: 'border-box', background: 'white' }}
            >
              <option value="">-- Select a recipient --</option>
              {recipients.map((r) => (
                <option key={r.profileId} value={r.profileId}>
                  {r.name} - {r.location}
                </option>
              ))}
            </select>
          )}
          
          {selectedRecipient && (() => {
            const r = recipients.find(x => x.profileId === selectedRecipient);
            if (!r) return null;
            return (
              <div style={{ marginTop: '10px', padding: '12px', background: '#d1fae5', borderRadius: '8px', border: '1px solid #10b981' }}>
                <div style={{ fontWeight: '600', color: '#065f46' }}>{r.name}</div>
                <div style={{ fontSize: '12px', color: '#047857' }}>{r.location} - Verified</div>
              </div>
            );
          })()}
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151' }}>
            Donation Amount (SUI) *
          </label>
          <input
            type="number"
            step="0.1"
            min="0.1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.1"
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '16px', boxSizing: 'border-box' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151' }}>
            Delivery Location
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Turkey"
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '16px', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {sponsoredEnabled && (
        <div style={{ padding: '12px 16px', background: useSponsored ? '#d1fae5' : '#f3f4f6', borderRadius: '12px', marginBottom: '16px', border: useSponsored ? '2px solid #10b981' : '2px solid #e5e7eb' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={useSponsored}
              onChange={(e) => setUseSponsored(e.target.checked)}
              style={{ width: '20px', height: '20px' }}
            />
            <div>
              <div style={{ fontWeight: '600', color: useSponsored ? '#065f46' : '#374151' }}>
                Gas-Free Transaction
              </div>
              <div style={{ fontSize: '12px', color: useSponsored ? '#047857' : '#6b7280' }}>
                {useSponsored ? 'Active - Gas fee paid by sponsor' : 'Disabled'}
              </div>
            </div>
          </label>
        </div>
      )}

      <button 
        onClick={handleDonate} 
        disabled={isProcessing || !account || !amount || !selectedRecipient}
        style={{
          width: '100%',
          padding: '14px 24px',
          fontSize: '16px',
          fontWeight: 'bold',
          background: isProcessing || !account || !amount || !selectedRecipient ? '#d1d5db' : useSponsored && sponsoredEnabled ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #667eea, #764ba2)',
          color: '#fff',
          border: 'none',
          borderRadius: '10px',
          cursor: isProcessing || !account || !amount || !selectedRecipient ? 'not-allowed' : 'pointer',
        }}
      >
        {isProcessing ? 'Processing...' : (useSponsored && sponsoredEnabled ? 'Donate (Gas-Free)' : 'Donate')}
      </button>

      {statusMsg && (
        <div style={{ marginTop: '16px', padding: '12px 16px', borderRadius: '8px', background: statusMsg.includes('successful') ? '#d1fae5' : '#fee2e2', color: statusMsg.includes('successful') ? '#065f46' : '#991b1b' }}>
          {statusMsg}
        </div>
      )}

      {txDigest && (
        <div style={{ marginTop: '20px' }}>
          <p style={{ fontSize: '14px', marginBottom: '12px' }}>
            View on Explorer:{' '}
            <a href={'https://testnet.suivision.xyz/txblock/' + txDigest} target="_blank" rel="noreferrer" style={{ color: '#667eea' }}>
              {txDigest.slice(0, 16)}...
            </a>
          </p>
          
          <div style={{ padding: '16px 20px', background: '#fef3c7', borderRadius: '12px', border: '2px solid #f59e0b' }}>
            <strong style={{ color: '#92400e' }}>Mint Your Impact NFT!</strong>
            <p style={{ margin: '10px 0', color: '#78350f', fontSize: '14px' }}>
              Your donation of {amount} SUI qualifies for an Impact NFT certificate.
            </p>
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('switchTab', { detail: 'impact-nft' })); }}
              style={{ display: 'inline-block', padding: '10px 20px', background: '#FFD700', color: '#000', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold' }}
            >
              Go to Impact NFT Panel
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

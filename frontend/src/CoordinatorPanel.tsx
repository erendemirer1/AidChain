import { useState, useEffect } from 'react';
import {
  useCurrentAccount,
  useSuiClient,
  useSignAndExecuteTransaction,
} from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { AIDCHAIN_PACKAGE_ID, AIDCHAIN_REGISTRY_ID } from './config';

type AidPackageInfo = {
  id: string;
  description: string;
  location: string;
  status: number;
  donor: string;
  coordinator: string;
  proof_url: string;
  created_at_epoch: string;
  updated_at_epoch: string;
  donation_amount: string;
  is_locked: boolean;
  delivery_note?: string;
  coordinator_approved: boolean;
  recipient_approved: boolean;
  recipient?: string;
};

export function CoordinatorPanel() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const [loading, setLoading] = useState(false);
  const [packages, setPackages] = useState<AidPackageInfo[]>([]);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [deliveryNotes, setDeliveryNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    loadPackages();
  }, []);

  const loadPackages = async () => {
    try {
      setLoading(true);

      const registryObj = await client.getObject({
        id: AIDCHAIN_REGISTRY_ID,
        options: { showContent: true },
      });

      const regData: any = (registryObj as any).data?.content;
      if (!regData || regData.dataType !== 'moveObject') {
        setLoading(false);
        return;
      }

      const regFields = regData.fields;
      const ids: string[] = regFields.packages;

      if (!ids || ids.length === 0) {
        setPackages([]);
        setLoading(false);
        return;
      }

      const objs = await client.multiGetObjects({
        ids,
        options: { showContent: true },
      });

      const list: AidPackageInfo[] = [];

      for (const obj of objs as any[]) {
        if (obj.error) continue;
        const content = obj.data?.content;
        if (!content || content.dataType !== 'moveObject') continue;

        const f = (content as any).fields;
        const lockedDonation = f.locked_donation;
        const isLocked = lockedDonation && lockedDonation.type === 'some';
        
        let donationAmount = '0';
        if (isLocked && lockedDonation.fields?.some?.fields?.balance) {
          donationAmount = lockedDonation.fields.some.fields.balance;
        }

        list.push({
          id: obj.data.objectId,
          description: f.description,
          location: f.location,
          status: f.status,
          donor: f.donor,
          coordinator: f.coordinator,
          proof_url: f.proof_url || '',
          created_at_epoch: f.created_at_epoch,
          updated_at_epoch: f.updated_at_epoch,
          donation_amount: donationAmount,
          is_locked: isLocked,
          delivery_note: f.delivery_note || '',
          coordinator_approved: f.coordinator_approved || false,
          recipient_approved: f.recipient_approved || false,
          recipient: f.recipient || undefined,
        });
      }

      setPackages(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkDelivered = async (pkg: AidPackageInfo) => {
    if (!account) return;

    const note = deliveryNotes[pkg.id] || '';
    setStatusMsg('Sending...');

    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${AIDCHAIN_PACKAGE_ID}::aidchain::mark_delivered`,
        arguments: [
          tx.object(pkg.id),
          tx.pure.string(note),
        ],
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async (result) => {
            if (!result.digest) {
              setStatusMsg('Failed');
              return;
            }

            const status = await client.waitForTransaction({
              digest: result.digest,
              options: { showEffects: true },
            });

            if (status.effects?.status?.status === 'success') {
              setStatusMsg('Delivery recorded');
              loadPackages();
            } else {
              setStatusMsg('Failed');
            }
          },
          onError: (error) => {
            setStatusMsg(`Error: ${error.message}`);
          },
        }
      );
    } catch (error) {
      setStatusMsg(`Error: ${(error as Error).message}`);
    }
  };

  const shortenAddress = (addr: string) => {
    if (!addr) return '-';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatSui = (amount: string) => {
    const sui = Number(amount) / 1_000_000_000;
    return sui.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  };

  if (loading) {
    return (
      <div className="card">
        <h2>Packages</h2>
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#718096' }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0 }}>Packages</h2>
        <button onClick={loadPackages} className="btn-primary" style={{ padding: '10px 20px', fontSize: '14px' }}>
          Refresh
        </button>
      </div>

      {statusMsg && (
        <div className={`message ${statusMsg.includes('recorded') ? 'message-success' : 'message-error'}`}>
          {statusMsg}
        </div>
      )}

      {packages.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#718096' }}>
          No packages yet
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {packages.map((pkg, index) => (
            <div 
              key={pkg.id} 
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
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#fafafa',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: '#e5e7eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151',
                  }}>
                    #{index + 1}
                  </span>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '16px', color: '#111827' }}>
                      {pkg.description}
                    </div>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>
                      {pkg.location}
                    </div>
                  </div>
                </div>
                <div style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '600',
                  background: pkg.status === 2 ? '#dcfce7' : pkg.status === 1 ? '#fef3c7' : '#dbeafe',
                  color: pkg.status === 2 ? '#166534' : pkg.status === 1 ? '#92400e' : '#1e40af',
                }}>
                  {pkg.status === 0 ? 'Pending' : pkg.status === 1 ? 'In Transit' : 'Delivered'}
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: '20px' }}>
                {/* Amount */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  background: '#f8fafc',
                  borderRadius: '10px',
                  marginBottom: '16px',
                }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Donation Amount
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a' }}>
                      {formatSui(pkg.donation_amount)} <span style={{ fontSize: '14px', fontWeight: '500', color: '#64748b' }}>SUI</span>
                    </div>
                  </div>
                  {pkg.is_locked && (
                    <div style={{
                      padding: '8px 12px',
                      background: '#ecfdf5',
                      borderRadius: '8px',
                      color: '#059669',
                      fontSize: '13px',
                      fontWeight: '500',
                    }}>
                      Locked in Escrow
                    </div>
                  )}
                </div>

                {/* Details Grid */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr', 
                  gap: '12px',
                  marginBottom: '16px',
                }}>
                  <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px', textTransform: 'uppercase' }}>Donor</div>
                    <div style={{ fontSize: '13px', fontFamily: 'monospace', color: '#374151' }}>{shortenAddress(pkg.donor)}</div>
                  </div>
                  <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px', textTransform: 'uppercase' }}>Coordinator</div>
                    <div style={{ fontSize: '13px', fontFamily: 'monospace', color: '#374151' }}>{shortenAddress(pkg.coordinator)}</div>
                  </div>
                  {pkg.recipient && (
                    <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                      <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px', textTransform: 'uppercase' }}>Recipient</div>
                      <div style={{ fontSize: '13px', fontFamily: 'monospace', color: '#374151' }}>{shortenAddress(pkg.recipient)}</div>
                    </div>
                  )}
                  <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px', textTransform: 'uppercase' }}>Epoch</div>
                    <div style={{ fontSize: '13px', color: '#374151' }}>{pkg.created_at_epoch}</div>
                  </div>
                </div>

                {/* Suiscan Link */}
                <a
                  href={`https://suiscan.xyz/testnet/object/${pkg.id}`}
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
                    marginBottom: '16px',
                    transition: 'background 0.2s',
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#e2e8f0'}
                  onMouseOut={(e) => e.currentTarget.style.background = '#f1f5f9'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '500', color: '#334155', marginBottom: '2px' }}>View on Blockchain</div>
                      <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#94a3b8' }}>{pkg.id.slice(0, 20)}...{pkg.id.slice(-8)}</div>
                    </div>
                    <span style={{ color: '#64748b' }}></span>
                  </div>
                </a>

                {/* Delivery Action */}
                {pkg.status < 2 && account?.address === pkg.recipient && (
                  <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '16px' }}>
                    <input
                      type="text"
                      placeholder="Add delivery note (optional)"
                      value={deliveryNotes[pkg.id] || ''}
                      onChange={(e) => setDeliveryNotes({ ...deliveryNotes, [pkg.id]: e.target.value })}
                      style={{ 
                        marginBottom: '12px',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        padding: '12px 14px',
                        fontSize: '14px',
                      }}
                    />
                    <button
                      onClick={() => handleMarkDelivered(pkg)}
                      style={{
                        width: '100%',
                        padding: '14px',
                        background: '#059669',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '15px',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      Mark as Received
                    </button>
                  </div>
                )}

                {/* Delivery Note */}
                {pkg.status === 2 && pkg.delivery_note && (
                  <div style={{ 
                    padding: '14px 16px', 
                    background: '#f0fdf4', 
                    borderRadius: '8px', 
                    borderLeft: '3px solid #22c55e',
                  }}>
                    <div style={{ fontSize: '11px', color: '#16a34a', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '600' }}>Delivery Note</div>
                    <div style={{ fontSize: '14px', color: '#166534' }}>{pkg.delivery_note}</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

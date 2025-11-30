import { useState, useEffect } from 'react';
import { useSuiClient } from '@mysten/dapp-kit';
import { AIDCHAIN_REGISTRY_ID, WALRUS_AGGREGATOR_URL } from './config';

interface RecipientProfile {
  id: string;
  recipient: string;
  name: string;
  location: string;
  phone: string;
  familySize: number;
  description: string;
  isVerified: boolean;
  registeredAtEpoch: string;
  receivedPackagesCount: number;
  votesReceived: number;
  residenceBlobId: string;
  incomeBlobId: string;
}

interface RecipientListProps {
  onSelectRecipient?: (address: string, name: string, description?: string) => void;
  showVerifiedOnly?: boolean;
}

// SVG Icons
const Icons = {
  user: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"/>
    </svg>
  ),
  location: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  phone: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
    </svg>
  ),
  users: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
    </svg>
  ),
  package: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
      <polyline points="3.27,6.96 12,12.01 20.73,6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  ),
  check: (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <polyline points="20,6 9,17 4,12"/>
    </svg>
  ),
  clock: (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12,6 12,12 16,14"/>
    </svg>
  ),
  file: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14,2 14,8 20,8"/>
    </svg>
  ),
  vote: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/>
    </svg>
  ),
  refresh: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <polyline points="23,4 23,10 17,10"/>
      <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
    </svg>
  ),
  arrowRight: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12,5 19,12 12,19"/>
    </svg>
  ),
  calendar: (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  externalLink: (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>
    </svg>
  ),
};

export function RecipientList({ onSelectRecipient, showVerifiedOnly = true }: RecipientListProps) {
  const [allRecipients, setAllRecipients] = useState<RecipientProfile[]>([]);
  const [recipients, setRecipients] = useState<RecipientProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'verified' | 'pending'>('all');
  const client = useSuiClient();

  useEffect(() => {
    loadRecipients();
  }, []);

  const loadRecipients = async () => {
    try {
      setLoading(true);
      setError('');

      const registryObject = await client.getObject({
        id: AIDCHAIN_REGISTRY_ID,
        options: { showContent: true },
      });

      if (registryObject.data?.content?.dataType === 'moveObject') {
        const fields = registryObject.data.content.fields as any;
        const recipientProfileIds = fields.recipient_profiles || [];

        const profilePromises = recipientProfileIds.map(async (profileId: string) => {
          try {
            const profileObj = await client.getObject({
              id: profileId,
              options: { showContent: true },
            });

            if (profileObj.data?.content?.dataType === 'moveObject') {
              const f = profileObj.data.content.fields as any;
              return {
                id: profileId,
                recipient: f.recipient,
                name: f.name,
                location: f.location,
                phone: f.phone || '',
                familySize: parseInt(f.family_size) || 1,
                description: f.description || '',
                isVerified: f.is_verified,
                registeredAtEpoch: f.registered_at_epoch,
                receivedPackagesCount: parseInt(f.received_packages_count) || 0,
                votesReceived: parseInt(f.votes_received) || 0,
                residenceBlobId: f.residence_blob_id || '',
                incomeBlobId: f.income_blob_id || '',
              };
            }
          } catch (err) {
            console.error(`Error loading profile ${profileId}:`, err);
          }
          return null;
        });

        const profiles = (await Promise.all(profilePromises)).filter(
          (p): p is RecipientProfile => p !== null
        );

        // Store all recipients (for stats)
        setAllRecipients(profiles);

        // Set display list
        let filtered = profiles;
        if (showVerifiedOnly) {
          filtered = profiles.filter(p => p.isVerified);
        }

        setRecipients(filtered);
      }
    } catch (err) {
      console.error('Error loading recipients:', err);
      setError('Error loading recipients');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredRecipients = () => {
    if (filter === 'verified') return recipients.filter(r => r.isVerified);
    if (filter === 'pending') return recipients.filter(r => !r.isVerified);
    return recipients;
  };

  const getWalrusUrl = (blobId: string) => `${WALRUS_AGGREGATOR_URL}/v1/blobs/${blobId}`;
  const shortenAddress = (addr: string) => `${addr.slice(0, 8)}...${addr.slice(-6)}`;

  const filteredRecipients = getFilteredRecipients();
  // Use ALL recipients for stats (even if showVerifiedOnly)
  const verifiedCount = allRecipients.filter(r => r.isVerified).length;
  const pendingCount = allRecipients.filter(r => !r.isVerified).length;
  const totalCount = allRecipients.length;

  if (loading) {
    return (
      <div className="card">
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ 
            width: '48px', 
            height: '48px', 
            border: '3px solid #e5e7eb',
            borderTopColor: '#667eea',
            borderRadius: '50%',
            margin: '0 auto 16px',
            animation: 'spin 1s linear infinite',
          }}/>
          <p style={{ color: '#6b7280', margin: 0 }}>Loading recipients...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div style={{ 
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '12px',
          padding: '20px',
          color: '#991b1b',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', color: '#111827' }}>
            {showVerifiedOnly ? 'Verified Recipients' : 'All Recipients'}
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#6b7280' }}>
            {totalCount} registered recipients
          </p>
        </div>
        <button
          onClick={loadRecipients}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            background: '#667eea',
            color: 'white',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
          }}
        >
          {Icons.refresh}
          Refresh
        </button>
      </div>

      {/* Stats Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
        marginBottom: '24px',
      }}>
        <div style={{
          padding: '16px',
          background: '#f0fdf4',
          borderRadius: '12px',
          border: '1px solid #bbf7d0',
        }}>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#166534' }}>{verifiedCount}</div>
          <div style={{ fontSize: '13px', color: '#15803d' }}>Verified</div>
        </div>
        <div style={{
          padding: '16px',
          background: '#fefce8',
          borderRadius: '12px',
          border: '1px solid #fef08a',
        }}>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#854d0e' }}>{pendingCount}</div>
          <div style={{ fontSize: '13px', color: '#a16207' }}>Pending</div>
        </div>
        <div style={{
          padding: '16px',
          background: '#eff6ff',
          borderRadius: '12px',
          border: '1px solid #bfdbfe',
        }}>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#1e40af' }}>{totalCount}</div>
          <div style={{ fontSize: '13px', color: '#1d4ed8' }}>Total</div>
        </div>
      </div>

      {/* Filter Tabs */}
      {!showVerifiedOnly && (
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
          padding: '4px',
          background: '#f3f4f6',
          borderRadius: '10px',
        }}>
          {[
            { key: 'all', label: 'All' },
            { key: 'verified', label: 'Verified' },
            { key: 'pending', label: 'Pending' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key as any)}
              style={{
                flex: 1,
                padding: '10px 16px',
                border: 'none',
                borderRadius: '8px',
                background: filter === key ? 'white' : 'transparent',
                color: filter === key ? '#111827' : '#6b7280',
                fontWeight: filter === key ? '600' : '400',
                cursor: 'pointer',
                boxShadow: filter === key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Recipients List */}
      {filteredRecipients.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: '#f9fafb',
          borderRadius: '12px',
        }}>
          <div style={{ color: '#9ca3af', marginBottom: '8px' }}>{Icons.users}</div>
          <p style={{ color: '#6b7280', margin: 0 }}>
            {filter === 'verified' ? 'No verified recipients found' : 
             filter === 'pending' ? 'No pending applications found' : 
             'No registered recipients yet'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredRecipients.map((recipient) => (
            <div
              key={recipient.id}
              onClick={() => onSelectRecipient?.(recipient.recipient, recipient.name, recipient.description)}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: '16px',
                background: 'white',
                overflow: 'hidden',
                cursor: onSelectRecipient ? 'pointer' : 'default',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (onSelectRecipient) {
                  e.currentTarget.style.borderColor = '#667eea';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.15)';
                }
              }}
              onMouseLeave={(e) => {
                if (onSelectRecipient) {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              {/* Card Header */}
              <div style={{
                padding: '16px 20px',
                background: recipient.isVerified ? '#f0fdf4' : '#fefce8',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: recipient.isVerified ? '#dcfce7' : '#fef3c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: recipient.isVerified ? '#166534' : '#92400e',
                  }}>
                    {Icons.user}
                  </div>
                  <div>
                    <div style={{ 
                      fontWeight: '600', 
                      fontSize: '16px', 
                      color: '#111827',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}>
                      {recipient.name}
                      {recipient.isVerified && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: '#dcfce7',
                          color: '#166534',
                          padding: '2px 8px',
                          borderRadius: '20px',
                          fontSize: '11px',
                          fontWeight: '600',
                        }}>
                          {Icons.check} Verified
                        </span>
                      )}
                      {!recipient.isVerified && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: '#fef3c7',
                          color: '#92400e',
                          padding: '2px 8px',
                          borderRadius: '20px',
                          fontSize: '11px',
                          fontWeight: '600',
                        }}>
                          {Icons.clock} Pending
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>
                      {shortenAddress(recipient.recipient)}
                    </div>
                  </div>
                </div>
                {onSelectRecipient && (
                  <div style={{ color: '#667eea' }}>
                    {Icons.arrowRight}
                  </div>
                )}
              </div>

              {/* Quick Description for Selection Mode */}
              {onSelectRecipient && recipient.description && (
                <div style={{
                  padding: '12px 20px',
                  background: '#eff6ff',
                  borderBottom: '1px solid #e5e7eb',
                }}>
                  <div style={{ 
                    fontSize: '13px', 
                    color: '#1e40af',
                    lineHeight: '1.5',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    <strong>Status:</strong> {recipient.description}
                  </div>
                </div>
              )}

              {/* Card Body */}
              <div style={{ padding: '20px' }}>
                {/* Info Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '12px',
                  marginBottom: '16px',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px',
                    background: '#f9fafb',
                    borderRadius: '10px',
                  }}>
                    <div style={{ color: '#6b7280' }}>{Icons.location}</div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase' }}>Location</div>
                      <div style={{ fontSize: '14px', color: '#374151', fontWeight: '500' }}>{recipient.location}</div>
                    </div>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px',
                    background: '#f9fafb',
                    borderRadius: '10px',
                  }}>
                    <div style={{ color: '#6b7280' }}>{Icons.phone}</div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase' }}>Phone</div>
                      <div style={{ fontSize: '14px', color: '#374151', fontWeight: '500' }}>{recipient.phone || '-'}</div>
                    </div>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px',
                    background: '#f9fafb',
                    borderRadius: '10px',
                  }}>
                    <div style={{ color: '#6b7280' }}>{Icons.users}</div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase' }}>Family</div>
                      <div style={{ fontSize: '14px', color: '#374151', fontWeight: '500' }}>{recipient.familySize} people</div>
                    </div>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px',
                    background: '#f9fafb',
                    borderRadius: '10px',
                  }}>
                    <div style={{ color: '#6b7280' }}>{Icons.package}</div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase' }}>Packages Received</div>
                      <div style={{ fontSize: '14px', color: '#374151', fontWeight: '500' }}>{recipient.receivedPackagesCount}</div>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {recipient.description && (
                  <div style={{
                    padding: '12px 16px',
                    background: '#f8fafc',
                    borderRadius: '10px',
                    marginBottom: '16px',
                    borderLeft: '3px solid #667eea',
                  }}>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px', textTransform: 'uppercase' }}>
                      Description
                    </div>
                    <div style={{ fontSize: '14px', color: '#374151', lineHeight: '1.5' }}>
                      {recipient.description}
                    </div>
                  </div>
                )}

                {/* Documents & Stats Row */}
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}>
                  {/* Registration Epoch */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    background: '#f3f4f6',
                    borderRadius: '8px',
                    fontSize: '13px',
                    color: '#4b5563',
                  }}>
                    {Icons.calendar}
                    Epoch {recipient.registeredAtEpoch}
                  </div>

                  {/* Votes */}
                  {recipient.votesReceived > 0 && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 12px',
                      background: '#eff6ff',
                      borderRadius: '8px',
                      fontSize: '13px',
                      color: '#1d4ed8',
                    }}>
                      {Icons.vote}
                      {recipient.votesReceived} oy
                    </div>
                  )}

                  {/* Documents */}
                  {recipient.residenceBlobId && (
                    <a
                      href={getWalrusUrl(recipient.residenceBlobId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 12px',
                        background: '#f0fdf4',
                        borderRadius: '8px',
                        fontSize: '13px',
                        color: '#166534',
                        textDecoration: 'none',
                        border: '1px solid #bbf7d0',
                      }}
                    >
                      {Icons.file}
                      Residence
                      {Icons.externalLink}
                    </a>
                  )}
                  {recipient.incomeBlobId && (
                    <a
                      href={getWalrusUrl(recipient.incomeBlobId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 12px',
                        background: '#fef3c7',
                        borderRadius: '8px',
                        fontSize: '13px',
                        color: '#92400e',
                        textDecoration: 'none',
                        border: '1px solid #fcd34d',
                      }}
                    >
                      {Icons.file}
                      Income
                      {Icons.externalLink}
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

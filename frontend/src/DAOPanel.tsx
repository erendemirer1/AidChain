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
  proposalId: string | null;
  votesReceived: number;
}

interface Proposal {
  id: string;
  profileId: string;
  profileOwner: string;
  proposer: string;
  votesFor: string[];
  votesAgainst: string[];
  createdAtEpoch: number;
  expiresAtEpoch: number;
  status: number;
  executed: boolean;
}

interface DAOConfig {
  votingPeriodEpochs: number;
  quorumPercent: number;
  approvalPercent: number;
}

const PROPOSAL_STATUS = {
  0: { label: 'Bekliyor', color: '#f59e0b', bg: '#fef3c7' },
  1: { label: 'Onaylandı', color: '#059669', bg: '#d1fae5' },
  2: { label: 'Reddedildi', color: '#dc2626', bg: '#fee2e2' },
  3: { label: 'Süresi Doldu', color: '#6b7280', bg: '#f3f4f6' },
};

export function DAOPanel() {
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const client = useSuiClient();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [registryAdmin, setRegistryAdmin] = useState<string | null>(null);
  const [verifiers, setVerifiers] = useState<string[]>([]);
  const [daoConfig, setDaoConfig] = useState<DAOConfig | null>(null);
  const [currentEpoch, setCurrentEpoch] = useState<number>(0);
  
  const [pendingProfiles, setPendingProfiles] = useState<RecipientProfile[]>([]);
  const [activeProposals, setActiveProposals] = useState<Proposal[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, RecipientProfile>>({});

  const [creatingProposal, setCreatingProposal] = useState<string | null>(null);
  const [voting, setVoting] = useState<string | null>(null);
  const [executing, setExecuting] = useState<string | null>(null);

  const isAdmin = registryAdmin && currentAccount?.address.toLowerCase() === registryAdmin.toLowerCase();
  const isVerifier = verifiers.some(v => v.toLowerCase() === currentAccount?.address.toLowerCase());
  const canVote = isAdmin || isVerifier;

  // Load registry data
  useEffect(() => {
    loadRegistryData();
    loadCurrentEpoch();
  }, [client]);

  useEffect(() => {
    if (currentAccount && canVote) {
      loadPendingProfiles();
      loadActiveProposals();
    }
  }, [currentAccount, canVote]);

  const loadCurrentEpoch = async () => {
    try {
      const state = await client.getLatestSuiSystemState();
      setCurrentEpoch(Number(state.epoch));
    } catch (err) {
      console.error('Error loading epoch:', err);
    }
  };

  const loadRegistryData = async () => {
    try {
      const registryObj = await client.getObject({
        id: AIDCHAIN_REGISTRY_ID,
        options: { showContent: true },
      });

      if (registryObj.data?.content?.dataType === 'moveObject') {
        const fields = registryObj.data.content.fields as any;
        setRegistryAdmin(fields.admin);
        setVerifiers(fields.verifiers || []);
        
        if (fields.dao_config?.fields) {
          setDaoConfig({
            votingPeriodEpochs: Number(fields.dao_config.fields.voting_period_epochs),
            quorumPercent: Number(fields.dao_config.fields.quorum_percent),
            approvalPercent: Number(fields.dao_config.fields.approval_percent),
          });
        }
      }
    } catch (err) {
      console.error('Error loading registry:', err);
    }
  };

  const loadPendingProfiles = async () => {
    setLoading(true);
    try {
      const registryObj = await client.getObject({
        id: AIDCHAIN_REGISTRY_ID,
        options: { showContent: true },
      });

      if (registryObj.data?.content?.dataType === 'moveObject') {
        const fields = registryObj.data.content.fields as any;
        const profileIds = fields.recipient_profiles || [];

        const profiles: RecipientProfile[] = [];
        const pMap: Record<string, RecipientProfile> = {};

        for (const profileId of profileIds) {
          try {
            const profileObj = await client.getObject({
              id: profileId,
              options: { showContent: true, showOwner: true },
            });

            if (profileObj.data?.content?.dataType === 'moveObject') {
              const f = profileObj.data.content.fields as any;
              const owner = profileObj.data.owner;
              const ownerAddr = owner && typeof owner === 'object' && 'AddressOwner' in owner 
                ? owner.AddressOwner : 'Unknown';

              const profile: RecipientProfile = {
                id: profileId,
                owner: ownerAddr,
                name: f.name,
                location: f.location,
                needCategory: f.need_category,
                isVerified: f.is_verified,
                registeredAtEpoch: f.registered_at_epoch,
                phone: f.phone || '',
                familySize: parseInt(f.family_size) || 1,
                description: f.description || '',
                evidenceBlobId: f.evidence_blob_id || '',
                proposalId: f.proposal_id?.fields?.some || null,
                votesReceived: parseInt(f.votes_received) || 0,
              };

              pMap[profileId] = profile;

              if (!f.is_verified && !f.proposal_id?.fields?.some) {
                profiles.push(profile);
              }
            }
          } catch (err) {
            console.error(`Error loading profile ${profileId}:`, err);
          }
        }

        setPendingProfiles(profiles);
        setProfileMap(pMap);
      }
    } catch (err) {
      console.error('Error loading profiles:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadActiveProposals = async () => {
    try {
      const registryObj = await client.getObject({
        id: AIDCHAIN_REGISTRY_ID,
        options: { showContent: true },
      });

      if (registryObj.data?.content?.dataType === 'moveObject') {
        const fields = registryObj.data.content.fields as any;
        const proposalIds = fields.proposals || [];

        const proposals: Proposal[] = [];

        for (const proposalId of proposalIds) {
          try {
            const proposalObj = await client.getObject({
              id: proposalId,
              options: { showContent: true },
            });

            if (proposalObj.data?.content?.dataType === 'moveObject') {
              const f = proposalObj.data.content.fields as any;
              
              if (!f.executed) {
                proposals.push({
                  id: proposalId,
                  profileId: f.profile_id,
                  profileOwner: f.profile_owner,
                  proposer: f.proposer,
                  votesFor: f.votes_for || [],
                  votesAgainst: f.votes_against || [],
                  createdAtEpoch: Number(f.created_at_epoch),
                  expiresAtEpoch: Number(f.expires_at_epoch),
                  status: Number(f.status),
                  executed: f.executed,
                });
              }
            }
          } catch (err) {
            console.error(`Error loading proposal ${proposalId}:`, err);
          }
        }

        setActiveProposals(proposals);
      }
    } catch (err) {
      console.error('Error loading proposals:', err);
    }
  };

  const handleCreateProposal = async (profileId: string) => {
    setCreatingProposal(profileId);
    setMessage('');

    try {
      const txb = new Transaction();

      txb.moveCall({
        target: `${AIDCHAIN_PACKAGE_ID}::aidchain::create_verification_proposal`,
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
              setMessage('Öneri oluşturuldu! Diğer verifier\'lar oy verebilir.');
              loadPendingProfiles();
              loadActiveProposals();
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
      setCreatingProposal(null);
    }
  };

  const handleVote = async (proposalId: string, voteFor: boolean) => {
    setVoting(proposalId);
    setMessage('');

    try {
      const txb = new Transaction();

      txb.moveCall({
        target: `${AIDCHAIN_PACKAGE_ID}::aidchain::vote_on_proposal`,
        arguments: [
          txb.sharedObjectRef({
            objectId: AIDCHAIN_REGISTRY_ID,
            initialSharedVersion: REGISTRY_INITIAL_SHARED_VERSION,
            mutable: false,
          }),
          txb.object(proposalId),
          txb.pure.bool(voteFor),
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
              setMessage(voteFor ? 'Lehte oy verildi!' : 'Aleyhte oy verildi!');
              loadActiveProposals();
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
      setVoting(null);
    }
  };

  const handleExecuteProposal = async (proposal: Proposal) => {
    setExecuting(proposal.id);
    setMessage('');

    try {
      const txb = new Transaction();

      txb.moveCall({
        target: `${AIDCHAIN_PACKAGE_ID}::aidchain::execute_proposal`,
        arguments: [
          txb.sharedObjectRef({
            objectId: AIDCHAIN_REGISTRY_ID,
            initialSharedVersion: REGISTRY_INITIAL_SHARED_VERSION,
            mutable: true,
          }),
          txb.object(proposal.id),
          txb.object(proposal.profileId),
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
              setMessage('Öneri yürütüldü!');
              loadPendingProfiles();
              loadActiveProposals();
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
      setExecuting(null);
    }
  };

  const getWalrusUrl = (blobId: string) => `${WALRUS_AGGREGATOR_URL}/v1/blobs/${blobId}`;
  const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const hasVoted = (proposal: Proposal) => {
    if (!currentAccount) return false;
    const addr = currentAccount.address.toLowerCase();
    return proposal.votesFor.some(v => v.toLowerCase() === addr) ||
           proposal.votesAgainst.some(v => v.toLowerCase() === addr);
  };

  const canExecute = (proposal: Proposal) => {
    if (proposal.executed || proposal.status !== 0) return false;
    const totalVotes = proposal.votesFor.length + proposal.votesAgainst.length;
    const quorumThreshold = Math.max(1, Math.floor((verifiers.length * (daoConfig?.quorumPercent || 50)) / 100));
    return totalVotes >= quorumThreshold || currentEpoch > proposal.expiresAtEpoch;
  };

  if (!canVote) {
    return (
      <div className="card">
        <h2>DAO Oylama Paneli</h2>
        <div style={{ padding: '20px', background: '#fef3c7', borderRadius: '12px', border: '1px solid #fcd34d' }}>
          <div style={{ fontWeight: '600', color: '#92400e', marginBottom: '8px' }}>Yetkisiz Erişim</div>
          <div style={{ fontSize: '14px', color: '#78350f' }}>
            Bu paneli kullanmak için verifier olmanız gerekiyor.
          </div>
          {currentAccount && (
            <div style={{ marginTop: '12px', fontSize: '13px', color: '#92400e' }}>
              Adresiniz: <code style={{ background: '#fde68a', padding: '2px 6px', borderRadius: '4px' }}>
                {shortenAddress(currentAccount.address)}
              </code>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: 0 }}>DAO Oylama Paneli</h2>
          <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
            {isAdmin ? 'Admin' : '✓ Verifier'} • {verifiers.length} verifier • Epoch: {currentEpoch}
          </div>
        </div>
        <button onClick={() => { loadPendingProfiles(); loadActiveProposals(); loadCurrentEpoch(); }} 
          className="btn-primary" style={{ padding: '10px 20px' }}>
          Yenile
        </button>
      </div>

      {/* DAO Config */}
      {daoConfig && (
        <div style={{ 
          padding: '16px', 
          background: '#f0f9ff', 
          borderRadius: '12px', 
          marginBottom: '20px',
          border: '1px solid #bae6fd',
        }}>
          <div style={{ fontWeight: '600', color: '#0369a1', marginBottom: '8px' }}>DAO Ayarları</div>
          <div style={{ display: 'flex', gap: '24px', fontSize: '14px', color: '#0c4a6e' }}>
            <span>Oylama Süresi: <strong>{daoConfig.votingPeriodEpochs} epoch</strong></span>
            <span>Quorum: <strong>%{daoConfig.quorumPercent}</strong></span>
            <span>Onay Eşiği: <strong>%{daoConfig.approvalPercent}</strong></span>
          </div>
        </div>
      )}

      {message && (
        <div style={{
          padding: '12px 16px',
          background: message.includes('') ? '#d1fae5' : '#fee2e2',
          borderRadius: '8px',
          marginBottom: '16px',
          color: message.includes('') ? '#065f46' : '#991b1b',
        }}>
          {message}
        </div>
      )}

      {/* Active Proposals */}
      {activeProposals.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '16px', color: '#1f2937' }}>
            Aktif Öneriler ({activeProposals.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {activeProposals.map((proposal) => {
              const profile = profileMap[proposal.profileId];
              const statusInfo = PROPOSAL_STATUS[proposal.status as keyof typeof PROPOSAL_STATUS];
              const totalVotes = proposal.votesFor.length + proposal.votesAgainst.length;
              const quorumNeeded = Math.max(1, Math.floor((verifiers.length * (daoConfig?.quorumPercent || 50)) / 100));
              const approvalNeeded = Math.max(1, Math.floor((totalVotes * (daoConfig?.approvalPercent || 60)) / 100));
              const timeLeft = proposal.expiresAtEpoch - currentEpoch;

              return (
                <div key={proposal.id} style={{
                  border: '2px solid #e5e7eb',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  background: '#fff',
                }}>
                  {/* Header */}
                  <div style={{
                    padding: '16px 20px',
                    background: statusInfo.bg,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '16px', color: '#111827' }}>
                        {profile?.name || 'Yükleniyor...'}
                      </div>
                      <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>
                        Öneren: {shortenAddress(proposal.proposer)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        padding: '6px 14px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '600',
                        background: 'white',
                        color: statusInfo.color,
                      }}>
                        {statusInfo.label}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                        {timeLeft > 0 ? `${timeLeft} epoch kaldı` : 'Süre doldu'}
                      </div>
                    </div>
                  </div>

                  {/* Voting Stats */}
                  <div style={{ padding: '20px' }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr',
                      gap: '12px',
                      marginBottom: '16px',
                    }}>
                      <div style={{ padding: '12px', background: '#d1fae5', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: '700', color: '#059669' }}>
                          {proposal.votesFor.length}
                        </div>
                        <div style={{ fontSize: '12px', color: '#065f46' }}>Lehte</div>
                      </div>
                      <div style={{ padding: '12px', background: '#fee2e2', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: '700', color: '#dc2626' }}>
                          {proposal.votesAgainst.length}
                        </div>
                        <div style={{ fontSize: '12px', color: '#991b1b' }}>Aleyhte</div>
                      </div>
                      <div style={{ padding: '12px', background: '#f3f4f6', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: '700', color: '#374151' }}>
                          {totalVotes}/{quorumNeeded}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>Quorum</div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                        <span>Onay İlerlemesi</span>
                        <span>{proposal.votesFor.length}/{approvalNeeded} oy gerekli</span>
                      </div>
                      <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${Math.min(100, (proposal.votesFor.length / Math.max(1, approvalNeeded)) * 100)}%`,
                          background: proposal.votesFor.length >= approvalNeeded ? '#059669' : '#f59e0b',
                          transition: 'width 0.3s',
                        }} />
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '12px' }}>
                      {!hasVoted(proposal) && proposal.status === 0 && timeLeft > 0 && (
                        <>
                          <button
                            onClick={() => handleVote(proposal.id, true)}
                            disabled={voting === proposal.id}
                            style={{
                              flex: 1,
                              padding: '12px',
                              background: '#059669',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              fontWeight: '600',
                              cursor: voting === proposal.id ? 'not-allowed' : 'pointer',
                              opacity: voting === proposal.id ? 0.7 : 1,
                            }}
                          >
                            Lehte Oy Ver
                          </button>
                          <button
                            onClick={() => handleVote(proposal.id, false)}
                            disabled={voting === proposal.id}
                            style={{
                              flex: 1,
                              padding: '12px',
                              background: '#dc2626',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              fontWeight: '600',
                              cursor: voting === proposal.id ? 'not-allowed' : 'pointer',
                              opacity: voting === proposal.id ? 0.7 : 1,
                            }}
                          >
                            Aleyhte Oy Ver
                          </button>
                        </>
                      )}

                      {hasVoted(proposal) && (
                        <div style={{
                          flex: 1,
                          padding: '12px',
                          background: '#f3f4f6',
                          borderRadius: '8px',
                          textAlign: 'center',
                          color: '#6b7280',
                        }}>
                          ✓ Oy kullandınız
                        </div>
                      )}

                      {canExecute(proposal) && (
                        <button
                          onClick={() => handleExecuteProposal(proposal)}
                          disabled={executing === proposal.id}
                          style={{
                            flex: 1,
                            padding: '12px',
                            background: '#7c3aed',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: '600',
                            cursor: executing === proposal.id ? 'not-allowed' : 'pointer',
                            opacity: executing === proposal.id ? 0.7 : 1,
                          }}
                        >
                          ⚡ Yürüt
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pending Profiles (No Proposal Yet) */}
      <div>
        <h3 style={{ fontSize: '18px', marginBottom: '16px', color: '#1f2937' }}>
          Öneri Bekleyen Başvurular ({pendingProfiles.length})
        </h3>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>Yükleniyor...</div>
        ) : pendingProfiles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
            Öneri bekleyen başvuru bulunmuyor
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {pendingProfiles.map((profile) => (
              <div key={profile.id} style={{
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                overflow: 'hidden',
                background: '#fff',
              }}>
                <div style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid #f3f4f6',
                  background: '#fafafa',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '16px', color: '#111827' }}>{profile.name}</div>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>{profile.location}</div>
                  </div>
                  <div style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '600',
                    background: '#fef3c7',
                    color: '#92400e',
                  }}>
                    {profile.needCategory}
                  </div>
                </div>

                <div style={{ padding: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '14px' }}>
                      <span style={{ color: '#6b7280' }}>Telefon:</span> {profile.phone || '-'}
                    </div>
                    <div style={{ fontSize: '14px' }}>
                      <span style={{ color: '#6b7280' }}>Aile:</span> {profile.familySize} kişi
                    </div>
                  </div>

                  {profile.description && (
                    <div style={{ fontSize: '14px', color: '#374151', marginBottom: '16px' }}>
                      {profile.description}
                    </div>
                  )}

                  {profile.evidenceBlobId && (
                    <a
                      href={getWalrusUrl(profile.evidenceBlobId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'block',
                        padding: '12px',
                        background: '#f1f5f9',
                        borderRadius: '8px',
                        color: '#475569',
                        textDecoration: 'none',
                        fontSize: '13px',
                        marginBottom: '16px',
                      }}
                    >
                      📷 Kanıt Fotoğrafını Görüntüle 
                    </a>
                  )}

                  <button
                    onClick={() => handleCreateProposal(profile.id)}
                    disabled={creatingProposal === profile.id}
                    style={{
                      width: '100%',
                      padding: '14px',
                      background: '#667eea',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '15px',
                      fontWeight: '600',
                      cursor: creatingProposal === profile.id ? 'not-allowed' : 'pointer',
                      opacity: creatingProposal === profile.id ? 0.7 : 1,
                    }}
                  >
                    {creatingProposal === profile.id ? 'Oluşturuluyor...' : '📝 Öneri Oluştur'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

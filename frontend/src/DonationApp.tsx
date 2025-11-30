import { useState } from 'react';
import { ConnectButton } from '@mysten/dapp-kit';
import { CoordinatorPanel } from './CoordinatorPanel';
import { DonationForm } from './DonationForm';
import { RecipientRegistration } from './RecipientRegistration';
import { RecipientList } from './RecipientList';
import { VerifierManagement } from './VerifierManagement';
import { DAOPanel } from './DAOPanel';
import { Dashboard } from './Dashboard';
import { ImpactNFTPanel } from './ImpactNFTPanel';
import { CreateRegistry } from './CreateRegistry';
import { AIDCHAIN_REGISTRY_ID } from './config';

export function DonationApp() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'donate' | 'packages' | 'register' | 'recipients' | 'dao-members' | 'dao-voting' | 'impact-nft' | 'create-registry'>('dashboard');

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-header-left">
          <div className="app-logo">AC</div>
          <div>
            <h1>AidChain</h1>
            <div className="app-subtitle">Blockchain Aid Platform</div>
          </div>
        </div>
        <div className="wallet-connect-wrapper">
          <ConnectButton />
        </div>
      </header>

      <div className="alert alert-info" style={{ margin: '1rem 0' }}>
        <div>
          <strong>AidChain V8 - DAO Sistemi</strong>
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
            DAO members are permanent - once added, they cannot be removed from blockchain.
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <a
              href={`https://testnet.suivision.xyz/object/${AIDCHAIN_REGISTRY_ID}`}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: '0.75rem', color: 'var(--primary-color)', textDecoration: 'none' }}
            >
              View on SuiVision
            </a>
          </div>
        </div>
      </div>

      <div className="tab-nav">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`tab-button ${activeTab === 'dashboard' ? 'active' : ''}`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab('donate')}
          className={`tab-button ${activeTab === 'donate' ? 'active' : ''}`}
        >
          Donate
        </button>
        <button
          onClick={() => setActiveTab('packages')}
          className={`tab-button ${activeTab === 'packages' ? 'active' : ''}`}
        >
          Packages
        </button>
        <button
          onClick={() => setActiveTab('register')}
          className={`tab-button ${activeTab === 'register' ? 'active' : ''}`}
        >
          Get Aid
        </button>
        <button
          onClick={() => setActiveTab('recipients')}
          className={`tab-button ${activeTab === 'recipients' ? 'active' : ''}`}
        >
          Recipients
        </button>
        <button
          onClick={() => setActiveTab('dao-members')}
          className={`tab-button ${activeTab === 'dao-members' ? 'active' : ''}`}
        >
          DAO Members
        </button>
        <button
          onClick={() => setActiveTab('dao-voting')}
          className={`tab-button ${activeTab === 'dao-voting' ? 'active' : ''}`}
        >
          Voting
        </button>
        <button
          onClick={() => setActiveTab('impact-nft')}
          className={`tab-button ${activeTab === 'impact-nft' ? 'active' : ''}`}
          style={{ background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)', color: '#000' }}
        >
          🏆 Impact NFT
        </button>
        <button
          onClick={() => setActiveTab('create-registry')}
          className={`tab-button ${activeTab === 'create-registry' ? 'active' : ''}`}
          style={{ marginLeft: 'auto', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
        >
          🏗️ New Registry
        </button>
      </div>

      <main className="main-layout">
        {activeTab === 'dashboard' && (
          <section style={{ gridColumn: '1 / -1' }}>
            <Dashboard />
          </section>
        )}

        {activeTab === 'donate' && (
          <section style={{ gridColumn: '1 / -1' }}>
            <DonationForm />
          </section>
        )}

        {activeTab === 'packages' && (
          <section style={{ gridColumn: '1 / -1' }}>
            <CoordinatorPanel />
          </section>
        )}
        
        {activeTab === 'register' && (
          <section style={{ gridColumn: '1 / -1' }}>
            <RecipientRegistration />
          </section>
        )}
        
        {activeTab === 'recipients' && (
          <section style={{ gridColumn: '1 / -1' }}>
            <RecipientList showVerifiedOnly={false} />
          </section>
        )}

        {activeTab === 'dao-members' && (
          <section style={{ gridColumn: '1 / -1' }}>
            <VerifierManagement />
          </section>
        )}

        {activeTab === 'dao-voting' && (
          <section style={{ gridColumn: '1 / -1' }}>
            <DAOPanel />
          </section>
        )}

        {activeTab === 'impact-nft' && (
          <section style={{ gridColumn: '1 / -1' }}>
            <ImpactNFTPanel />
          </section>
        )}

        {activeTab === 'create-registry' && (
          <section style={{ gridColumn: '1 / -1' }}>
            <CreateRegistry />
          </section>
        )}
      </main>
    </div>
  );
}

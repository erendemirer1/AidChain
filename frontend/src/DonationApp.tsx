import { useState } from 'react';
import { ConnectButton } from '@mysten/dapp-kit';
import { CoordinatorPanel } from './CoordinatorPanel';
import { DonationForm } from './DonationForm';
import { RecipientRegistration } from './RecipientRegistration';
import { RecipientList } from './RecipientList';
import { RecipientVerification } from './RecipientVerification';

export function DonationApp() {
  const [activeTab, setActiveTab] = useState<'donate' | 'packages' | 'register' | 'verify' | 'recipients'>('donate');

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-header-left">
          <div className="app-logo">AC</div>
          <div>
            <h1>AidChain</h1>
            <div className="app-subtitle">Blockchain Yardım Platformu</div>
          </div>
        </div>
        <div className="wallet-connect-wrapper">
          <ConnectButton />
        </div>
      </header>

      <div className="tab-nav">
        <button
          onClick={() => setActiveTab('donate')}
          className={`tab-button ${activeTab === 'donate' ? 'active' : ''}`}
        >
          Bağış Yap
        </button>
        <button
          onClick={() => setActiveTab('packages')}
          className={`tab-button ${activeTab === 'packages' ? 'active' : ''}`}
        >
          Paketler
        </button>
        <button
          onClick={() => setActiveTab('register')}
          className={`tab-button ${activeTab === 'register' ? 'active' : ''}`}
        >
          Yardım Al
        </button>
        <button
          onClick={() => setActiveTab('recipients')}
          className={`tab-button ${activeTab === 'recipients' ? 'active' : ''}`}
        >
          Alıcılar
        </button>
        <button
          onClick={() => setActiveTab('verify')}
          className={`tab-button ${activeTab === 'verify' ? 'active' : ''}`}
        >
          Onay Paneli
        </button>
      </div>

      <main className="main-layout">
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
        
        {activeTab === 'verify' && (
          <section style={{ gridColumn: '1 / -1' }}>
            <RecipientVerification />
          </section>
        )}
      </main>
    </div>
  );
}

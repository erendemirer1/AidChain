// src/useSponsoredTransaction.ts
// Enoki Sponsored Transaction Hook - Backend proxy üzerinden

import { useState, useCallback } from 'react';
import { useCurrentAccount, useSignTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { toB64, fromB64 } from '@mysten/sui/utils';
import { 
  ENOKI_NETWORK, 
  SPONSORED_TX_ENABLED,
  AIDCHAIN_PACKAGE_ID,
  SPONSOR_BACKEND_URL
} from './config';

export interface SponsoredTxResult {
  digest: string;
  success: boolean;
  error?: string;
}

export interface UseSponsoredTransactionReturn {
  executeSponsored: (tx: Transaction, allowedTargets?: string[]) => Promise<SponsoredTxResult>;
  isLoading: boolean;
  isEnabled: boolean;
  error: string | null;
}

export function useSponsoredTransaction(): UseSponsoredTransactionReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const currentAccount = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signTransaction } = useSignTransaction();

  const executeSponsored = useCallback(async (
    tx: Transaction,
    allowedTargets?: string[]
  ): Promise<SponsoredTxResult> => {
    if (!currentAccount) {
      return { digest: '', success: false, error: 'Cüzdan bağlı değil' };
    }

    if (!SPONSORED_TX_ENABLED) {
      return { digest: '', success: false, error: 'Sponsored transactions etkin değil' };
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Transaction'ı kind bytes olarak derle
      const txBytes = await tx.build({
        client,
        onlyTransactionKind: true,
      });

      // 2. Default allowed targets - AidChain package fonksiyonları
      const targets = allowedTargets || [
        `${AIDCHAIN_PACKAGE_ID}::aidchain::donate`,
        `${AIDCHAIN_PACKAGE_ID}::aidchain::register_recipient`,
        `${AIDCHAIN_PACKAGE_ID}::aidchain::create_verification_proposal`,
        `${AIDCHAIN_PACKAGE_ID}::aidchain::vote_on_proposal`,
        `${AIDCHAIN_PACKAGE_ID}::aidchain::execute_proposal`,
      ];

      console.log('Creating sponsored tx via backend:', {
        network: ENOKI_NETWORK,
        sender: currentAccount.address,
        targets,
      });

      // 3. Backend'e sponsor isteği gönder
      const sponsorResponse = await fetch(`${SPONSOR_BACKEND_URL}/api/sponsor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          network: ENOKI_NETWORK,
          transactionKindBytes: toB64(txBytes),
          sender: currentAccount.address,
          allowedMoveCallTargets: targets,
        }),
      });

      if (!sponsorResponse.ok) {
        const errorData = await sponsorResponse.json();
        throw new Error(errorData.error || 'Sponsor request failed');
      }

      const sponsoredData = await sponsorResponse.json();
      console.log('Sponsored response:', sponsoredData);

      // 4. Kullanıcıdan imza al
      const { signature } = await signTransaction({
        transaction: Transaction.from(fromB64(sponsoredData.bytes)),
      });

      if (!signature) {
        throw new Error('İmza alınamadı');
      }

      // 5. Backend'e execute isteği gönder
      const executeResponse = await fetch(`${SPONSOR_BACKEND_URL}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          digest: sponsoredData.digest,
          signature,
        }),
      });

      if (!executeResponse.ok) {
        const errorData = await executeResponse.json();
        throw new Error(errorData.error || 'Execute request failed');
      }

      const executeData = await executeResponse.json();
      console.log('Execute response:', executeData);

      setIsLoading(false);
      return {
        digest: executeData.digest,
        success: true,
      };

    } catch (err: any) {
      console.error('Sponsored tx error:', err);
      
      let errorMessage = err?.message || 'Sponsored transaction başarısız';
      
      // Network hatası
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        errorMessage = 'Backend sunucusuna bağlanılamadı. Backend çalışıyor mu?';
      }
      
      setError(errorMessage);
      setIsLoading(false);
      
      return {
        digest: '',
        success: false,
        error: errorMessage,
      };
    }
  }, [currentAccount, client, signTransaction]);

  return {
    executeSponsored,
    isLoading,
    isEnabled: SPONSORED_TX_ENABLED,
    error,
  };
}

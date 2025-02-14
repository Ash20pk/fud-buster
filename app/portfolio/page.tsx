'use client';

import { useEffect, useState } from 'react';
import Portfolio from '@/components/PortfolioPage';
import Header from '@/components/Header';
import { useRouter } from 'next/navigation';

interface Address {
  networkId?: string;
  id?: string;
  model?: string;
  key?: string;
  address?: string;
}

interface WalletInfo {
  walletId: string;
  addresses: Address[];
}

export default function Page() {
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Check for wallet data on mount
  useEffect(() => {
    const checkWallet = async () => {
      try {
        const storedWalletId = localStorage.getItem('walletId');
        const storedAddresses = localStorage.getItem('addresses');

        if (!storedWalletId || !storedAddresses) {
          throw new Error('No wallet data found');
        }

        let addresses: Address[];
        try {
          addresses = JSON.parse(storedAddresses || '[]') as Address[];
          if (!Array.isArray(addresses)) {
            throw new Error('Invalid addresses format');
          }
        } catch {
          throw new Error('Invalid wallet data');
        }

        // Verify wallet data with the API
        const response = await fetch(`/api/wallet/verify?walletId=${storedWalletId}`);
        if (!response.ok) {
          throw new Error('Invalid wallet');
        }

        setWalletInfo({ walletId: storedWalletId, addresses });
      } catch (err) {
        console.error('Failed to load wallet data:', err);
        localStorage.removeItem('walletId');
        localStorage.removeItem('addresses');
        router.push('/');
      } finally {
        setIsLoading(false);
      }
    };

    checkWallet();
  }, [router]);

  if (!walletInfo) {
    return (
      <div className="container mx-auto p-6 text-center">
        <p className="text-gray-500">Please connect your wallet first</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <Header walletInfo={walletInfo} />
      <Portfolio walletId={walletInfo.walletId} addresses={walletInfo.addresses.map(a => a.address).filter((a): a is string => a != null)} />
    </div>
  );
}
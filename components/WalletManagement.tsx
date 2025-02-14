import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRouter } from 'next/navigation';

interface WalletData {
  id: string;
  network: string;
  addresses: string[];
  defaultAddress: string | null;
  balances: Record<string, number>;
}

const WalletManager = ({ onWalletSelect }: { onWalletSelect: (walletId: string) => void }) => {
  const router = useRouter();
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const savedWalletId = localStorage.getItem('selectedWalletId');
    if (savedWalletId) {
      fetchWalletData(savedWalletId);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchWalletData = async (walletId: string) => {
    try {
      const response = await fetch(`/api/wallet/${walletId}`);
      if (!response.ok) throw new Error('Failed to fetch wallet data');
      
      const data = await response.json();
      setWalletData(data);
      localStorage.setItem('selectedWalletId', walletId);
      onWalletSelect(walletId);
    } catch (err) {
      setError('Failed to fetch wallet data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wallet Details</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div>Loading...</div>
        ) : walletData ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium mb-1">Network</h3>
                <p className="text-sm text-gray-600">{walletData.network}</p>
              </div>
              <div>
                <h3 className="font-medium mb-1">Default Address</h3>
                <p className="text-sm text-gray-600 truncate">
                  {walletData.defaultAddress || 'Not set'}
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-2">Connected Addresses</h3>
              <div className="space-y-2">
                {walletData.addresses.map((address) => (
                  <div key={address} className="text-sm bg-gray-50 p-2 rounded">
                    {address}
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <h3 className="font-medium mb-2">Assets</h3>
              <div className="space-y-2">
                {Object.entries(walletData.balances).map(([asset, balance]) => (
                  <div
                    key={asset}
                    className="p-3 border rounded-lg hover:bg-accent cursor-pointer"
                    onClick={() => {
                      router.push(`/portfolio?asset=${encodeURIComponent(asset)}`);
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <span>{asset}</span>
                      <span>{balance}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-2">Balances</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(walletData.balances).map(([currency, amount]) => (
                  <div key={currency} className="flex justify-between bg-gray-50 p-2 rounded">
                    <span className="font-medium">{currency}</span>
                    <span>{amount}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Connect your wallet to start tracking your portfolio
            </p>
            <Button
              onClick={() => {
                // Here you would typically integrate with Coinbase's connect flow
                // For now, we'll use a mock wallet ID
                fetchWalletData('mock-wallet-id');
              }}
              disabled={loading}
            >
              Connect Wallet
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WalletManager;
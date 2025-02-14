'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wallet, Import } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [mnemonicPhrase, setMnemonicPhrase] = useState('');

  // Check for existing wallet on initial load
  useEffect(() => {
    const walletId = localStorage.getItem('walletId');
    if (walletId) {
      router.push('/portfolio');
    }
  }, [router]);

  const handleCreateWallet = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create' })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create wallet');
      }

      // Store wallet info in localStorage
      localStorage.setItem('walletId', data.wallet);
      localStorage.setItem('addresses', JSON.stringify(data.addresses));

      toast.success('Wallet created successfully');
      router.push('/portfolio');
    } catch (err) {
      toast.error('Failed to create wallet. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleImportWallet = async () => {
    if (!mnemonicPhrase.trim()) {
      toast.error('Please enter your recovery phrase');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import',
          mnemonicPhrase: mnemonicPhrase.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import wallet');
      }

      // Store wallet info in localStorage
      localStorage.setItem('walletId', data.wallet);
      localStorage.setItem('addresses', JSON.stringify(data.addresses));

      toast.success('Wallet imported successfully');
      setImportDialogOpen(false);
      router.push('/portfolio');
    } catch (err) {
      toast.error('Failed to import wallet. Please check your recovery phrase.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800">
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl font-bold text-white">
              Crypto FUD Buster
            </h1>
            <p className="text-xl text-gray-300">
              Track and analyze your portfolio with AI-powered FUD detection
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mt-12">
            {/* Create New Wallet */}
            <Card className="bg-white/5 backdrop-blur border-transparent hover:bg-white/10 transition-colors cursor-pointer"
                  onClick={handleCreateWallet}>
              <CardContent className="flex flex-col items-center space-y-4 p-6">
                <Wallet className="h-12 w-12 text-blue-400" />
                <h2 className="text-xl font-semibold text-white">Create New Wallet</h2>
                <p className="text-gray-400 text-center">
                  Start fresh with a new wallet and begin your crypto journey
                </p>
                <Button 
                  variant="default" 
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? 'Creating...' : 'Create Wallet'}
                </Button>
              </CardContent>
            </Card>

            {/* Import Wallet */}
            <Card className="bg-white/5 backdrop-blur border-transparent hover:bg-white/10 transition-colors cursor-pointer"
                  onClick={() => setImportDialogOpen(true)}>
              <CardContent className="flex flex-col items-center space-y-4 p-6">
                <Import className="h-12 w-12 text-green-400" />
                <h2 className="text-xl font-semibold text-white">Import Wallet</h2>
                <p className="text-gray-400 text-center">
                  Import your existing wallet using a recovery phrase
                </p>
                <Button 
                  variant="outline" 
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? 'Importing...' : 'Import Wallet'}
                </Button>
              </CardContent>
            </Card>
          </div>

          <p className="text-sm text-gray-400 mt-8">
            Your keys, your crypto. We never store your private keys.
          </p>
        </div>
      </main>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Wallet</DialogTitle>
            <DialogDescription>
              Enter your recovery phrase to import your existing wallet
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="Enter recovery phrase"
              value={mnemonicPhrase}
              onChange={(e) => setMnemonicPhrase(e.target.value)}
              className="w-full"
            />
            <Button 
              onClick={handleImportWallet} 
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Importing...' : 'Import Wallet'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
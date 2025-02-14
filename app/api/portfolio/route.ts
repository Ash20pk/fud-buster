import { NextResponse } from 'next/server';
import { Wallet } from '@coinbase/coinbase-sdk';
import '@/lib/coinbase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const walletId = searchParams.get('walletId');

  if (!walletId) {
    return NextResponse.json(
      { error: 'Wallet ID is required' },
      { status: 400 }
    );
  }

  try {
    // Fetch wallet data using Coinbase SDK
    const wallet = await Wallet.fetch(walletId);
    const balances = await wallet.listBalances();
    
    // Format balances into portfolio assets
    const assets = [];
    for (const [currency, balance] of balances) {
      // Only include non-zero balances
      if (parseFloat(balance.toString()) > 0) {
        assets.push({
          id: `${walletId}-${currency}`,
          coin: currency,
          amount: parseFloat(balance.toString()),
          value: 0, // You'll need to fetch current prices to calculate this
          lastUpdated: new Date().toISOString()
        });
      }
    }

    return NextResponse.json(assets);
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    return NextResponse.json(
      { error: 'Failed to fetch portfolio' },
      { status: 500 }
    );
  }
}
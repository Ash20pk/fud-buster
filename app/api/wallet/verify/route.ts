// app/api/wallet/verify/route.ts
import { NextResponse } from 'next/server';
import { Wallet } from '@coinbase/coinbase-sdk';
import '@/lib/coinbase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletId = searchParams.get('walletId');

    if (!walletId) {
      return NextResponse.json(
        { error: 'Wallet ID is required' },
        { status: 400 }
      );
    }

    // Verify wallet exists and is accessible
    const wallet = await Wallet.fetch(walletId);
    const addresses = await wallet.listAddresses();

    return NextResponse.json({
      success: true,
      addresses: addresses.map(addr => addr.getId())
    });
  } catch (error) {
    console.error('Wallet verification error:', error);
    return NextResponse.json(
      { error: 'Invalid wallet' },
      { status: 401 }
    );
  }
}
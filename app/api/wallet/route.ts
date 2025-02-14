import { NextResponse } from 'next/server';
import { Wallet, Coinbase } from '@coinbase/coinbase-sdk';
import '@/lib/coinbase';

export async function POST(request: Request) {
  try {
    const { action, mnemonicPhrase } = await request.json();

    let wallet;
    let addresses;

    switch (action) {
      case 'create':
        wallet = await Wallet.create();
        addresses = await wallet.listAddresses();
        return NextResponse.json({
          success: true,
          addresses,
          wallet: wallet.getId()
        });

      case 'import':
        if (!mnemonicPhrase) {
          return NextResponse.json(
            { error: 'Mnemonic phrase is required' },
            { status: 400 }
          );
        }
        
        wallet = await Wallet.import(
          { mnemonicPhrase }, 
          Coinbase.networks.BaseSepolia
        );
        addresses = await wallet.listAddresses();
        return NextResponse.json({
          success: true,
          addresses,
          wallet: wallet.getId()
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Wallet operation error:', error);
    return NextResponse.json(
      { error: 'Failed to perform wallet operation' },
      { status: 500 }
    );
  }
}
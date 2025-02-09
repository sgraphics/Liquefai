import { AlphaRouter, SwapType } from "@uniswap/smart-order-router";
import { CurrencyAmount, Ether, Token } from "@uniswap/sdk-core";
import { ethers } from "ethers";
import { NextResponse } from 'next/server';

const BASE_CHAIN_ID = 8453;

export async function POST(request: Request) {
  try {
    const { inputAmount, splits } = await request.json();

    // Create provider
    const provider = new ethers.providers.JsonRpcProvider(
      process.env.BASE_RPC_URL // Add this to your .env
    );

    const router = new AlphaRouter({
      chainId: BASE_CHAIN_ID,
      provider,
      v3SubgraphProvider: undefined,
      tokenProvider: {
        getTokens: async () => ({
          'base-mainnet': {
            WETH: {
              address: '0x4200000000000000000000000000000000000006',
              decimals: 18,
              symbol: 'WETH',
              name: 'Wrapped Ether',
            },
            USDbC: {
              address: '0xd9e0b51D8E6567043538ff902eF0F50765f63280',
              decimals: 6,
              symbol: 'USDbC',
              name: 'USD Base Coin',
            },
          },
        }),
      },
    });

    // Rest of your findSplitRoutes logic here...
    const routes = [];
    const totalEthAmount = ethers.utils.parseEther(inputAmount);

    for (const split of splits) {
      // Your existing route finding logic...
    }

    return NextResponse.json({ 
      success: true,
      routes,
      totalInputValue,
      calldata 
    });

  } catch (error) {
    console.error('Error in route calculation:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
} 
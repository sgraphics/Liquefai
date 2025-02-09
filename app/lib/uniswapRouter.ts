import { AlphaRouter, SwapRoute, SwapType } from "@uniswap/smart-order-router";
import { ChainId, CurrencyAmount, Ether, Token, Fraction } from "@uniswap/sdk-core";
import { ethers } from "ethers";
import type { Provider } from "@ethersproject/providers";
import JSBI from 'jsbi';

// Example token definitions for Base mainnet (Chain ID 8453)
const TOKENS = {
  // Switch from 'base-sepolia' to 'base-mainnet'
  'base-mainnet': {
    WETH: {
      address: '0x4200000000000000000000000000000000000006',
      decimals: 18,
      symbol: 'WETH',
      name: 'Wrapped Ether',
    },
    USDbC: {
      // NOTE: This is an example address; verify you have the correct Base mainnet USDbC address.
      address: '0xd9e0b51D8E6567043538ff902eF0F50765f63280',
      decimals: 6,
      symbol: 'USDbC',
      name: 'USD Base Coin',
    },
  },
};

// Adapter to make ethers v6 provider look like v5 provider
class ProviderAdapter {
  constructor(private provider: Provider) {}

  async getNetwork() {
    const network = await this.provider.getNetwork();
    return { chainId: network.chainId };
  }

  async getAddress() {
    return ZeroAddress;
  }

  // Add other v5 methods as needed
  async call(tx: any) {
    return this.provider.call(tx);
  }
}

export interface TokenConfig {
  address: string;
  decimals: number;
  symbol: string;
  name: string;
}

export interface RouteQuote {
  route: any;  // Simplified for client
  outputAmount: string;
  outputToken: string;
}

export interface MultiRouteResult {
  routes: RouteQuote[];
  totalInputValue: string;
  calldata: string[];
}

export async function findSplitRoutes(
  provider: Provider,
  chainId: number = 8453,
  inputAmount: string,
  splits: { token: TokenConfig; percentage: number }[]
): Promise<MultiRouteResult> {
  const response = await fetch('/api/uniswap', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputAmount,
      splits,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch route');
  }

  const result = await response.json();
  return result;
} 
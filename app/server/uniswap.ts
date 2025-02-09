'use server'
import 'server-only';

import { AlphaRouter, SwapRoute, SwapType } from "@uniswap/smart-order-router";
import { CurrencyAmount, Ether, Token, WETH9, Fraction } from "@uniswap/sdk-core";
import { ethers } from "ethers";
import { getTokenBySymbol } from '../lib/uniswapGraph';
import type { CdpWalletProvider } from "@coinbase/agentkit";

// ----------------------------------------------------------------------------------
// 1) CONFIGURE BASIC PARAMETERS
// ----------------------------------------------------------------------------------

const CHAIN_ID = 8453; // Base mainnet
const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const UNISWAP_V3_ROUTER_ADDRESS = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

const routerAbi = [
  "function multicall(bytes[] calldata data) payable returns (bytes[] memory results)",
];

// ----------------------------------------------------------------------------------
// 2) HELPER FUNCTIONS
// ----------------------------------------------------------------------------------

async function getBestRoute(
  provider: ethers.providers.Provider,
  amountInEther: string,
  tokenIn: Token,
  tokenOut: Token,
  recipient: string,
  slippageBps: number = 50 // 0.50% slippage
): Promise<SwapRoute | null> {
  // Create a provider with retry logic
  const providerWithRetry = new ethers.providers.StaticJsonRpcProvider(RPC_URL, {
    chainId: CHAIN_ID,
    name: 'Base',
    ensAddress: null,
  });

  const router = new AlphaRouter({ 
    chainId: CHAIN_ID, 
    provider: providerWithRetry,
    tokenProvider: {
      getTokens: async () => ({
        WETH: {
          address: '0x4200000000000000000000000000000000000006',
          decimals: 18,
          symbol: 'WETH',
          name: 'Wrapped Ether',
        }
      }),
      getTokenByAddress: async () => null,
      getTokenBySymbol: async () => null,
      getAllTokens: async () => []
    }
  });

  // Add error handling and retries
  try {
    // Verify network connection
    await providerWithRetry.getNetwork();
    
    // Convert amount to CurrencyAmount
    const amountIn = CurrencyAmount.fromRawAmount(
      tokenIn,
      ethers.utils.parseUnits(amountInEther, tokenIn.decimals).toString()
    );

    const route = await router.route(
      amountIn,
      tokenOut,
      SwapType.EXACT_INPUT,
      {
        recipient,
        slippageTolerance: {
          numerator: slippageBps,
          denominator: 10_000,
        },
        deadline: Math.floor(Date.now() / 1000) + 1200 // 20 minutes
      }
    );
    return route;
  } catch (err) {
    console.error(`Failed to get best route for ${tokenOut.symbol}:`, err);
    return null;
  }
}

async function buildRouteCallData(route: SwapRoute, portionLabel: string): Promise<string> {
  if (!route.methodParameters) {
    throw new Error(`No methodParameters found on route for ${portionLabel}`);
  }
  return route.methodParameters.calldata;
}

// ----------------------------------------------------------------------------------
// 3) MAIN FUNCTION
// ----------------------------------------------------------------------------------

export async function getRoutes(
  walletProvider: CdpWalletProvider,
  params: {
    inputToken: string;
    inputAmount: string;
    splits: Array<{
      token: string;
      percentage: number;
    }>;
  }
) {
  try {
    const { inputToken, inputAmount, splits } = params;
    
    // Get recipient address first to fail fast if wallet is not available
    const recipient = await walletProvider.getAddress();
    
    // Validate total percentage equals 100
    const totalPercentage = splits.reduce((sum, split) => sum + split.percentage, 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      throw new Error(`Total percentage must equal 100, got ${totalPercentage}`);
    }

    // Get source token with better error handling
    const sourceToken = await getTokenBySymbol(inputToken);
    if (!sourceToken) {
      throw new Error(`Input token ${inputToken} not found or not supported`);
    }

    const tokenIn = new Token(
      CHAIN_ID,
      sourceToken.id,
      parseInt(sourceToken.decimals),
      sourceToken.symbol,
      sourceToken.name
    );

    // Process routes in parallel with better error handling
    const routeResults = await Promise.allSettled(
      splits.map(async (split) => {
        const outputToken = await getTokenBySymbol(split.token);
        if (!outputToken) {
          throw new Error(`Output token ${split.token} not found or not supported`);
        }

        const tokenOut = new Token(
          CHAIN_ID,
          outputToken.id,
          parseInt(outputToken.decimals),
          outputToken.symbol,
          outputToken.name
        );

        const portionAmount = (Number(inputAmount) * (split.percentage / 100)).toString();
        const route = await getBestRoute(
          null, // provider is created inside getBestRoute now
          portionAmount,
          tokenIn,
          tokenOut,
          recipient
        );

        if (!route) {
          throw new Error(`No route found for ${split.token}`);
        }

        const calldata = await buildRouteCallData(route, split.token);
        return {
          inputToken: tokenIn.symbol,
          outputToken: tokenOut.symbol,
          percentage: split.percentage,
          quote: route.quote.toSignificant(6),
          methodParameters: route.methodParameters,
          calldata
        };
      })
    );

    // Process results and handle errors
    const successfulRoutes = routeResults
      .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
      .map(result => result.value);

    const failedRoutes = routeResults
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map(result => result.reason);

    if (failedRoutes.length > 0) {
      console.error('Some routes failed:', failedRoutes);
      throw new Error(`Failed to find routes: ${failedRoutes.map(e => e.message).join(', ')}`);
    }

    return {
      success: true,
      data: {
        routes: successfulRoutes,
        totalInputValue: successfulRoutes.reduce((sum, route) => 
          sum.add(ethers.BigNumber.from(route.methodParameters?.value || 0)),
          ethers.BigNumber.from(0)
        ).toString(),
        calldata: successfulRoutes.map(r => r.calldata)
      }
    };

  } catch (error) {
    console.error('Error finding routes:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    };
  }
} 
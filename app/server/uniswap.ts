'use server'
import 'server-only';

import { AlphaRouter, SwapRoute, SwapType, SwapOptionsSwapRouter02 } from "@uniswap/smart-order-router";
import { CurrencyAmount, Ether, Token, WETH9, Fraction, Percent, TradeType } from "@uniswap/sdk-core";
import { ethers } from "ethers";
import { getTokenBySymbol } from '../lib/uniswapGraph';
import type { CdpWalletProvider } from "@coinbase/agentkit";
import JSBI from 'jsbi';
import { Contract } from '@ethersproject/contracts';
import { Interface } from '@ethersproject/abi';
import { Multicall } from '@uniswap/v3-periphery/contracts/interfaces/IMulticall';

// ----------------------------------------------------------------------------------
// 1) CONFIGURE BASIC PARAMETERS
// ----------------------------------------------------------------------------------

const CHAIN_ID = 8453; // Base mainnet
const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const UNISWAP_V3_ROUTER_ADDRESS = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

const routerAbi = [
  "function multicall(bytes[] calldata data) payable returns (bytes[] memory results)",
];

// Add multicall configuration
const MULTICALL_ADDRESS = '0x091e99cb1C49331a94dD62755D168E941AbD0693';
const multicallInterface = new Interface([
  'function aggregate(tuple(address target, bytes callData)[] calls) view returns (uint256 blockNumber, bytes[] returnData)',
]);

// ----------------------------------------------------------------------------------
// 2) HELPER FUNCTIONS
// ----------------------------------------------------------------------------------

// Add a retry helper function
async function withRetry<T>(
  operation: () => Promise<T>,
  retries = MAX_RETRIES
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(`[withRetry] Operation failed:`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      remainingRetries: retries,
    });
    
    if (retries > 0) {
      console.log(`[withRetry] Retrying operation in ${RETRY_DELAY}ms, ${retries} attempts remaining...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return withRetry(operation, retries - 1);
    }
    throw error;
  }
}

const getProvider = () => {
  if (!process.env.BASE_RPC_URL) {
    console.error('[getProvider] BASE_RPC_URL environment variable is not set');
    throw new Error('BASE_RPC_URL environment variable is not set');
  }

  // Log the environment we're running in
  console.log('[getProvider] Environment:', {
    nodeEnv: process.env.NODE_ENV,
    isServer: typeof window === 'undefined',
    baseUrl: process.env.BASE_RPC_URL.replace(/([A-Za-z0-9]{4})[A-Za-z0-9]+([A-Za-z0-9]{4})/, '$1...$2')
  });

  try {
    // Try creating provider with network specification
    const provider = new ethers.providers.JsonRpcProvider({
      url: process.env.BASE_RPC_URL,
      skipFetchSetup: true, // This can help with Next.js server environment
    }, {
      name: 'base',
      chainId: CHAIN_ID,
    });

    // Add request logging
    const originalSend = provider.send.bind(provider);
    provider.send = async (method, params) => {
      console.log('[Provider] Sending RPC request:', { method, params });
      try {
        const result = await originalSend(method, params);
        console.log('[Provider] RPC response received');
        return result;
      } catch (error) {
        console.error('[Provider] RPC request failed:', error);
        throw error;
      }
    };

    return provider;
  } catch (error) {
    console.error('[getProvider] Failed to create provider:', error);
    throw error;
  }
};

async function getBestRoute(
  amountInEther: string,
  tokenIn: Token,
  tokenOut: Token,
  recipient: string,
  slippageBps: number = 50
): Promise<SwapRoute | null> {
  console.log(`[getBestRoute] Using RPC URL: ${RPC_URL}`);
  
  try {
    const provider = getProvider();
    
    console.log(`[getBestRoute] Created provider for chain ID: ${CHAIN_ID}`);
    console.log(`[getBestRoute] Swapping from ${tokenIn.symbol} to ${tokenOut.symbol}`);

    // Create multicall contract instance
    const multicall = new Contract(MULTICALL_ADDRESS, multicallInterface, provider);

    const router = new AlphaRouter({ 
      chainId: CHAIN_ID, 
      provider,
      multicall2Provider: {
        async callSameFunctionOnMultipleContracts(params: any) {
          const { addresses, contractInterface, functionName, functionParams } = params;
          const callData = contractInterface.encodeFunctionData(functionName, functionParams);
          
          const calls = addresses.map((address: string) => ({
            target: address,
            callData,
          }));

          const [, returnData] = await multicall.aggregate(calls);
          return returnData.map((data: string) => 
            contractInterface.decodeFunctionResult(functionName, data)
          );
        },
        
        async callMultipleFunctionsOnSameContract(params: any) {
          const { address, contractInterface, functionNames, functionParams } = params;
          
          const calls = functionNames.map((functionName: string, i: number) => ({
            target: address,
            callData: contractInterface.encodeFunctionData(functionName, functionParams[i]),
          }));

          const [, returnData] = await multicall.aggregate(calls);
          return returnData.map((data: string, i: number) => 
            contractInterface.decodeFunctionResult(functionNames[i], data)
          );
        }
      }
    });

    // Convert amount to CurrencyAmount more carefully
    let amountIn;
    try {
      const rawAmount = ethers.utils.parseUnits(amountInEther, tokenIn.decimals);
      amountIn = CurrencyAmount.fromRawAmount(
        tokenIn,
        rawAmount.toString()
      );
      console.log(`[getBestRoute] Calculated input amount: ${amountIn.toExact()} ${tokenIn.symbol}`);
    } catch (error) {
      console.error('[getBestRoute] Error parsing amount:', error);
      throw new Error(`Failed to parse amount: ${amountInEther} ${tokenIn.symbol}`);
    }

    const options: SwapOptionsSwapRouter02 = {
      recipient,
      slippageTolerance: new Percent(slippageBps, 10000),
      deadline: Math.floor(Date.now() / 1000 + 1200),
      type: SwapType.SWAP_ROUTER_02,
    };

    console.log('[getBestRoute] Finding route with options:', {
      recipient,
      slippageBps,
      deadline: options.deadline
    });

    // Get route with retry
    const route = await withRetry(async () => {
      console.log('[getBestRoute] Requesting route from AlphaRouter...');
      const result = await router.route(
        amountIn,
        tokenOut,
        TradeType.EXACT_INPUT,
        options
      );
      console.log('[getBestRoute] Route received:', result ? 'Success' : 'No route found');
      return result;
    });

    return route;
  } catch (err) {
    console.error(`[getBestRoute] Error details:`, {
      error: err,
      message: err instanceof Error ? err.message : 'Unknown error',
      tokenIn: tokenIn.symbol,
      tokenOut: tokenOut.symbol,
      chainId: CHAIN_ID,
      rpcUrl: RPC_URL.replace(/([A-Za-z0-9]{4})[A-Za-z0-9]+([A-Za-z0-9]{4})/, '$1...$2'),
    });
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
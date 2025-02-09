import { Interface } from '@ethersproject/abi';
import { Token } from '@uniswap/sdk-core';
import { CdpWalletProvider } from "@coinbase/agentkit";
import { ReadContractParameters } from 'viem';

// Uniswap V3 Quoter ABI (only the method we need)
const QUOTER_ABI = [
  'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)'
];

// Standard Uniswap V3 fees in basis points
const UNISWAP_FEES = [100, 500, 3000, 10000];

interface SwapPath {
  inputToken: Token;
  outputToken: Token;
  baseToken?: Token;
  fee1: number;
  fee2?: number;
  outputAmount: bigint;
  path: string[];
}

interface PathFinderParams {
  amount: bigint;
  inputToken: Token;
  baseTokens: Token[];
  outputTokens: Token[];
  quoterAddress: string;
  walletProvider: CdpWalletProvider;
}

export class UniswapPathFinder {
  private quoterAddress: string;
  private walletProvider: CdpWalletProvider;
  private quoterInterface: Interface;

  constructor(quoterAddress: string, walletProvider: CdpWalletProvider) {
    this.quoterAddress = quoterAddress;
    this.walletProvider = walletProvider;
    this.quoterInterface = new Interface(QUOTER_ABI);
  }

  private async getQuote(
    tokenIn: Token,
    tokenOut: Token,
    fee: number,
    amountIn: bigint
  ): Promise<bigint> {
    try {
      console.log(`📊 Checking pool ${tokenIn.symbol} -> ${tokenOut.symbol} (fee: ${fee/10000}%)`);
      const params: ReadContractParameters = {
        address: this.quoterAddress as `0x${string}`,
        abi: [{
          name: 'quoteExactInputSingle',
          type: 'function',
          inputs: [
            { name: 'tokenIn', type: 'address' },
            { name: 'tokenOut', type: 'address' },
            { name: 'fee', type: 'uint24' },
            { name: 'amountIn', type: 'uint256' },
            { name: 'sqrtPriceLimitX96', type: 'uint160' }
          ],
          outputs: [{ type: 'uint256' }],
          stateMutability: 'nonpayable'
        }],
        functionName: 'quoteExactInputSingle',
        args: [tokenIn.address, tokenOut.address, fee, amountIn, BigInt(0)]
      };

      const quote = await this.walletProvider.readContract(params);
      return BigInt(quote.toString());
    } catch (error) {
      return BigInt(0);
    }
  }

  private async findDirectPath(
    amount: bigint,
    inputToken: Token,
    outputToken: Token
  ): Promise<SwapPath[]> {
    const paths: SwapPath[] = [];

    for (const fee of UNISWAP_FEES) {
      const outputAmount = await this.getQuote(inputToken, outputToken, fee, amount);
      
      if (outputAmount > 0) {
        paths.push({
          inputToken,
          outputToken,
          fee1: fee,
          outputAmount,
          path: [inputToken.address, outputToken.address]
        });
      }
    }

    return paths;
  }

  private async findPathThroughBase(
    amount: bigint,
    inputToken: Token,
    baseToken: Token,
    outputToken: Token
  ): Promise<SwapPath[]> {
    const paths: SwapPath[] = [];

    for (const fee1 of UNISWAP_FEES) {
      const intermediateAmount = await this.getQuote(inputToken, baseToken, fee1, amount);
      
      if (intermediateAmount > 0) {
        for (const fee2 of UNISWAP_FEES) {
          const finalAmount = await this.getQuote(baseToken, outputToken, fee2, intermediateAmount);
          
          if (finalAmount > 0) {
            paths.push({
              inputToken,
              outputToken,
              baseToken,
              fee1,
              fee2,
              outputAmount: finalAmount,
              path: [inputToken.address, baseToken.address, outputToken.address]
            });
          }
        }
      }
    }

    return paths;
  }

  async findBestPaths({
    amount,
    inputToken,
    baseTokens,
    outputTokens,
    quoterAddress,
    walletProvider
  }: {
    amount: bigint;
    inputToken: Token;
    baseTokens: Token[];
    outputTokens: Token[];
    quoterAddress: string;
    walletProvider: CdpWalletProvider;
  }): Promise<Path[]> {
    console.log('Input Token:', inputToken);
    console.log('Base Tokens:', baseTokens);
    console.log('Output Tokens:', outputTokens);

    console.log(`🛣️ Finding paths from ${inputToken.symbol} to [${outputTokens.map(t => t.symbol).join(', ')}]`);
    const allPaths: SwapPath[] = [];

    // Find direct paths
    for (const outputToken of outputTokens) {
      const directPaths = await this.findDirectPath(amount, inputToken, outputToken);
      allPaths.push(...directPaths);
    }

    // Find paths through base tokens
    for (const baseToken of baseTokens) {
      for (const outputToken of outputTokens) {
        const basePaths = await this.findPathThroughBase(
          amount,
          inputToken,
          baseToken,
          outputToken
        );
        allPaths.push(...basePaths);
      }
    }

    // Sort paths by output amount in descending order
    const sortedPaths = allPaths.sort((a, b) => {
      if (b.outputAmount > a.outputAmount) return 1;
      if (b.outputAmount < a.outputAmount) return -1;
      return 0;
    });

    console.log(`✅ Found ${sortedPaths.length} valid paths`);
    return sortedPaths;
  }

  // Helper method to format the results in a readable way
  static formatPath(path: SwapPath): string {
    if (path.baseToken) {
      return `${path.inputToken.symbol} -> [${path.fee1}] -> ${path.baseToken.symbol} -> [${path.fee2}] -> ${path.outputToken.symbol} = ${path.outputAmount}`;
    }
    return `${path.inputToken.symbol} -> [${path.fee1}] -> ${path.outputToken.symbol} = ${path.outputAmount}`;
  }
} 
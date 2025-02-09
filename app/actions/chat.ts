'use server'

import {
  AgentKit,
  CdpWalletProvider,
  wethActionProvider,
  walletActionProvider,
  erc20ActionProvider,
  cdpApiActionProvider,
  cdpWalletActionProvider,
  pythActionProvider,
  customActionProvider,
  WalletProvider
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { HumanMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { z } from "zod";
import { UniswapPathFinder } from '../lib/uniswapPathFinder';
import { Token } from '@uniswap/sdk-core';
import { UNISWAP_ADDRESSES } from '../lib/constants';
import { getTokenBySymbol, getCommonBaseTokens } from '../lib/uniswapGraph';
import { findSplitRoutes, MultiRouteResult } from '../lib/uniswapRouter';

export type ChatResponse = {
  success: boolean;
  data?: any;
  error?: string;
};

let agent: any = null;
let agentConfig: any = null;

// Add the custom liquidity seeker action
const liquiditySeeker = customActionProvider<WalletProvider>({
  name: "seek_liquidity",
  description: "Generate a random number representing available liquidity in the range specified",
  schema: z.object({
    min: z.number().describe("Minimum value for the random number range"),
    max: z.number().describe("Maximum value for the random number range"),
  }),
  invoke: async (_walletProvider, args: any) => {
    const { min, max } = args;
    const randomLiquidity = Math.floor(Math.random() * (max - min + 1)) + min;
    return `Found liquidity pool with ${randomLiquidity} tokens available`;
  },
});

// Add the path finder action
const pathFinderAction = customActionProvider<CdpWalletProvider>({
  name: "find_best_swap_path",
  description: "Find the best swap path for a given input token to multiple possible output tokens",
  schema: z.object({
    amount: z.string().describe("Amount of input tokens (in wei)"),
    inputSymbol: z.string().describe("Input token symbol (e.g. 'ETH' or 'WETH', 'USDC')"),
    outputSymbols: z.array(z.string()).describe("List of desired output token symbols"),
  }),
  invoke: async (walletProvider, args: any) => {
    const { amount, inputSymbol, outputSymbols } = args;
    
    try {
      // Get input token data
      const inputToken = await getTokenBySymbol(inputSymbol);
      if (!inputToken) {
        return `Could not find token with symbol ${inputSymbol}. ` + 
               `Note: For ETH, try using WETH instead, or I'll automatically convert it for you.`;
      }

      // Get output tokens data
      const outputTokenPromises = outputSymbols.map(symbol => getTokenBySymbol(symbol));
      const outputTokens = (await Promise.all(outputTokenPromises)).filter(Boolean);
      
      if (outputTokens.length === 0) {
        return `Could not find any of the specified output tokens. ` +
               `Available tokens can be found on Uniswap Base. ` +
               `Note: For ETH, use WETH instead.`;
      }

      // Get base tokens for routing
      const baseTokens = await getCommonBaseTokens();

      const createToken = (tokenData: TokenData) => new Token(
        parseInt(walletProvider.getNetwork().chainId),
        tokenData.id as `0x${string}`,
        parseInt(tokenData.decimals),
        tokenData.symbol,
        tokenData.name
      );

      const pathFinder = new UniswapPathFinder(
        '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a', // Uniswap V3 Quoter
        walletProvider
      );

      const paths = await pathFinder.findBestPaths({
        amount: BigInt(amount),
        inputToken: createToken(inputToken!),
        baseTokens: baseTokens.map(createToken),
        outputTokens: outputTokens.map(createToken),
        quoterAddress: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
        walletProvider
      });

      if (paths.length === 0) {
        return 'No valid paths found for this swap';
      }

      return paths.slice(0, 5).map(UniswapPathFinder.formatPath).join('\n');
    } catch (error) {
      console.error('Error finding swap paths:', error);
      return 'Failed to find swap paths: ' + (error as Error).message;
    }
  },
});

const getRoutesAction = customActionProvider<CdpWalletProvider>({
  name: "get_split_routes",
  description: "Find optimal routes for splitting ETH into multiple tokens",
  schema: z.object({
    inputAmount: z.string().describe("Amount of ETH to split"),
    splits: z.array(z.object({
      token: z.string().describe("Token symbol (e.g., 'USDC', 'DAI')"),
      percentage: z.number().describe("Percentage of input amount (0-100)")
    }))
  }),
  invoke: async (walletProvider, args: any) => {
    try {
      const { inputAmount, splits } = args;
      
      // Get token details from graph
      const tokenPromises = splits.map(async (split: any) => {
        const token = await getTokenBySymbol(split.token);
        if (!token) throw new Error(`Token ${split.token} not found`);
        return {
          token: {
            address: token.id,
            decimals: parseInt(token.decimals),
            symbol: token.symbol,
            name: token.name
          },
          percentage: split.percentage / 100
        };
      });

      const tokenSplits = await Promise.all(tokenPromises);
      
      const routes = await find_split_routes(
        walletProvider,
        parseInt(walletProvider.getNetwork().chainId),
        inputAmount,
        tokenSplits
      );

      return JSON.stringify(routes, null, 2);
    } catch (error) {
      console.error('Error finding routes:', error);
      return 'Failed to find routes: ' + (error as Error).message;
    }
  }
});

const executeSwapsAction = customActionProvider<CdpWalletProvider>({
  name: "execute_split_swaps",
  description: "Execute multiple swaps using found routes",
  schema: z.object({
    routesJson: z.string().describe("JSON string of routes from get_split_routes"),
  }),
  invoke: async (walletProvider, args: any) => {
    try {
      const { routesJson } = args;
      const routes: MultiRouteResult = JSON.parse(routesJson);

      const ROUTER_ADDRESS = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
      const routerAbi = ["function multicall(bytes[] calldata data) payable returns (bytes[] memory results)"];
      
      const tx = await walletProvider.sendTransaction({
        to: ROUTER_ADDRESS,
        value: routes.totalInputValue,
        data: routes.calldata.join(''), // Simplified - you might need to properly encode multicall
      });

      return `Transaction submitted: ${tx}`;
    } catch (error) {
      console.error('Error executing swaps:', error);
      return 'Failed to execute swaps: ' + (error as Error).message;
    }
  }
});

async function initializeAgent() {
  if (agent) return { agent, config: agentConfig };

  try {
    // Initialize LLM
    const llm = new ChatOpenAI({
      model: "gpt-4",
    });

    // Configure CDP Wallet Provider
    const config = {
      apiKeyName: process.env.CDP_API_KEY_NAME,
      apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      networkId: process.env.NETWORK_ID || "base-sepolia",
    };

    const walletProvider = await CdpWalletProvider.configureWithWallet(config);

    // Initialize AgentKit
    const agentkit = await AgentKit.from({
      walletProvider,
      actionProviders: [
        /*
        wethActionProvider(),
        pythActionProvider(),
        walletActionProvider(),
        erc20ActionProvider(),
        cdpApiActionProvider({
          apiKeyName: process.env.CDP_API_KEY_NAME,
          apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
        cdpWalletActionProvider({
          apiKeyName: process.env.CDP_API_KEY_NAME,
          apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
        */
        liquiditySeeker,
        pathFinderAction,
        getRoutesAction,
        executeSwapsAction,
      ],
    });

    const tools = await getLangChainTools(agentkit);

    // Store buffered conversation history in memory
    const memory = new MemorySaver();
    agentConfig = { configurable: { thread_id: "CDP AgentKit Chat" } };

    // Create React Agent
    agent = createReactAgent({
      llm,
      tools,
      checkpointSaver: memory,
      messageModifier: `
        You are a helpful agent that can interact onchain using the Coinbase Developer Platform AgentKit. You are 
        empowered to interact onchain using your tools. If you ever need funds, you can request them from the 
        faucet if you are on network ID 'base-sepolia'. Before executing your first action, get the wallet details 
        to see what network you're on.
      `,
    });

    return { agent, config: agentConfig };
  } catch (error) {
    console.error("Failed to initialize agent:", error);
    throw error;
  }
}

export async function getChatResponse(
  input: string, 
  context: Array<{ role: string; content: string }>
): Promise<ChatResponse> {
  try {
    const { agent, config } = await initializeAgent();
    
    const stream = await agent.stream(
      { messages: [new HumanMessage(input)] },
      config
    );

    let response = '';
    for await (const chunk of stream) {
      if ("agent" in chunk) {
        response += chunk.agent.messages[0].content + '\n';
      } else if ("tools" in chunk) {
        response += chunk.tools.messages[0].content + '\n';
      }
    }

    return {
      success: true,
      data: { output: response.trim() }
    };
  } catch (error) {
    console.error('Error getting AI response:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    };
  }
} 
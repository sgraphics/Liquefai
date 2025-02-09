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
    inputToken: z.string().describe("Input token address"),
    baseTokens: z.array(z.string()).describe("List of base token addresses to try routing through"),
    outputTokens: z.array(z.string()).describe("List of desired output token addresses"),
  }),
  invoke: async (walletProvider, args: any) => {
    const { amount, inputToken, baseTokens, outputTokens } = args;
    
    const createToken = (address: string) => new Token(
      parseInt(walletProvider.getNetwork().chainId),
      address,
      18
    );

    const pathFinder = new UniswapPathFinder(
      "UNISWAP_QUOTER_ADDRESS", // Replace with actual address for the network
      walletProvider
    );

    const paths = await pathFinder.findBestPaths({
      amount: BigInt(amount),
      inputToken: createToken(inputToken),
      baseTokens: baseTokens.map(createToken),
      outputTokens: outputTokens.map(createToken),
      quoterAddress: "UNISWAP_QUOTER_ADDRESS", // Replace with actual address
      walletProvider
    });

    return paths.slice(0, 5).map(UniswapPathFinder.formatPath).join('\n');
  },
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
'use server'
import 'server-only'; // Explicitly prevent client-side imports

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
import { UNISWAP_ADDRESSES } from '../lib/constants';

export type ChatResponse = {
  success: boolean;
  data?: any;
  error?: string;
};

let agent: any = null;
let agentConfig: any = null;

if (typeof window === 'undefined') {
  console.log("get_split_routesAction: Running on the server (typeof window is 'undefined').");
} else {
  console.log("get_split_routesAction: Running on the browser (typeof window is NOT 'undefined').");
}

const getRoutesAction = customActionProvider<CdpWalletProvider>({
  name: "get_split_routes",
  description: "Find optimal routes for splitting any input token into multiple output tokens using Uniswap v3",
  schema: z.object({
    inputToken: z.string().describe("Input token symbol (e.g., 'ETH', 'USDC', 'WETH')"),
    inputAmount: z.string().describe("Amount of input token to split (e.g., '1.0')"),
    splits: z.array(z.object({
      token: z.string().describe("Output token symbol (e.g., 'USDC', 'DAI')"),
      percentage: z.number().describe("Percentage of input amount (0-100)")
    }))
  }),
  invoke: async (walletProvider, args: any) => {
    // Additional log to confirm invoke() is running server-side
    if (typeof window === 'undefined') {
      console.log("Invoking get_split_routesAction on the server side with args:", args);

      // Dynamically import here so @uniswap/smart-order-router stays server-only
      try {
        const { getRoutes } = await import('../server/uniswap');
        const result = await getRoutes(walletProvider, args);
        
        if (!result.success) {
          throw new Error(result.error);
        }
        
        return JSON.stringify(result.data, null, 2);
      } catch (error) {
        console.error('Error finding routes:', error);
        return 'Failed to find routes: ' + (error as Error).message;
      }
    } else {
      console.log("Invoking get_split_routesAction on the browser side (unexpected).");
      return 'This action is not available client-side.';
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
        getRoutesAction,
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
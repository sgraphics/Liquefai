import { createClient } from 'urql';
import { cacheExchange, fetchExchange } from '@urql/core';

const API_KEY = '3566f49fbd1c4eb94918d76d516a4f2b';
// Base mainnet subgraph
const UNISWAP_SUBGRAPH_URL = `https://gateway.thegraph.com/api/${API_KEY}/subgraphs/id/GqzP4Xaehti8KSfQmv3ZctFSjnSUYZ4En5NRsiTbvZpz`;

// For Base Sepolia (testnet), we might need a different URL
// const UNISWAP_GRAPH_URL = 'https://api.thegraph.com/subgraphs/name/uniswap/base-sepolia';

const client = createClient({
  url: UNISWAP_SUBGRAPH_URL,
  exchanges: [cacheExchange, fetchExchange],
});

interface TokenData {
  id: string;
  symbol: string;
  decimals: string;
  name: string;
}

// Common token symbol mappings
const TOKEN_SYMBOL_MAPPINGS: Record<string, string> = {
  'ETH': 'WETH',
  'BTC': 'BTCB',
  // Add more common mappings as needed
};

export async function getTokenBySymbol(symbol: string): Promise<TokenData | null> {
  try {
    const upperSymbol = symbol.toUpperCase();

    // If not found in common tokens, try the subgraph
    const mappedSymbol = TOKEN_SYMBOL_MAPPINGS[upperSymbol] || symbol;

    console.log(`🔍 Searching for token: ${symbol} (mapped to: ${mappedSymbol})`);

    const query = `
      query GetToken($symbol: String!) {
        tokens(
          where: { 
            symbol: $symbol
          }
          orderBy: totalValueLockedUSD
          orderDirection: desc
          first: 1
        ) {
          id
          symbol
          decimals
          name
          totalValueLockedUSD
        }
      }
    `;

    const { data, error } = await client.query(query, { 
      symbol: mappedSymbol.toUpperCase() 
    }).toPromise();
    
    if (error) {
      console.error('GraphQL error:', error);
      return null;
    }

    if (!data?.tokens?.length) {
      console.log(`No tokens found for symbol: ${mappedSymbol}`);
      return null;
    }

    console.log('Found token:', data.tokens[0]);
    return data.tokens[0];

  } catch (error) {
    console.error('Error fetching token:', error);
    // Fallback to common tokens if subgraph fails
    return null;
  }
}

export async function getCommonBaseTokens(): Promise<TokenData[]> {
  const query = `
    query GetBaseTokens {
      tokens(
        where: { 
          symbol: "WETH"
        }
        orderBy: totalValueLockedUSD
        orderDirection: desc
        first: 1
      ) {
        id
        symbol
        decimals
        name
        totalValueLockedUSD
      }
    }
  `;

  try {
    const { data, error } = await client.query(query, {}).toPromise();
    

    if (error) {
      console.error('GraphQL error:', error);
      throw error;
    }

    console.log('Found base token (WETH):', data?.tokens?.[0]);
    return data?.tokens || [];

  } catch (error) {
    console.error('Failed to fetch base tokens:', error);
    throw error;
  }
} 
export const UNISWAP_ADDRESSES = {
  'base-sepolia': {
    // Uniswap V3 Quoter V2 contract on Base Sepolia
    quoter: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
    // Common tokens on Base Sepolia
    tokens: {
      WETH: '0x4200000000000000000000000000000000000006',
      USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      // Add other tokens as needed
    },
    // Common base tokens used for routing
    baseTokens: [
      '0x4200000000000000000000000000000000000006', // WETH
    ]
  }
} as const; 
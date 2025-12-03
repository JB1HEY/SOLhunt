import { PublicKey } from '@solana/web3.js';

// Your deployed program ID
export const PROGRAM_ID = new PublicKey('G5MSUKpKWNzGoHbpphuPS3QsKXUD7EPa54oRDapXxSQ8');

// Network configuration
export const NETWORK = 'devnet'; // or 'mainnet-beta'
export const RPC_ENDPOINT = 'https://api.devnet.solana.com';

// SOL constants
export const LAMPORTS_PER_SOL = 1_000_000_000;
export const BOUNTY_CREATION_FEE = 0.001; // SOL
export const PLATFORM_FEE_PERCENT = 1; // 1%

// UI constants
export const MAX_DESCRIPTION_LENGTH = 5000;
export const MAX_TITLE_LENGTH = 200;
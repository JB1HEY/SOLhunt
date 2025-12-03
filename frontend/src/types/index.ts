import { PublicKey } from '@solana/web3.js';

export interface Bounty {
  company: PublicKey;
  descriptionHash: string;
  prizeAmount: number; // in lamports
  deadlineTimestamp: number | null;
  winner: PublicKey | null;
  completed: boolean;
  createdAt: number;
  completedAt: number | null;
  submissionHash: string | null;
  expiryTimestamp: number;
  expired: boolean;
  bump: number;
}

export interface BountyWithMetadata extends Bounty {
  publicKey: PublicKey;
  title: string;
  description: string;
  skills: string[];
  prizeInSol: number;
}

export interface HunterProfile {
  hunter: PublicKey;
  bountiesCompleted: number;
  createdAt: number;
  bump: number;
}

export interface HunterProfileWithMetadata extends HunterProfile {
  publicKey: PublicKey;
  name: string;
  bio: string;
  skills: string[];
  college: string;
  portfolioUrl: string;
  rating: number; // Average rating from reviews
  reviewCount: number;
}

export interface Treasury {
  authority: PublicKey;
  totalFeesCollected: number;
  totalBountiesCreated: number;
  totalBountiesCompleted: number;
  totalVolume: number;
  totalExpiredFundsReclaimed: number;
  bump: number;
}

export interface BountyMetadata {
  title: string;
  description: string;
  skills: string[];
  ipfsHash?: string;
}

export interface Submission {
  bountyId: PublicKey;
  hunter: PublicKey;
  content: string;
  ipfsHash: string;
  submittedAt: number;
}

export enum BountyStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
}
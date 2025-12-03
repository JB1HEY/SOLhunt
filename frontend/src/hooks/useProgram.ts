import { useMemo } from 'react';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { PROGRAM_ID } from '@/lib/constants';
import idl from '@/lib/idl.json';

export function useProgram() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const program = useMemo(() => {
    if (!wallet) return null;

    const provider = new AnchorProvider(
      connection,
      wallet as any, // Cast to any to avoid strict type checks that might be missing methods
      {
        commitment: 'confirmed',
        preflightCommitment: 'confirmed',
      }
    );

    return new Program(idl as any, provider);
  }, [connection, wallet]);

  return program;
}

// PDA derivation helpers
export function getTreasuryPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('treasury_v1')],
    PROGRAM_ID
  );
}

export function getBountyPda(
  company: PublicKey,
  descriptionHash: string
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('bounty'),
      company.toBuffer(),
      Buffer.from(descriptionHash),
    ],
    PROGRAM_ID
  );
}

export function getHunterProfilePda(hunter: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('profile'), hunter.toBuffer()],
    PROGRAM_ID
  );
}
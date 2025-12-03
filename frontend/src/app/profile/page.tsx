'use client';

import { useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';

export default function MyProfilePage() {
  const { publicKey } = useWallet();
  const router = useRouter();

  useEffect(() => {
    if (publicKey) {
      // Redirect to profile page with wallet address
      router.push(`/profile/${publicKey.toString()}`);
    }
  }, [publicKey, router]);

  if (!publicKey) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
          <p className="text-gray-600">
            Please connect your wallet to view your profile
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading your profile...</p>
      </div>
    </div>
  );
}
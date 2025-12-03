'use client';

import { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { SystemProgram, LAMPORTS_PER_SOL as LAMPORTS } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { useProgram, getTreasuryPda, getBountyPda } from '@/hooks/useProgram';
import { BOUNTY_CREATION_FEE } from '@/lib/constants';

export default function CreateBounty() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const program = useProgram();
  const router = useRouter();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    requirements: '', // NEW field
    deliverables: '', // NEW field
    skills: '',
    category: 'development', // NEW field
    prizeAmount: '',
    deadline: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!publicKey || !program) {
      setError('Please connect your wallet');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Convert amounts to BN
      const prizeInSol = parseFloat(formData.prizeAmount);
      const prizeInLamports = new BN(Math.floor(prizeInSol * LAMPORTS));
      
      // Generate description hash
      const descriptionHash = `bounty_${Date.now()}_${publicKey.toString().slice(0, 8)}`;
      
      // Get PDAs
      const [treasuryPda] = getTreasuryPda();
      const [bountyPda] = getBountyPda(publicKey, descriptionHash);

      // Handle deadline
      let deadlineTimestamp = null;
      if (formData.deadline) {
        const deadlineMs = new Date(formData.deadline).getTime();
        deadlineTimestamp = new BN(Math.floor(deadlineMs / 1000));
      }

      // Create bounty on-chain
      console.log('Creating bounty on-chain...');
      const tx = await program.methods
        .createBounty(
          descriptionHash,
          prizeInLamports,
          deadlineTimestamp
        )
        .accounts({
          company: publicKey,
          bounty: bountyPda,
          treasury: treasuryPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc({
            skipPreflight: true,
            commitment: 'confirmed',
            maxRetries: 3,
        });

      console.log('Bounty created on-chain! Transaction:', tx);

      // ============================================================
      // ADD THIS: Save metadata to database
      // ============================================================
      console.log('Saving metadata to database...');
      try {
        const metadataResponse = await fetch('/api/bounties', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bountyPubkey: bountyPda.toString(),
            companyWallet: publicKey.toString(),
            title: formData.title,
            description: formData.description,
            requirements: formData.requirements,
            deliverables: formData.deliverables,
            skillsRequired: formData.skills 
              ? formData.skills.split(',').map(s => s.trim()).filter(s => s)
              : [],
            category: formData.category,
            deadline: formData.deadline || null,
            prizeAmount: prizeInSol,
          }),
        });

        if (!metadataResponse.ok) {
          const errorData = await metadataResponse.json();
          console.error('Failed to save metadata:', errorData);
          // Don't fail the whole thing if metadata save fails
          alert('Bounty created on-chain, but metadata save failed. You may need to add details later.');
        } else {
          console.log('Metadata saved successfully!');
        }
      } catch (metadataError) {
        console.error('Error saving metadata:', metadataError);
        // Don't fail the whole thing
        alert('Bounty created on-chain, but metadata save failed. You may need to add details later.');
      }
      // ============================================================

      alert(`Bounty created successfully!\n\nTransaction: ${tx}\n\nRedirecting to bounty page...`);
      
      // Redirect to the bounty page
      setTimeout(() => {
        router.push(`/bounty/${bountyPda.toString()}`);
      }, 1500);

    } catch (err: any) {
      console.error('Error creating bounty:', err);
      
      let errorMessage = 'Failed to create bounty';
      if (err.message?.includes('0x1')) {
        errorMessage = 'Insufficient funds for transaction';
      } else if (err.message?.includes('User rejected')) {
        errorMessage = 'Transaction rejected by user';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  if (!publicKey) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
          <p className="text-gray-600">
            Please connect your wallet to post a bounty
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-white rounded-lg shadow p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Post a Bounty</h1>
        <p className="text-gray-600 mb-8">
          Create a task and offer SOL as a reward
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bounty Title *
            </label>
            <input
              type="text"
              required
              maxLength={200}
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="e.g., Build a landing page for our DeFi protocol"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category *
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="development">Development</option>
              <option value="design">Design</option>
              <option value="marketing">Marketing</option>
              <option value="writing">Writing</option>
              <option value="video">Video/Animation</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              required
              rows={6}
              maxLength={5000}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Describe the task, context, and what you're looking for..."
            />
            <p className="text-sm text-gray-500 mt-1">
              {formData.description.length} / 5000 characters
            </p>
          </div>

          {/* Requirements */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Requirements (Optional)
            </label>
            <textarea
              rows={4}
              maxLength={2000}
              value={formData.requirements}
              onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="List any specific requirements or constraints..."
            />
          </div>

          {/* Deliverables */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Deliverables (Optional)
            </label>
            <textarea
              rows={4}
              maxLength={2000}
              value={formData.deliverables}
              onChange={(e) => setFormData({ ...formData, deliverables: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="What should hunters deliver? (e.g., source code, design files, etc.)"
            />
          </div>

          {/* Skills */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Required Skills
            </label>
            <input
              type="text"
              value={formData.skills}
              onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="e.g., React, Solidity, Design (comma separated)"
            />
            <p className="text-sm text-gray-500 mt-1">
              Separate skills with commas
            </p>
          </div>

          {/* Prize Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Prize Amount (SOL) *
            </label>
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              value={formData.prizeAmount}
              onChange={(e) => setFormData({ ...formData, prizeAmount: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="10.5"
            />
            <p className="text-sm text-gray-500 mt-1">
              Winner receives 99%, platform takes 1% fee
            </p>
          </div>

          {/* Deadline (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Deadline (Optional)
            </label>
            <input
              type="date"
              value={formData.deadline}
              onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          {/* Fee Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Cost Breakdown</h3>
            <div className="space-y-1 text-sm text-blue-800">
              <div className="flex justify-between">
                <span>Prize amount:</span>
                <span>{formData.prizeAmount || '0'} SOL</span>
              </div>
              <div className="flex justify-between">
                <span>Creation fee:</span>
                <span>{BOUNTY_CREATION_FEE} SOL</span>
              </div>
              <div className="flex justify-between font-semibold pt-2 border-t border-blue-300">
                <span>Total cost:</span>
                <span>
                  {(parseFloat(formData.prizeAmount || '0') + BOUNTY_CREATION_FEE).toFixed(3)} SOL
                </span>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating Bounty...' : 'Post Bounty'}
          </button>

          <p className="text-sm text-gray-500 text-center">
            Note: Bounties cannot be cancelled once posted. Prize is held in escrow until completion.
          </p>
        </form>
      </div>
    </div>
  );
}
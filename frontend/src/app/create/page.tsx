'use client';

import { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { SystemProgram, LAMPORTS_PER_SOL as LAMPORTS, Transaction } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { useProgram, getTreasuryPda, getBountyPda } from '@/hooks/useProgram';
import { BOUNTY_CREATION_FEE } from '@/lib/constants';
import { Card } from '@/components/ui/Card';
import { Input, TextArea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function CreateBounty() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const program = useProgram();
  const router = useRouter();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    requirements: '',
    deliverables: '',
    skills: '',
    category: 'development',
    prizeAmount: '',
    githubUrl: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Check if treasury exists
  const [treasuryExists, setTreasuryExists] = useState(true);

  // Check treasury status on mount
  useState(() => {
    async function checkTreasury() {
      if (!program) return;
      try {
        const [treasuryPda] = getTreasuryPda();
        // Cast to any to avoid type error if IDL types aren't perfect
        const account = await (program.account as any).treasury.fetch(treasuryPda);
        console.log('Treasury found:', account);
        setTreasuryExists(true);
      } catch (e) {
        console.log('Treasury not found or error:', e);
        setTreasuryExists(false);
      }
    }
    checkTreasury();
  });

  async function initializeTreasury() {
    if (!program || !publicKey) return;
    try {
      const [treasuryPda] = getTreasuryPda();
      const tx = await program.methods
        .initializeTreasury()
        .accounts({
          treasury: treasuryPda,
          authority: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log('Treasury initialized:', tx);
      setTreasuryExists(true);
      alert('Treasury initialized! You can now post bounties.');
    } catch (err) {
      console.error('Error initializing treasury:', err);
      alert('Failed to initialize treasury');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!treasuryExists) {
      setError('Treasury not initialized. Please initialize it first.');
      return;
    }

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

      // No deadline - set to null
      const deadlineTimestamp = null;

      // Create bounty on-chain
      console.log('Creating bounty on-chain...');
      console.log('Program ID:', program.programId.toString());
      console.log('Methods available:', Object.keys(program.methods));
      console.log('Arguments:', {
        descriptionHash,
        prizeInLamports: prizeInLamports.toString(),
        deadlineTimestamp
      });

      // Create instruction
      const ix = await program.methods
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
        .instruction();

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      const transaction = new Transaction().add(ix);
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      console.log('Signing transaction...');
      // We need the anchor wallet for signing
      if (!(window as any).solana && !(window as any).phantom) {
        throw new Error("Wallet not found");
      }

      // Use the wallet from the hook context if available, but we need to cast it
      // or use useAnchorWallet in the component.
      // Since we don't have useAnchorWallet imported in the component yet, let's rely on the provider's wallet
      // strictly speaking, program.provider.wallet should be the anchor wallet.

      const signedTx = await (program.provider as any).wallet.signTransaction(transaction);

      console.log('Sending transaction...');
      const tx = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: true,
        maxRetries: 3,
      });

      await connection.confirmTransaction({
        signature: tx,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed');

      console.log('Bounty created on-chain! Transaction:', tx);

      // Save metadata to database
      console.log('Saving metadata to database...');

      // Append Collateral Link to description if present
      let finalDescription = formData.description;
      if (formData.githubUrl) {
        finalDescription += `\n\nCOLLATERAL_LINK: ${formData.githubUrl}`;
      }

      try {
        const metadataResponse = await fetch('/api/bounties', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bountyPubkey: bountyPda.toString(),
            companyWallet: publicKey.toString(),
            title: formData.title,
            description: finalDescription,
            requirements: formData.requirements,
            deliverables: formData.deliverables,
            skillsRequired: formData.skills
              ? formData.skills.split(',').map(s => s.trim()).filter(s => s)
              : [],
            category: formData.category,
            deadline: null,
            prizeAmount: prizeInSol,
          }),
        });

        if (!metadataResponse.ok) {
          const errorData = await metadataResponse.json();
          console.error('Failed to save metadata:', errorData);
          alert('Bounty created on-chain, but metadata save failed. You may need to add details later.');
        } else {
          console.log('Metadata saved successfully!');
        }
      } catch (metadataError) {
        console.error('Error saving metadata:', metadataError);
        alert('Bounty created on-chain, but metadata save failed. You may need to add details later.');
      }

      alert(`Bounty created successfully!\n\nTransaction: ${tx}\n\nRedirecting to bounty page...`);

      // Redirect to the bounty page
      setTimeout(() => {
        router.push(`/bounty/${bountyPda.toString()}`);
      }, 1500);

    } catch (err: any) {
      console.error('Error creating bounty:', err);
      if (err.logs) {
        console.error('Transaction logs:', err.logs);
      }

      let errorMessage = 'Failed to create bounty';
      if (err.message?.includes('0x1')) {
        errorMessage = 'Insufficient funds for transaction';
      } else if (err.message?.includes('User rejected')) {
        errorMessage = 'Transaction rejected by user';
      } else if (err.message) {
        errorMessage = err.message;
      }

      // Check for specific instruction errors
      if (JSON.stringify(err).includes('AccountNotInitialized') || JSON.stringify(err).includes('ConstraintSeeds')) {
        errorMessage = 'Treasury not initialized. Please contact admin.';
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  if (!publicKey) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-md w-full text-center py-12">
          <h2 className="text-2xl font-bold mb-4 text-white">Connect Your Wallet</h2>
          <p className="text-gray-400">
            Please connect your wallet to post a bounty
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Post a Bounty</h1>
          <p className="text-gray-400">
            Create a task and offer SOL as a reward
          </p>
        </div>

        <Card className="border-primary/20 shadow-[0_0_50px_rgba(59,130,246,0.1)]">
          {!treasuryExists && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-6 mb-8">
              <h3 className="text-yellow-500 font-bold mb-2 text-lg">Treasury Not Initialized</h3>
              <p className="text-gray-400 mb-4">
                The platform treasury has not been initialized on this network. You must initialize it before creating bounties.
              </p>
              <Button
                type="button"
                onClick={initializeTreasury}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
              >
                Initialize Treasury
              </Button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Title */}
            <Input
              label="Bounty Title *"
              required
              maxLength={200}
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Build a landing page for our DeFi protocol"
            />

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
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
              <TextArea
                label="Description *"
                required
                rows={6}
                maxLength={5000}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the task, context, and what you're looking for..."
              />
              <p className="text-xs text-gray-500 mt-1 text-right">
                {formData.description.length} / 5000 characters
              </p>
            </div>

            {/* Collateral / GitHub */}
            <Input
              label="Collateral / GitHub Repository (Optional)"
              type="url"
              value={formData.githubUrl}
              onChange={(e) => setFormData({ ...formData, githubUrl: e.target.value })}
              placeholder="https://github.com/your-org/repo"
            />

            {/* Requirements */}
            <TextArea
              label="Requirements (Optional)"
              rows={4}
              maxLength={2000}
              value={formData.requirements}
              onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
              placeholder="List any specific requirements or constraints..."
            />

            {/* Deliverables */}
            <TextArea
              label="Deliverables (Optional)"
              rows={4}
              maxLength={2000}
              value={formData.deliverables}
              onChange={(e) => setFormData({ ...formData, deliverables: e.target.value })}
              placeholder="What should hunters deliver? (e.g., source code, design files, etc.)"
            />

            {/* Skills */}
            <div>
              <Input
                label="Required Skills"
                value={formData.skills}
                onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                placeholder="e.g., React, Solidity, Design (comma separated)"
              />
              <p className="text-xs text-gray-500 mt-1">
                Separate skills with commas
              </p>
            </div>

            {/* Prize Amount */}
            <div>
              <Input
                label="Prize Amount (SOL) *"
                type="number"
                required
                min="0.01"
                step="0.01"
                value={formData.prizeAmount}
                onChange={(e) => setFormData({ ...formData, prizeAmount: e.target.value })}
                placeholder="10.5"
              />
              <p className="text-xs text-gray-500 mt-1">
                Winner receives 99%, platform takes 1% fee
              </p>
            </div>

            {/* Fee Info */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-6">
              <h3 className="font-semibold text-primary mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 36v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Cost Breakdown
              </h3>
              <div className="space-y-3 text-sm text-gray-300">
                <div className="flex justify-between">
                  <span>Prize amount:</span>
                  <span className="font-mono text-white">{formData.prizeAmount || '0'} SOL</span>
                </div>
                <div className="flex justify-between">
                  <span>Creation fee:</span>
                  <span className="font-mono text-white">{BOUNTY_CREATION_FEE} SOL</span>
                </div>
                <div className="flex justify-between font-bold pt-3 border-t border-primary/20 text-white text-base">
                  <span>Total cost:</span>
                  <span className="text-primary">
                    {(parseFloat(formData.prizeAmount || '0') + BOUNTY_CREATION_FEE).toFixed(3)} SOL
                  </span>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <p className="text-red-400">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              isLoading={loading}
              className="w-full text-lg py-4"
            >
              Post Bounty
            </Button>

            <p className="text-sm text-gray-500 text-center">
              Note: Bounties cannot be cancelled once posted. Prize is held in escrow until completion.
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
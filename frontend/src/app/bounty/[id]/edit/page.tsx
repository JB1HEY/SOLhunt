'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useProgram } from '@/hooks/useProgram';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function EditBountyPage() {
  const params = useParams();
  const router = useRouter();
  const { publicKey } = useWallet();
  const program = useProgram();

  const [bounty, setBounty] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    requirements: '',
    deliverables: '',
    skills: '',
    category: 'development',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchBounty();
  }, [params.id, program]);

  async function fetchBounty() {
    if (!program || !params.id) return;

    try {
      const bountyPubkey = new PublicKey(params.id as string);

      // Fetch on-chain data
      const bountyAccount = await program.account.bounty.fetch(bountyPubkey);

      // Check if user is the owner
      if (publicKey && !bountyAccount.company.equals(publicKey)) {
        setError('You are not the owner of this bounty');
        setLoading(false);
        return;
      }

      // Check if bounty is completed
      if (bountyAccount.completed) {
        setError('Cannot edit a completed bounty');
        setLoading(false);
        return;
      }

      setBounty({
        ...bountyAccount,
        publicKey: bountyPubkey,
      });

      // Fetch metadata
      const metadataResponse = await fetch(`/api/bounties?bountyPubkey=${bountyPubkey.toString()}`);
      if (metadataResponse.ok) {
        const metadataData = await metadataResponse.json();
        if (metadataData.bounty) {
          setFormData({
            title: metadataData.bounty.title || '',
            description: metadataData.bounty.description || '',
            requirements: metadataData.bounty.requirements || '',
            deliverables: metadataData.bounty.deliverables || '',
            skills: metadataData.bounty.skills_required?.join(', ') || '',
            category: metadataData.bounty.category || 'development',
          });
        }
      }
    } catch (err) {
      console.error('Error fetching bounty:', err);
      setError('Failed to load bounty');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!publicKey || !bounty) {
      setError('Please connect your wallet');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      // Update metadata in database
      const response = await fetch('/api/bounties', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bountyPubkey: bounty.publicKey.toString(),
          title: formData.title,
          description: formData.description,
          requirements: formData.requirements,
          deliverables: formData.deliverables,
          skillsRequired: formData.skills
            ? formData.skills.split(',').map(s => s.trim()).filter(s => s)
            : [],
          category: formData.category,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update bounty');
      }

      setSuccess('Bounty updated successfully!');

      // Redirect back to bounty page after 1.5 seconds
      setTimeout(() => {
        router.push(`/bounty/${bounty.publicKey.toString()}`);
      }, 1500);

    } catch (err: any) {
      console.error('Error updating bounty:', err);
      setError(err.message || 'Failed to update bounty');
    } finally {
      setSaving(false);
    }
  }

  if (!publicKey) {
    return (
      <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-background flex items-center justify-center">
        <Card className="max-w-md w-full text-center p-8 border-primary/20">
          <h2 className="text-2xl font-bold mb-4 text-white">Connect Your Wallet</h2>
          <p className="text-gray-400 mb-6">
            Please connect your wallet to edit this bounty
          </p>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading bounty...</p>
        </div>
      </div>
    );
  }

  if (error && !bounty) {
    return (
      <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-background flex items-center justify-center">
        <Card className="max-w-md w-full text-center p-8 border-red-500/20">
          <h2 className="text-2xl font-bold mb-4 text-red-500">Error</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <Button
            onClick={() => router.push('/dashboard')}
            variant="primary"
          >
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="max-w-3xl mx-auto">
        <Card className="border-primary/20">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-white">Edit Bounty</h1>
            <button
              onClick={() => router.push(`/bounty/${bounty.publicKey.toString()}`)}
              className="text-gray-400 hover:text-white transition"
            >
              Cancel
            </button>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-8">
            <p className="text-sm text-yellow-500">
              <strong>Note:</strong> You can only edit the description and metadata.
              The prize amount and deadline are locked on-chain and cannot be changed.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Bounty Title *
              </label>
              <input
                type="text"
                required
                maxLength={200}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 transition-colors"
                placeholder="e.g., Build a landing page for our DeFi protocol"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary/50 transition-colors appearance-none"
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
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description *
              </label>
              <textarea
                required
                rows={6}
                maxLength={5000}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 transition-colors"
                placeholder="Describe the task, context, and what you're looking for..."
              />
              <p className="text-sm text-gray-500 mt-1 text-right">
                {formData.description.length} / 5000 characters
              </p>
            </div>

            {/* Requirements */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Requirements
              </label>
              <textarea
                rows={4}
                maxLength={2000}
                value={formData.requirements}
                onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 transition-colors"
                placeholder="List any specific requirements or constraints..."
              />
            </div>

            {/* Deliverables */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Deliverables
              </label>
              <textarea
                rows={4}
                maxLength={2000}
                value={formData.deliverables}
                onChange={(e) => setFormData({ ...formData, deliverables: e.target.value })}
                className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 transition-colors"
                placeholder="What should hunters deliver? (e.g., source code, design files, etc.)"
              />
            </div>

            {/* Skills */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Required Skills
              </label>
              <input
                type="text"
                value={formData.skills}
                onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 transition-colors"
                placeholder="e.g., React, Solidity, Design (comma separated)"
              />
              <p className="text-sm text-gray-500 mt-1">
                Separate skills with commas
              </p>
            </div>

            {/* Info Box */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <h4 className="font-semibold text-primary mb-2">💡 Editing Tips</h4>
              <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
                <li>Clear descriptions get better submissions</li>
                <li>Add requirements to set expectations</li>
                <li>Update deliverables if needed</li>
                <li>You can edit this anytime before completion</li>
              </ul>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <p className="text-red-400">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <p className="text-green-400">{success}</p>
              </div>
            )}

            <div className="flex space-x-4 pt-4">
              <Button
                type="submit"
                disabled={saving}
                className="flex-1"
              >
                {saving ? 'Saving Changes...' : 'Save Changes'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/bounty/${bounty.publicKey.toString()}`)}
              >
                Cancel
              </Button>
            </div>

            <p className="text-sm text-gray-500 text-center">
              Note: Prize amount and deadline are locked on-chain and cannot be edited.
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
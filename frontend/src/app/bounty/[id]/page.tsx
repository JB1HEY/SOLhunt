'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useProgram } from '@/hooks/useProgram';
import { BountyWithMetadata } from '@/types';
import { LAMPORTS_PER_SOL } from '@/lib/constants';
import SubmissionForm from '@/components/SubmissionForm';
import SubmissionsReview from '@/components/SubmissionsReview';
import Link from 'next/link';

type Tab = 'details' | 'submissions' | 'submit';

export default function BountyDetailEnhanced() {
  const params = useParams();
  const router = useRouter();
  const { publicKey } = useWallet();
  const program = useProgram();
  
  const [bounty, setBounty] = useState<any>(null);
  const [bountyMetadata, setBountyMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('details');

  useEffect(() => {
    fetchBountyData();
  }, [params.id, program]);

  async function fetchBountyData() {
    if (!program || !params.id) return;

    try {
      const bountyPubkey = new PublicKey(params.id as string);
      
      // Fetch on-chain data
      const bountyAccount = await program.account.bounty.fetch(bountyPubkey);

      // Fetch off-chain metadata
      const metadataResponse = await fetch(`/api/bounties?bountyPubkey=${bountyPubkey.toString()}`);
      const metadataData = await metadataResponse.json();

      setBounty({
        ...bountyAccount,
        publicKey: bountyPubkey,
        prizeInSol: bountyAccount.prizeAmount / LAMPORTS_PER_SOL,
      });

      setBountyMetadata(metadataData.bounty);
    } catch (error) {
      console.error('Error fetching bounty:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading bounty...</p>
        </div>
      </div>
    );
  }

  if (!bounty || !bountyMetadata) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Bounty Not Found</h2>
          <button
            onClick={() => router.push('/')}
            className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary/90 transition"
          >
            Back to Bounties
          </button>
        </div>
      </div>
    );
  }

  const isCompany = publicKey && publicKey.equals(bounty.company);

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <button
        onClick={() => router.push('/')}
        className="text-primary hover:underline mb-6"
      >
        ← Back to all bounties
      </button>

      {/* Header */}
      <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
        <div className="flex justify-between items-start mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">{bountyMetadata.title}</h1>
              {bounty.completed ? (
                <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
                  ✓ Completed
                </span>
              ) : (
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
                  ● Open
                </span>
              )}
            </div>
            <p className="text-gray-600">
              Posted by: {bounty.company.toString().slice(0, 8)}...{bounty.company.toString().slice(-8)}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-primary mb-2">
              {bounty.prizeInSol} SOL
            </div>
            <p className="text-sm text-gray-500">
              Winner receives {(bounty.prizeInSol * 0.99).toFixed(2)} SOL
            </p>
            {isCompany && !bounty.completed && (
              <Link
                href={`/bounty/${bounty.publicKey.toString()}/edit`}
                className="inline-block mt-3 text-sm text-primary hover:underline"
              >
                ✏️ Edit Bounty
              </Link>
            )}
          </div>
        </div>

        {/* Category and Skills */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-semibold">
            {bountyMetadata.category || 'General'}
          </span>
          {bountyMetadata.skills_required?.map((skill: string) => (
            <span
              key={skill}
              className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm"
            >
              {skill}
            </span>
          ))}
        </div>

        {/* Meta Info */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="text-gray-600 text-sm">Created</p>
            <p className="font-semibold">
              {new Date(bounty.createdAt * 1000).toLocaleDateString()}
            </p>
          </div>
          {bounty.deadlineTimestamp && (
            <div>
              <p className="text-gray-600 text-sm">Deadline</p>
              <p className="font-semibold">
                {new Date(bounty.deadlineTimestamp * 1000).toLocaleDateString()}
              </p>
            </div>
          )}
          <div>
            <p className="text-gray-600 text-sm">Submissions</p>
            <p className="font-semibold">
              {bountyMetadata.submission_count || 0}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('details')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition ${
                activeTab === 'details'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab('submissions')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition ${
                activeTab === 'submissions'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Submissions ({bountyMetadata.submission_count || 0})
            </button>
            {!isCompany && !bounty.completed && (
              <button
                onClick={() => setActiveTab('submit')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition ${
                  activeTab === 'submit'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Submit Work
              </button>
            )}
          </nav>
        </div>

        <div className="p-8">
          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-3">Description</h2>
                <p className="text-gray-700 whitespace-pre-wrap">{bountyMetadata.description}</p>
              </div>

              {bountyMetadata.requirements && (
                <div>
                  <h2 className="text-xl font-semibold mb-3">Requirements</h2>
                  <p className="text-gray-700 whitespace-pre-wrap">{bountyMetadata.requirements}</p>
                </div>
              )}

              {bountyMetadata.deliverables && (
                <div>
                  <h2 className="text-xl font-semibold mb-3">Deliverables</h2>
                  <p className="text-gray-700 whitespace-pre-wrap">{bountyMetadata.deliverables}</p>
                </div>
              )}

              {!isCompany && !bounty.completed && (
                <div className="bg-primary/10 border border-primary/30 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-primary mb-2">
                    Ready to work on this bounty?
                  </h3>
                  <p className="text-gray-700 mb-4">
                    Review the requirements carefully, then submit your work through the "Submit Work" tab.
                  </p>
                  <button
                    onClick={() => setActiveTab('submit')}
                    className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary/90 transition"
                  >
                    Submit Your Work →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Submissions Tab */}
          {activeTab === 'submissions' && (
            <SubmissionsReview
              bountyId={bountyMetadata.id}
              bountyPubkey={bounty.publicKey}
              companyWallet={bounty.company}
              prizeInSol={bounty.prizeInSol}
              isCompany={!!isCompany}
            />
          )}

          {/* Submit Tab */}
          {activeTab === 'submit' && !bounty.completed && !isCompany && (
            <SubmissionForm
              bountyId={bountyMetadata.id}
              bountyPubkey={bounty.publicKey.toString()}
              bountyTitle={bountyMetadata.title}
              onSuccess={() => {
                setActiveTab('submissions');
                fetchBountyData();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
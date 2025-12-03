'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useProgram, getHunterProfilePda } from '@/hooks/useProgram';
import Link from 'next/link';

interface Submission {
  id: string;
  hunter_wallet: string;
  description: string;
  github_url?: string;
  demo_url?: string;
  video_url?: string;
  files: any[];
  status: string;
  submitted_at: string;
  profiles?: {
    name?: string;
    avatar_url?: string;
    bio?: string;
    skills?: string[];
  };
}

interface SubmissionsReviewProps {
  bountyId: string;
  bountyPubkey: PublicKey;
  companyWallet: PublicKey;
  prizeInSol: number;
  isCompany: boolean;
}

export default function SubmissionsReview({
  bountyId,
  bountyPubkey,
  companyWallet,
  prizeInSol,
  isCompany,
}: SubmissionsReviewProps) {
  const { publicKey } = useWallet();
  const program = useProgram();
  
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectingWinner, setSelectingWinner] = useState<string | null>(null);

  useEffect(() => {
    fetchSubmissions();
  }, [bountyId]);

  async function fetchSubmissions() {
    try {
      const response = await fetch(`/api/submissions?bountyId=${bountyId}`);
      const data = await response.json();
      setSubmissions(data.submissions || []);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectWinner(submission: Submission) {
    if (!publicKey || !program || !isCompany) return;

    if (!confirm(`Select ${submission.profiles?.name || submission.hunter_wallet.slice(0, 8)} as the winner?`)) {
      return;
    }

    setSelectingWinner(submission.id);

    try {
      const winnerPubkey = new PublicKey(submission.hunter_wallet);
      const [winnerProfilePda] = getHunterProfilePda(winnerPubkey);

      // Get treasury PDA
      const [treasuryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('treasury')],
        program.programId
      );

      const submissionHash = `submission_${submission.id}`;

      const tx = await program.methods
        .selectWinner(submissionHash)
        .accounts({
          company: publicKey,
          bounty: bountyPubkey,
          winner: winnerPubkey,
          winnerProfile: winnerProfilePda,
          treasury: treasuryPda,
        })
        .rpc();

      console.log('Winner selected! Transaction:', tx);

      // Update submission status in database
      await fetch(`/api/submissions/${submission.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'accepted' }),
      });

      // Create notification for winner
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userWallet: submission.hunter_wallet,
          type: 'bounty_completed',
          title: 'Congratulations! You Won!',
          message: `You've been selected as the winner and received ${prizeInSol * 0.99} SOL!`,
          link: `/bounty/${bountyPubkey.toString()}`,
        }),
      });

      alert(`Winner selected! ${prizeInSol * 0.99} SOL has been sent to their wallet.\n\nTransaction: ${tx}`);
      
      // Refresh submissions
      fetchSubmissions();
    } catch (err: any) {
      console.error('Error selecting winner:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setSelectingWinner(null);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading submissions...</p>
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-12 text-center">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="mt-2 text-lg font-medium text-gray-900">No submissions yet</h3>
        <p className="mt-1 text-gray-500">
          {isCompany 
            ? "Hunters haven't submitted any work yet. Share this bounty to get more visibility!"
            : "Be the first to submit your work!"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">
          Submissions ({submissions.length})
        </h3>
        {isCompany && (
          <p className="text-sm text-gray-600">
            Review submissions and select a winner
          </p>
        )}
      </div>

      <div className="space-y-4">
        {submissions.map((submission) => (
          <div
            key={submission.id}
            className="bg-white border-2 border-gray-200 rounded-lg p-6 hover:border-primary/30 transition"
          >
            {/* Hunter Info */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                {submission.profiles?.avatar_url ? (
                  <img
                    src={submission.profiles.avatar_url}
                    alt={submission.profiles.name || 'Hunter'}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-xl font-bold text-gray-600">
                      {submission.profiles?.name?.[0] || '?'}
                    </span>
                  </div>
                )}
                <div>
                  <Link
                    href={`/profile/${submission.hunter_wallet}`}
                    className="font-semibold text-lg hover:text-primary transition"
                  >
                    {submission.profiles?.name || `Hunter ${submission.hunter_wallet.slice(0, 8)}...`}
                  </Link>
                  <p className="text-sm text-gray-500">
                    Submitted {new Date(submission.submitted_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <span
                className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  submission.status === 'accepted'
                    ? 'bg-green-100 text-green-800'
                    : submission.status === 'rejected'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {submission.status === 'accepted' ? '✓ Winner' : 
                 submission.status === 'rejected' ? 'Not Selected' : 
                 'Pending Review'}
              </span>
            </div>

            {/* Hunter Skills */}
            {submission.profiles?.skills && submission.profiles.skills.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {submission.profiles.skills.map((skill) => (
                  <span
                    key={skill}
                    className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-sm"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            )}

            {/* Description */}
            <div className="mb-4">
              <h4 className="font-semibold text-gray-900 mb-2">Submission Description</h4>
              <p className="text-gray-700 whitespace-pre-wrap">{submission.description}</p>
            </div>

            {/* Links */}
            <div className="space-y-2 mb-4">
              {submission.github_url && (
                <a
                  href={submission.github_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-primary hover:underline"
                >
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  View Code Repository
                </a>
              )}
              {submission.demo_url && (
                <a
                  href={submission.demo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-primary hover:underline"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  View Live Demo
                </a>
              )}
              {submission.video_url && (
                <a
                  href={submission.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-primary hover:underline"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Watch Video Demo
                </a>
              )}
            </div>

            {/* Select Winner Button (Company Only) */}
            {isCompany && submission.status === 'pending' && (
              <button
                onClick={() => handleSelectWinner(submission)}
                disabled={!!selectingWinner}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {selectingWinner === submission.id 
                  ? 'Selecting Winner...' 
                  : `Select as Winner (Send ${(prizeInSol * 0.99).toFixed(2)} SOL)`}
              </button>
            )}

            {submission.status === 'accepted' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-green-800 font-semibold">
                  ✓ This submission was selected as the winner!
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
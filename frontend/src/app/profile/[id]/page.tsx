'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useProgram, getHunterProfilePda } from '@/hooks/useProgram';
import Link from 'next/link';

export default function ProfilePage() {
  const params = useParams();
  const { publicKey } = useWallet();
  const program = useProgram();
  
  const [onChainProfile, setOnChainProfile] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const walletAddress = params.id as string;
  const isOwnProfile = publicKey && publicKey.toString() === walletAddress;

  useEffect(() => {
    fetchProfileData();
  }, [walletAddress, program]);

  async function fetchProfileData() {
    try {
      // Fetch on-chain profile
      if (program) {
        try {
          const [profilePda] = getHunterProfilePda(new PublicKey(walletAddress));
          const onChainData = await program.account.hunterProfile.fetch(profilePda);
          setOnChainProfile(onChainData);
        } catch (err) {
          console.log('No on-chain profile yet');
        }
      }

      // Fetch submissions
      try {
        const submissionsResponse = await fetch(`/api/submissions?hunterWallet=${walletAddress}`);
        if (submissionsResponse.ok) {
          const submissionsData = await submissionsResponse.json();
          setSubmissions(submissionsData.submissions || []);
        }
      } catch (err) {
        console.log('Could not fetch submissions');
      }

    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  const stats = {
    bountiesCompleted: onChainProfile?.bountiesCompleted || 0,
    totalSubmissions: submissions.length,
    acceptedSubmissions: submissions.filter(s => s.status === 'accepted').length,
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Profile Header */}
      <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-6">
            {/* Avatar */}
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center border-4 border-primary/20">
                <span className="text-4xl font-bold text-white">
                  {walletAddress[0].toUpperCase()}
                </span>
              </div>
              {onChainProfile && onChainProfile.bountiesCompleted > 0 && (
                <div className="absolute -bottom-2 -right-2 bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center border-2 border-white">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>

            {/* Info */}
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Hunter {walletAddress.slice(0, 8)}...
              </h1>
              <p className="text-gray-600 mt-1">
                {onChainProfile 
                  ? 'Verified on-chain profile' 
                  : 'New to OpenBounty'}
              </p>
              <div className="flex items-center space-x-4 mt-3 text-sm text-gray-600">
                <span className="font-mono text-xs">
                  {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
                </span>
              </div>
            </div>
          </div>

          {/* Edit Button */}
          {isOwnProfile && (
            <Link
              href="/profile/edit"
              className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary/90 transition"
            >
              Edit Profile
            </Link>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <div className="text-3xl font-bold text-primary">{stats.bountiesCompleted}</div>
          <div className="text-gray-600 mt-1">Bounties Won</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <div className="text-3xl font-bold text-primary">{stats.totalSubmissions}</div>
          <div className="text-gray-600 mt-1">Total Submissions</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <div className="text-3xl font-bold text-primary">
            {stats.totalSubmissions > 0 
              ? `${Math.round((stats.acceptedSubmissions / stats.totalSubmissions) * 100)}%`
              : '0%'}
          </div>
          <div className="text-gray-600 mt-1">Win Rate</div>
        </div>
      </div>

      {/* Recent Submissions */}
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-bold mb-6">Recent Submissions</h2>
        {submissions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">
              {isOwnProfile 
                ? "You haven't submitted any work yet. Browse bounties to get started!"
                : "This hunter hasn't submitted any work yet."}
            </p>
            {isOwnProfile && (
              <Link
                href="/"
                className="inline-block mt-4 bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary/90 transition"
              >
                Browse Bounties
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {submissions.slice(0, 10).map((submission: any) => (
              <div
                key={submission.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-primary/50 transition"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">
                      Bounty Submission
                    </h3>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                      {submission.description}
                    </p>
                    <div className="flex items-center space-x-4 text-sm">
                      {submission.github_url && (
                        <a
                          href={submission.github_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          🔗 Code
                        </a>
                      )}
                      {submission.demo_url && (
                        <a
                          href={submission.demo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          🌐 Demo
                        </a>
                      )}
                      <span className="text-gray-500">
                        {new Date(submission.submitted_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold ml-4 ${
                      submission.status === 'accepted'
                        ? 'bg-green-100 text-green-800'
                        : submission.status === 'rejected'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {submission.status === 'accepted' ? '✓ Won' : 
                     submission.status === 'rejected' ? 'Not Selected' : 
                     'Pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Call to Action for New Users */}
      {isOwnProfile && !onChainProfile && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            Welcome to OpenBounty! 🎉
          </h3>
          <p className="text-blue-800 mb-4">
            Your on-chain profile will be created automatically when you win your first bounty. 
            Start by browsing available bounties and submitting your best work!
          </p>
          <Link
            href="/"
            className="inline-block bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary/90 transition"
          >
            Browse Bounties
          </Link>
        </div>
      )}
    </div>
  );
}
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useProgram, getHunterProfilePda } from '@/hooks/useProgram';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function ProfilePage() {
  const params = useParams();
  const { publicKey } = useWallet();
  const program = useProgram();

  const [onChainProfile, setOnChainProfile] = useState<any>(null);
  const [offChainProfile, setOffChainProfile] = useState<any>(null);
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

      // Fetch off-chain profile
      try {
        const profileResponse = await fetch(`/api/profiles?wallet=${walletAddress}`);
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          setOffChainProfile(profileData.profile);
        }
      } catch (err) {
        console.log('Could not fetch off-chain profile');
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading profile...</p>
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
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="max-w-6xl mx-auto">
        {/* Profile Header */}
        <Card className="mb-8 border-primary/20">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-6">
              {/* Avatar */}
              <div className="relative">
                {offChainProfile?.avatar_url ? (
                  <img
                    src={offChainProfile.avatar_url}
                    alt={offChainProfile.name || 'Profile'}
                    className="w-24 h-24 rounded-full border-2 border-primary shadow-[0_0_20px_rgba(59,130,246,0.2)] object-cover"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-surface border-2 border-primary flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.2)]">
                    <span className="text-4xl font-bold text-primary">
                      {walletAddress[0].toUpperCase()}
                    </span>
                  </div>
                )}
                {onChainProfile && onChainProfile.bountiesCompleted > 0 && (
                  <div className="absolute -bottom-2 -right-2 bg-primary text-black rounded-full w-8 h-8 flex items-center justify-center border-2 border-black">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Info */}
              <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">
                  {offChainProfile?.name || `Hunter ${walletAddress.slice(0, 8)}...`}
                </h1>
                <p className="text-gray-400 mt-1">
                  {offChainProfile?.bio || (onChainProfile
                    ? 'Verified on-chain profile'
                    : 'New to SOLhunt')}
                </p>
                <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500">
                  <span className="font-mono text-xs bg-white/5 px-2 py-1 rounded">
                    {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
                  </span>
                  {offChainProfile?.location && (
                    <span className="text-xs">📍 {offChainProfile.location}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Edit Button */}
            {isOwnProfile && (
              <Link href="/profile/edit">
                <Button>Edit Profile</Button>
              </Link>
            )}
          </div>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="text-center border-white/5">
            <div className="text-3xl font-bold text-primary">{stats.bountiesCompleted}</div>
            <div className="text-gray-400 mt-1">Bounties Won</div>
          </Card>
          <Card className="text-center border-white/5">
            <div className="text-3xl font-bold text-primary">{stats.totalSubmissions}</div>
            <div className="text-gray-400 mt-1">Total Submissions</div>
          </Card>
        </div>

        {/* Recent Submissions */}
        <Card className="border-white/10">
          <h2 className="text-2xl font-bold mb-6 text-white">Recent Submissions</h2>
          {submissions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">
                {isOwnProfile
                  ? "You haven't submitted any work yet. Browse bounties to get started!"
                  : "This hunter hasn't submitted any work yet."}
              </p>
              {isOwnProfile && (
                <div className="mt-6">
                  <Link href="/">
                    <Button variant="outline">Browse Bounties</Button>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {submissions.slice(0, 10).map((submission: any) => (
                <div
                  key={submission.id}
                  className="border border-white/10 rounded-lg p-4 hover:border-primary/50 transition bg-white/5"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-2 text-white">
                        Bounty Submission
                      </h3>
                      <p className="text-sm text-gray-400 line-clamp-2 mb-2">
                        {submission.description}
                      </p>
                      <div className="flex items-center space-x-4 text-sm">
                        {submission.github_url && (
                          <a
                            href={submission.github_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary/80 transition"
                          >
                            🔗 Code
                          </a>
                        )}
                        {submission.demo_url && (
                          <a
                            href={submission.demo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary/80 transition"
                          >
                            🌐 Demo
                          </a>
                        )}
                        <span className="text-gray-600">
                          {new Date(submission.submitted_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-semibold ml-4 ${submission.status === 'accepted'
                        ? 'bg-primary/10 text-primary border border-primary/20'
                        : submission.status === 'rejected'
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
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
        </Card>

        {/* Call to Action for New Users */}
        {isOwnProfile && !onChainProfile && (
          <div className="mt-6 bg-primary/5 border border-primary/20 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-primary mb-2">
              Welcome to SOLhunt! 🎉
            </h3>
            <p className="text-gray-300 mb-4">
              Your on-chain profile will be created automatically when you win your first bounty.
              Start by browsing available bounties and submitting your best work!
            </p>
            <Link href="/">
              <Button>Browse Bounties</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
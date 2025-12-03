'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useProgram } from '@/hooks/useProgram';
import Link from 'next/link';
import { LAMPORTS_PER_SOL } from '@/lib/constants';

export default function DashboardPage() {
  const { publicKey } = useWallet();
  const program = useProgram();
  
  const [myBounties, setMyBounties] = useState<any[]>([]);
  const [mySubmissions, setMySubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'bounties' | 'submissions'>('bounties');

  useEffect(() => {
    if (publicKey) {
      fetchData();
    }
  }, [publicKey, program]);

  async function fetchData() {
    if (!publicKey || !program) return;

    setLoading(true);
    try {
      // Fetch all bounties created by this wallet
      const allBounties = await program.account.bounty.all();
      const myBountiesData = allBounties
        .filter(b => b.account.company.toString() === publicKey.toString())
        .map(b => ({
          ...b.account,
          publicKey: b.publicKey,
          prizeInSol: b.account.prizeAmount / LAMPORTS_PER_SOL,
        }));

      setMyBounties(myBountiesData);

      // Fetch metadata for each bounty
      const bountiesWithMetadata = await Promise.all(
        myBountiesData.map(async (bounty) => {
          try {
            const response = await fetch(`/api/bounties?bountyPubkey=${bounty.publicKey.toString()}`);
            if (response.ok) {
              const data = await response.json();
              return { ...bounty, metadata: data.bounty };
            }
          } catch (err) {
            console.log('Could not fetch metadata for bounty');
          }
          return bounty;
        })
      );

      setMyBounties(bountiesWithMetadata);

      // Fetch submissions made by this wallet
      try {
        const submissionsResponse = await fetch(`/api/submissions?hunterWallet=${publicKey.toString()}`);
        if (submissionsResponse.ok) {
          const submissionsData = await submissionsResponse.json();
          setMySubmissions(submissionsData.submissions || []);
        }
      } catch (err) {
        console.log('Could not fetch submissions');
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (!publicKey) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
          <p className="text-gray-600">
            Please connect your wallet to view your dashboard
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const stats = {
    totalBounties: myBounties.length,
    activeBounties: myBounties.filter(b => !b.completed).length,
    completedBounties: myBounties.filter(b => b.completed).length,
    totalSpent: myBounties.reduce((sum, b) => sum + b.prizeInSol, 0),
    totalSubmissions: mySubmissions.length,
    acceptedSubmissions: mySubmissions.filter(s => s.status === 'accepted').length,
    pendingSubmissions: mySubmissions.filter(s => s.status === 'pending').length,
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <Link
          href="/create"
          className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary/90 transition"
        >
          + Post New Bounty
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-3xl font-bold text-primary">{stats.totalBounties}</div>
          <div className="text-gray-600 mt-1">Total Bounties</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-3xl font-bold text-blue-600">{stats.activeBounties}</div>
          <div className="text-gray-600 mt-1">Active</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-3xl font-bold text-green-600">{stats.completedBounties}</div>
          <div className="text-gray-600 mt-1">Completed</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-3xl font-bold text-purple-600">{stats.totalSpent.toFixed(2)}</div>
          <div className="text-gray-600 mt-1">Total SOL Spent</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('bounties')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition ${
                activeTab === 'bounties'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              My Bounties ({stats.totalBounties})
            </button>
            <button
              onClick={() => setActiveTab('submissions')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition ${
                activeTab === 'submissions'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              My Submissions ({stats.totalSubmissions})
            </button>
          </nav>
        </div>

        <div className="p-8">
          {/* My Bounties Tab */}
          {activeTab === 'bounties' && (
            <div>
              {myBounties.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="mt-2 text-lg font-medium text-gray-900">No bounties yet</h3>
                  <p className="mt-1 text-gray-500">
                    Get started by posting your first bounty!
                  </p>
                  <div className="mt-6">
                    <Link
                      href="/create"
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90"
                    >
                      Post a Bounty
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {myBounties.map((bounty) => (
                    <Link
                      key={bounty.publicKey.toString()}
                      href={`/bounty/${bounty.publicKey.toString()}`}
                      className="block border-2 border-gray-200 rounded-lg p-6 hover:border-primary/50 transition"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-semibold text-gray-900">
                              {bounty.metadata?.title || `Bounty ${bounty.publicKey.toString().slice(0, 8)}...`}
                            </h3>
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
                          
                          {bounty.metadata?.description && (
                            <p className="text-gray-600 mb-3 line-clamp-2">
                              {bounty.metadata.description}
                            </p>
                          )}

                          <div className="flex items-center space-x-6 text-sm text-gray-600">
                            <div>
                              <span className="font-medium">Prize:</span>{' '}
                              <span className="text-primary font-semibold">{bounty.prizeInSol} SOL</span>
                            </div>
                            <div>
                              <span className="font-medium">Created:</span>{' '}
                              {new Date(bounty.createdAt * 1000).toLocaleDateString()}
                            </div>
                            {bounty.metadata?.submission_count !== undefined && (
                              <div>
                                <span className="font-medium">Submissions:</span>{' '}
                                <span className="text-primary font-semibold">
                                  {bounty.metadata.submission_count}
                                </span>
                              </div>
                            )}
                            {bounty.completed && bounty.winner && (
                              <div>
                                <span className="font-medium">Winner:</span>{' '}
                                {bounty.winner.toString().slice(0, 8)}...
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="ml-4">
                          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* My Submissions Tab */}
          {activeTab === 'submissions' && (
            <div>
              {mySubmissions.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="mt-2 text-lg font-medium text-gray-900">No submissions yet</h3>
                  <p className="mt-1 text-gray-500">
                    Browse bounties and submit your work to get started!
                  </p>
                  <div className="mt-6">
                    <Link
                      href="/"
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90"
                    >
                      Browse Bounties
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-yellow-700">{stats.pendingSubmissions}</div>
                      <div className="text-sm text-yellow-600">Pending Review</div>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-green-700">{stats.acceptedSubmissions}</div>
                      <div className="text-sm text-green-600">Won</div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-gray-700">
                        {stats.totalSubmissions > 0 
                          ? Math.round((stats.acceptedSubmissions / stats.totalSubmissions) * 100)
                          : 0}%
                      </div>
                      <div className="text-sm text-gray-600">Win Rate</div>
                    </div>
                  </div>

                  {mySubmissions.map((submission) => (
                    <div
                      key={submission.id}
                      className="border-2 border-gray-200 rounded-lg p-6"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            Submission
                          </h3>
                          <p className="text-gray-600 text-sm line-clamp-2 mb-3">
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
          )}
        </div>
      </div>
    </div>
  );
}
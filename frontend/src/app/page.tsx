'use client';

import { useEffect, useState } from 'react';
import { useProgram } from '@/hooks/useProgram';
import { LAMPORTS_PER_SOL } from '@/lib/constants';
import Link from 'next/link';

export default function HomePage() {
  const program = useProgram();
  const [bounties, setBounties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBounties();
  }, [program]);

  async function fetchBounties() {
    if (!program) return;

    try {
      // Fetch all bounties from on-chain
      const allBounties = await program.account.bounty.all();
      
      // Convert to format with SOL amounts
      const bountiesData = allBounties.map(b => ({
        ...b.account,
        publicKey: b.publicKey,
        prizeInSol: b.account.prizeAmount / LAMPORTS_PER_SOL,
      }));

      // Fetch metadata for each bounty
      const bountiesWithMetadata = await Promise.all(
        bountiesData.map(async (bounty) => {
          try {
            const response = await fetch(`/api/bounties?bountyPubkey=${bounty.publicKey.toString()}`);
            if (response.ok) {
              const data = await response.json();
              return {
                ...bounty,
                metadata: data.bounty,
              };
            }
          } catch (err) {
            console.log('Could not fetch metadata for bounty');
          }
          return bounty;
        })
      );

      // Filter to show only active bounties (not completed)
      const activeBounties = bountiesWithMetadata.filter(b => !b.completed);

      setBounties(activeBounties);
    } catch (error) {
      console.error('Error fetching bounties:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading bounties...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Available Bounties
        </h1>
        <p className="text-xl text-gray-600">
          Find tasks, submit your work, and earn SOL
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <div className="text-3xl font-bold text-primary">{bounties.length}</div>
          <div className="text-gray-600 mt-1">Active Bounties</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <div className="text-3xl font-bold text-primary">
            {bounties.reduce((sum, b) => sum + b.prizeInSol, 0).toFixed(2)}
          </div>
          <div className="text-gray-600 mt-1">Total SOL Available</div>
        </div>
      </div>

      {/* Bounties List */}
      {bounties.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-lg font-medium text-gray-900">No bounties available</h3>
          <p className="mt-1 text-gray-500">
            Check back later or be the first to post a bounty!
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
        <div className="space-y-6">
          {bounties.map((bounty) => (
            <Link
              key={bounty.publicKey.toString()}
              href={`/bounty/${bounty.publicKey.toString()}`}
              className="block bg-white rounded-lg shadow hover:shadow-lg transition p-6"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  {/* Title */}
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {bounty.metadata?.title || `Bounty ${bounty.publicKey.toString().slice(0, 8)}...`}
                  </h3>

                  {/* Category Badge */}
                  {bounty.metadata?.category && (
                    <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded mb-3">
                      {bounty.metadata.category.charAt(0).toUpperCase() + bounty.metadata.category.slice(1)}
                    </span>
                  )}

                  {/* Description */}
                  <p className="text-gray-600 mb-4 line-clamp-2">
                    {bounty.metadata?.description || 'No description available'}
                  </p>

                  {/* Skills */}
                  {bounty.metadata?.skills_required && bounty.metadata.skills_required.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {bounty.metadata.skills_required.slice(0, 5).map((skill: string, index: number) => (
                        <span
                          key={index}
                          className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded"
                        >
                          {skill}
                        </span>
                      ))}
                      {bounty.metadata.skills_required.length > 5 && (
                        <span className="text-gray-500 text-xs px-2 py-1">
                          +{bounty.metadata.skills_required.length - 5} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Meta Info */}
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {bounty.company.toString().slice(0, 8)}...
                    </div>
                    {bounty.metadata?.created_at && (
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {new Date(bounty.metadata.created_at).toLocaleDateString()}
                      </div>
                    )}
                    {bounty.metadata?.submission_count !== undefined && (
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {bounty.metadata.submission_count} submission{bounty.metadata.submission_count !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>

                {/* Prize */}
                <div className="ml-6 text-right">
                  <div className="text-3xl font-bold text-primary">
                    {bounty.prizeInSol} SOL
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    ~${(bounty.prizeInSol * 200).toFixed(0)} USD
                  </p>
                  <div className="mt-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">
                      ● Open
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Call to Action */}
      <div className="mt-12 bg-gradient-to-r from-primary to-purple-600 rounded-lg shadow-lg p-8 text-white text-center">
        <h2 className="text-2xl font-bold mb-4">Want to post a bounty?</h2>
        <p className="text-lg mb-6 opacity-90">
          Get high-quality work done by talented freelancers on Solana
        </p>
        <Link
          href="/create"
          className="inline-block bg-white text-primary px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition"
        >
          Post a Bounty
        </Link>
      </div>
    </div>
  );
}
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search for users
  useEffect(() => {
    async function searchUsers() {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }

      try {
        const response = await fetch(`/api/profiles/search?q=${encodeURIComponent(searchQuery)}`);
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data.profiles || []);
          setShowResults(true);
        }
      } catch (err) {
        console.error('Error searching users:', err);
      }
    }

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  function handleSelectUser(wallet: string) {
    router.push(`/profile/${wallet}`);
    setSearchQuery('');
    setShowResults(false);
  }

  return (
    <nav className="bg-surface/50 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-2 sm:px-3 lg:px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center">
              <Image
                src="/translogo.png"
                alt="SOLhunt"
                width={392}
                height={112}
                className="h-28 w-auto"
                priority
              />
            </Link>

            <div className="hidden md:flex space-x-10">
              <Link
                href="/"
                className="text-gray-300 hover:text-white transition hover:shadow-[0_0_20px_rgba(139,92,246,0.5)]"
              >
                Browse Bounties
              </Link>
              <Link
                href="/create"
                className="text-gray-300 hover:text-white transition"
              >
                Post Bounty
              </Link>
              <Link
                href="/profile"
                className="text-gray-300 hover:text-white transition"
              >
                My Profile
              </Link>
              <Link
                href="/dashboard"
                className="text-gray-300 hover:text-white transition"
              >
                Dashboard
              </Link>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* User Search */}
            <div className="relative" ref={searchRef}>
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
                className="bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-primary/50 transition-colors w-48"
              />

              {/* Search Results Dropdown */}
              {showResults && searchResults.length > 0 && (
                <div className="absolute top-full mt-2 w-64 bg-surface border border-white/10 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {searchResults.map((profile) => (
                    <button
                      key={profile.wallet_address}
                      onClick={() => handleSelectUser(profile.wallet_address)}
                      className="w-full px-4 py-3 hover:bg-white/5 transition flex items-center space-x-3 text-left"
                    >
                      {profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt={profile.name}
                          className="w-8 h-8 rounded-full object-cover border border-primary/30"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                          <span className="text-xs font-bold text-primary">
                            {profile.wallet_address[0].toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium truncate">
                          {profile.name || `${profile.wallet_address.slice(0, 8)}...`}
                        </div>
                        <div className="text-gray-500 text-xs truncate">
                          {profile.wallet_address.slice(0, 8)}...{profile.wallet_address.slice(-4)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* No Results */}
              {showResults && searchQuery.length >= 2 && searchResults.length === 0 && (
                <div className="absolute top-full mt-2 w-64 bg-surface border border-white/10 rounded-lg shadow-lg p-4">
                  <p className="text-gray-400 text-sm text-center">No users found</p>
                </div>
              )}
            </div>

            <WalletMultiButton />
          </div>
        </div>
      </div>
    </nav>
  );
}
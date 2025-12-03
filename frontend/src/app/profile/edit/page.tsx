'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';

export default function EditProfilePage() {
  const { publicKey } = useWallet();
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    skills: '',
    college: '',
    location: '',
    websiteUrl: '',
    githubUrl: '',
    linkedinUrl: '',
    twitterUrl: '',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (publicKey) {
      fetchProfile();
    }
  }, [publicKey]);

  async function fetchProfile() {
    if (!publicKey) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/profiles?wallet=${publicKey.toString()}`);
      if (response.ok) {
        const data = await response.json();
        if (data.profile) {
          setFormData({
            name: data.profile.name || '',
            bio: data.profile.bio || '',
            skills: data.profile.skills?.join(', ') || '',
            college: data.profile.college || '',
            location: data.profile.location || '',
            websiteUrl: data.profile.website_url || '',
            githubUrl: data.profile.github_url || '',
            linkedinUrl: data.profile.linkedin_url || '',
            twitterUrl: data.profile.twitter_url || '',
          });
        }
      }
    } catch (err) {
      console.log('No existing profile found, creating new one');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!publicKey) {
      setError('Please connect your wallet');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: publicKey.toString(),
          name: formData.name,
          bio: formData.bio,
          skills: formData.skills 
            ? formData.skills.split(',').map(s => s.trim()).filter(s => s)
            : [],
          college: formData.college,
          location: formData.location,
          websiteUrl: formData.websiteUrl,
          githubUrl: formData.githubUrl,
          linkedinUrl: formData.linkedinUrl,
          twitterUrl: formData.twitterUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save profile');
      }

      setSuccess('Profile saved successfully!');
      
      // Redirect to profile page after 1.5 seconds
      setTimeout(() => {
        router.push(`/profile/${publicKey.toString()}`);
      }, 1500);

    } catch (err: any) {
      console.error('Error saving profile:', err);
      setError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  if (!publicKey) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
          <p className="text-gray-600">
            Please connect your wallet to edit your profile
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-white rounded-lg shadow p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Edit Profile</h1>
          <button
            onClick={() => router.push(`/profile/${publicKey.toString()}`)}
            className="text-gray-600 hover:text-gray-900 transition"
          >
            Cancel
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading profile...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name *
              </label>
              <input
                type="text"
                required
                maxLength={100}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Your full name"
              />
            </div>

            {/* Bio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bio
              </label>
              <textarea
                rows={4}
                maxLength={500}
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Tell companies about yourself and your experience..."
              />
              <p className="text-sm text-gray-500 mt-1">
                {formData.bio.length} / 500 characters
              </p>
            </div>

            {/* Skills */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Skills
              </label>
              <input
                type="text"
                value={formData.skills}
                onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="e.g., React, Solana, Web3, Design (comma separated)"
              />
              <p className="text-sm text-gray-500 mt-1">
                Separate skills with commas
              </p>
            </div>

            {/* College */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                College/University
              </label>
              <input
                type="text"
                maxLength={200}
                value={formData.college}
                onChange={(e) => setFormData({ ...formData, college: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="e.g., MIT, Stanford"
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location
              </label>
              <input
                type="text"
                maxLength={100}
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="e.g., San Francisco, CA"
              />
            </div>

            {/* Social Links */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">Social Links</h3>
              
              <div className="space-y-4">
                {/* Website */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🌐 Portfolio Website
                  </label>
                  <input
                    type="url"
                    value={formData.websiteUrl}
                    onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="https://yourwebsite.com"
                  />
                </div>

                {/* GitHub */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    💻 GitHub Profile
                  </label>
                  <input
                    type="url"
                    value={formData.githubUrl}
                    onChange={(e) => setFormData({ ...formData, githubUrl: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="https://github.com/yourusername"
                  />
                </div>

                {/* LinkedIn */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    💼 LinkedIn Profile
                  </label>
                  <input
                    type="url"
                    value={formData.linkedinUrl}
                    onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="https://linkedin.com/in/yourusername"
                  />
                </div>

                {/* Twitter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🐦 Twitter/X Profile
                  </label>
                  <input
                    type="url"
                    value={formData.twitterUrl}
                    onChange={(e) => setFormData({ ...formData, twitterUrl: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="https://twitter.com/yourusername"
                  />
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">💡 Profile Tips</h4>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>Add your skills so companies can find you for relevant bounties</li>
                <li>A good bio helps companies understand your background</li>
                <li>Link your GitHub to showcase your code</li>
                <li>Your on-chain reputation updates automatically when you win bounties</li>
              </ul>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800">{success}</p>
              </div>
            )}

            <div className="flex space-x-4">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
              <button
                type="button"
                onClick={() => router.push(`/profile/${publicKey.toString()}`)}
                className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>

            <p className="text-sm text-gray-500 text-center">
              Your profile is stored off-chain. On-chain reputation (bounties won) updates automatically.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
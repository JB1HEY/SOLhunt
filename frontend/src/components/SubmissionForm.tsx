'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

interface SubmissionFormProps {
  bountyId: string;
  bountyPubkey: string;
  bountyTitle: string;
  onSuccess: () => void;
}

export default function SubmissionForm({ 
  bountyId, 
  bountyPubkey,
  bountyTitle, 
  onSuccess 
}: SubmissionFormProps) {
  const { publicKey } = useWallet();
  
  const [formData, setFormData] = useState({
    description: '',
    githubUrl: '',
    demoUrl: '',
    videoUrl: '',
  });
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!publicKey) {
      setError('Please connect your wallet');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // TODO: Upload files to storage (Supabase Storage, AWS S3, or IPFS)
      const uploadedFiles = await uploadFiles(files);

      // Submit to API
      const response = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bountyId,
          bountyPubkey,
          hunterWallet: publicKey.toString(),
          description: formData.description,
          githubUrl: formData.githubUrl,
          demoUrl: formData.demoUrl,
          videoUrl: formData.videoUrl,
          files: uploadedFiles,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit');
      }

      alert('Submission successful! The bounty owner will review your work.');
      onSuccess();
    } catch (err: any) {
      console.error('Error submitting:', err);
      setError(err.message || 'Failed to submit');
    } finally {
      setLoading(false);
    }
  }

  async function uploadFiles(files: File[]) {
    // TODO: Implement file upload to your storage solution
    // For now, return empty array
    // In production, upload to Supabase Storage, S3, or IPFS
    return [];
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  }

  return (
    <div className="bg-white rounded-lg border-2 border-primary/20 p-6">
      <h3 className="text-2xl font-bold mb-2">Submit Your Work</h3>
      <p className="text-gray-600 mb-6">
        Submit your completed work for "{bountyTitle}"
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description * 
            <span className="text-gray-500 font-normal ml-2">
              Explain what you built and how it meets the requirements
            </span>
          </label>
          <textarea
            required
            rows={6}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="Describe your solution, approach, technologies used, and any challenges you overcame..."
          />
        </div>

        {/* GitHub URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            GitHub Repository
          </label>
          <input
            type="url"
            value={formData.githubUrl}
            onChange={(e) => setFormData({ ...formData, githubUrl: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="https://github.com/username/repo"
          />
        </div>

        {/* Demo URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Live Demo / Deployed Link
          </label>
          <input
            type="url"
            value={formData.demoUrl}
            onChange={(e) => setFormData({ ...formData, demoUrl: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="https://your-demo-site.com"
          />
        </div>

        {/* Video URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Video Demo (YouTube, Loom, etc.)
          </label>
          <input
            type="url"
            value={formData.videoUrl}
            onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="https://youtube.com/watch?v=..."
          />
        </div>

        {/* File Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Additional Files (Optional)
          </label>
          <input
            type="file"
            multiple
            onChange={handleFileChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            accept=".pdf,.zip,.png,.jpg,.jpeg"
          />
          <p className="text-sm text-gray-500 mt-1">
            Upload screenshots, PDFs, or ZIP files (max 10MB each)
          </p>
          {files.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-medium">Selected files:</p>
              <ul className="text-sm text-gray-600 list-disc list-inside">
                {files.map((file, idx) => (
                  <li key={idx}>{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">Submission Guidelines</h4>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Provide a clear description of your work</li>
            <li>Include links to code repositories and demos</li>
            <li>Make sure all links are publicly accessible</li>
            <li>The bounty owner will review and may contact you for clarifications</li>
            <li>If selected as winner, payment will be sent to your wallet automatically</li>
          </ul>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !publicKey}
          className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Submitting...' : 'Submit Work'}
        </button>

        {!publicKey && (
          <p className="text-center text-sm text-gray-600">
            Connect your wallet to submit
          </p>
        )}
      </form>
    </div>
  );
}
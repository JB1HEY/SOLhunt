'use client';

import { useState } from 'react';

export default function APITest() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function testSubmissionsAPI() {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      console.log('Testing GET /api/submissions...');
      
      const response = await fetch('/api/submissions?bountyId=test123');
      console.log('Response status:', response.status);
      
      const data = await response.json();
      console.log('Response data:', data);
      
      setResult({
        status: response.status,
        ok: response.ok,
        data: data,
      });

      if (!response.ok) {
        setError(`API returned ${response.status}: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error('Error testing API:', err);
      setError(err.message);
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function testBountiesAPI() {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      console.log('Testing GET /api/bounties...');
      
      const response = await fetch('/api/bounties');
      console.log('Response status:', response.status);
      
      const data = await response.json();
      console.log('Response data:', data);
      
      setResult({
        status: response.status,
        ok: response.ok,
        data: data,
      });

      if (!response.ok) {
        setError(`API returned ${response.status}: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error('Error testing API:', err);
      setError(err.message);
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="bg-white rounded-lg shadow p-8">
        <h1 className="text-3xl font-bold mb-6">API Testing</h1>
        
        <div className="space-y-4 mb-6">
          <button
            onClick={testSubmissionsAPI}
            disabled={loading}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? 'Testing...' : 'Test GET /api/submissions'}
          </button>

          <button
            onClick={testBountiesAPI}
            disabled={loading}
            className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
          >
            {loading ? 'Testing...' : 'Test GET /api/bounties'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-red-900 mb-2">Error:</h3>
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {result && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold mb-2">Result:</h3>
            <div className="space-y-2">
              <div>
                <span className="font-medium">Status:</span>{' '}
                <span className={result.status === 200 ? 'text-green-600' : 'text-red-600'}>
                  {result.status}
                </span>
              </div>
              <div>
                <span className="font-medium">OK:</span>{' '}
                <span className={result.ok ? 'text-green-600' : 'text-red-600'}>
                  {String(result.ok)}
                </span>
              </div>
              <div>
                <span className="font-medium">Data:</span>
                <pre className="mt-2 p-4 bg-gray-900 text-green-400 rounded overflow-auto max-h-96">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">Instructions:</h3>
          <ol className="list-decimal list-inside space-y-2 text-blue-800 text-sm">
            <li>Click the test buttons above to check if your API routes work</li>
            <li>Check the browser console for detailed logs</li>
            <li>If you see 404, the API route file doesn't exist</li>
            <li>If you see 500, check the terminal where you ran `npm run dev`</li>
            <li>Check that files exist:
              <ul className="list-disc list-inside ml-6 mt-2">
                <li><code>frontend/src/app/api/submissions/route.ts</code></li>
                <li><code>frontend/src/app/api/bounties/route.ts</code></li>
              </ul>
            </li>
          </ol>
        </div>

        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="font-semibold text-yellow-900 mb-2">Common Issues:</h3>
          <ul className="list-disc list-inside space-y-1 text-yellow-800 text-sm">
            <li><strong>404 Error:</strong> API route file doesn't exist or is in wrong location</li>
            <li><strong>500 Error:</strong> Error in API code - check terminal logs</li>
            <li><strong>Supabase not configured:</strong> Set USE_MOCK_DATA = true in route.ts</li>
            <li><strong>Module not found:</strong> Run <code>npm install @supabase/supabase-js</code></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
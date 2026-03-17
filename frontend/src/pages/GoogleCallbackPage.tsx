import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function GoogleCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginWithGoogleCode } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      setError('No authorization code received from Google');
      return;
    }

    loginWithGoogleCode(code)
      .then(() => {
        const redirect = localStorage.getItem('auth_redirect') || '/';
        localStorage.removeItem('auth_redirect');
        navigate(redirect, { replace: true });
      })
      .catch((err) => {
        console.error('Google login failed:', err);
        setError('Google authentication failed. Please try again.');
      });
  }, [searchParams, loginWithGoogleCode, navigate]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 mb-4">
          <Shield className="w-7 h-7 text-white" />
        </div>

        {error ? (
          <div className="mt-4">
            <div className="flex items-center justify-center gap-2 text-red-600 mb-4">
              <AlertCircle className="w-5 h-5" />
              <p className="text-sm font-medium">{error}</p>
            </div>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              Back to login
            </button>
          </div>
        ) : (
          <div className="mt-4 flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <p className="text-sm text-slate-500">Signing you in...</p>
          </div>
        )}
      </div>
    </div>
  );
}

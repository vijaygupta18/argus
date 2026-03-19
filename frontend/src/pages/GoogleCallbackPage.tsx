import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function GoogleCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginWithGoogleCode } = useAuth();
  const [error, setError] = useState('');
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 mb-6">
          <Shield className="w-7 h-7 text-white" />
        </div>

        {error ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
            <div className="flex flex-col items-center gap-3 mb-6">
              <AlertCircle className="w-8 h-8 text-red-400" />
              <p className="text-sm font-medium text-red-600">{error}</p>
            </div>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="w-full px-4 py-2.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors cursor-pointer"
            >
              Back to login
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <div>
                <p className="text-sm font-medium text-slate-700">Signing you in...</p>
                <p className="text-xs text-slate-400 mt-1">Please wait a moment</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

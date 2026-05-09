import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useClub } from '../contexts/ClubContext';
import { Trophy, Mail } from 'lucide-react';

export default function ForgotPassword() {
  const { club } = useClub();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-600 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/login" className="block text-center mb-8 group">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 transition-opacity group-hover:opacity-80 ${club?.logo_url ? '' : 'bg-yellow-400'}`}>
            {club?.logo_url
              ? <img src={club.logo_url} alt="logo" className="w-16 h-16 object-contain rounded-full" />
              : <Trophy size={32} className="text-blue-900" />}
          </div>
          <h1 className="text-3xl font-bold text-white">{club?.club_name || 'Skyhawks Cricket Club'}</h1>
          <p className="text-blue-200 mt-1 group-hover:text-blue-100 transition-colors">← Back to Sign In</p>
        </Link>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {submitted ? (
            <div className="text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail size={28} className="text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Check your email</h2>
              <p className="text-gray-500 text-sm mb-6">
                If <strong>{email}</strong> is registered, we've sent a reset link. It expires in 1 hour.
              </p>
              <Link to="/login" className="btn-primary w-full py-2.5 text-sm inline-block text-center">Back to Sign In</Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Forgot your password?</h2>
              <p className="text-gray-500 text-sm mb-6">Enter your registered email and we'll send you a reset link.</p>

              {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input type="email" className="input-field" placeholder="you@example.com"
                    value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

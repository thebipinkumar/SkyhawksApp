import { useState, FormEvent } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useClub } from '../contexts/ClubContext';
import { Trophy, Eye, EyeOff, CheckCircle } from 'lucide-react';

export default function ResetPassword() {
  const { club } = useClub();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true); setError('');
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">
      Invalid reset link. <Link to="/forgot-password" className="ml-1 text-blue-600 underline">Request a new one.</Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-600 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${club?.logo_url ? '' : 'bg-yellow-400'}`}>
            {club?.logo_url
              ? <img src={club.logo_url} alt="logo" className="w-16 h-16 object-contain rounded-full" />
              : <Trophy size={32} className="text-blue-900" />}
          </div>
          <h1 className="text-3xl font-bold text-white">{club?.club_name || 'Skyhawks Cricket Club'}</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {done ? (
            <div className="text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={28} className="text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Password updated!</h2>
              <p className="text-gray-500 text-sm mb-6">Redirecting you to sign in…</p>
              <Link to="/login" className="btn-primary w-full py-2.5 text-sm inline-block text-center">Sign In Now</Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Set a new password</h2>
              <p className="text-gray-500 text-sm mb-6">Choose a strong password with at least 6 characters.</p>

              {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                  <div className="relative">
                    <input type={showPass ? 'text' : 'password'} className="input-field pr-10"
                      placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required autoFocus />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                      {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                  <input type="password" className="input-field" placeholder="••••••••"
                    value={confirm} onChange={e => setConfirm(e.target.value)} required />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
                  {loading ? 'Updating…' : 'Update Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

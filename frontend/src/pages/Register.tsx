import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useClub } from '../contexts/ClubContext';
import { Trophy, Eye, EyeOff, CheckCircle } from 'lucide-react';

export default function Register() {
  const { club } = useClub();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', phone: '' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await api.post('/auth/register', { name: form.name, email: form.email, password: form.password, phone: form.phone });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-600 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/public/about" className="block text-center mb-8 group">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 transition-opacity group-hover:opacity-80 ${club?.logo_url ? '' : 'bg-yellow-400 group-hover:bg-yellow-300'}`}>
            {club?.logo_url
              ? <img src={club.logo_url} alt="logo" className="w-16 h-16 object-contain rounded-full" />
              : <Trophy size={32} className="text-blue-900" />}
          </div>
          <h1 className="text-3xl font-bold text-white">{club?.club_name || 'Skyhawks Cricket Club'}</h1>
          <p className="text-blue-200 mt-1 group-hover:text-blue-100 transition-colors">← Back to Home</p>
        </Link>

        {submitted ? (
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <CheckCircle size={36} className="text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Registration Submitted!</h2>
            <p className="text-gray-600 mb-6">
              Your request has been sent to the club manager for approval. You will be able to log in once your account is approved.
            </p>
            <Link to="/login" className="btn-primary inline-block px-6 py-2.5">Back to Sign In</Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <h2 className="text-xl font-bold text-gray-800 mb-6">Create Account</h2>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input type="text" className="input-field" placeholder="John Smith" value={form.name} onChange={update('name')} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input type="email" className="input-field" placeholder="john@example.com" value={form.email} onChange={update('email')} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone (optional)</label>
                <input type="tel" className="input-field" placeholder="+1 234 567 8900" value={form.phone} onChange={update('phone')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} className="input-field pr-10" placeholder="Min. 6 characters"
                    value={form.password} onChange={update('password')} required />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input type={showPass ? 'text' : 'password'} className="input-field" placeholder="Repeat password"
                  value={form.confirmPassword} onChange={update('confirmPassword')} required />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base mt-2">
                {loading ? 'Submitting...' : 'Request to Join'}
              </button>
            </form>

            <p className="text-center text-sm text-gray-600 mt-6">
              Already a member? <Link to="/login" className="text-blue-700 font-medium hover:underline">Sign in</Link>
            </p>
          </div>
        )}

        <p className="text-center text-blue-200 text-xs mt-4">
          Registrations require approval from a manager or admin.
        </p>
      </div>
    </div>
  );
}

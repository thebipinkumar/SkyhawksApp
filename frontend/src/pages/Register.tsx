import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useClub } from '../contexts/ClubContext';
import { Trophy, Eye, EyeOff, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';

const TSHIRT_SIZES = ['', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
const LOWER_SIZES  = ['', '28', '30', '32', '34', '36', '38', '40', '42'];
const SLEEVES      = ['', 'Half Sleeve', 'Full Sleeve'];

const emptyKit = { tshirt_size: '', lower_size: '', sleeve: '' };

export default function Register() {
  const { club } = useClub();
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '', phone: '',
    date_of_birth: '', jersey_number: '', jersey_label: '',
  });
  const [whites, setWhites] = useState({ ...emptyKit });
  const [colored, setColored] = useState({ ...emptyKit });
  const [showKitSection, setShowKitSection] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const copyWhitesToColored = () => setColored({ ...whites });
  const copyColoredToWhites = () => setWhites({ ...colored });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await api.post('/auth/register', {
        name: form.name, email: form.email, password: form.password, phone: form.phone,
        date_of_birth: form.date_of_birth || null,
        jersey_number: form.jersey_number || null,
        jersey_label:  form.jersey_label  || null,
        whites_tshirt_size: whites.tshirt_size || null,
        whites_lower_size:  whites.lower_size  || null,
        whites_sleeve:      whites.sleeve      || null,
        colored_tshirt_size: colored.tshirt_size || null,
        colored_lower_size:  colored.lower_size  || null,
        colored_sleeve:      colored.sleeve      || null,
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-600 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
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
            <p className="text-gray-600 mb-6">Your request has been sent to the club manager for approval. You will be able to log in once approved.</p>
            <Link to="/login" className="btn-primary inline-block px-6 py-2.5">Back to Sign In</Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <h2 className="text-xl font-bold text-gray-800 mb-6">Create Account</h2>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* ── Basic Info ── */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input type="text" className="input-field" placeholder="John Smith" value={form.name} onChange={update('name')} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                <input type="email" className="input-field" placeholder="john@example.com" value={form.email} onChange={update('email')} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input type="tel" className="input-field" placeholder="+65 9123 4567" value={form.phone} onChange={update('phone')} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                  <input type="date" className="input-field" value={form.date_of_birth} onChange={update('date_of_birth')} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} className="input-field pr-10" placeholder="Min. 6 characters"
                    value={form.password} onChange={update('password')} required />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
                <input type={showPass ? 'text' : 'password'} className="input-field" placeholder="Repeat password"
                  value={form.confirmPassword} onChange={update('confirmPassword')} required />
              </div>

              {/* ── Jersey / Kit Details (collapsible) ── */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <button type="button" onClick={() => setShowKitSection(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700">
                  <span>🏏 Jersey & Kit Preferences <span className="text-gray-400 font-normal">(optional)</span></span>
                  {showKitSection ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {showKitSection && (
                  <div className="p-4 space-y-4">
                    {/* Jersey identity */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Jersey Number</label>
                        <input type="text" className="input-field" placeholder="e.g. 7" value={form.jersey_number} onChange={update('jersey_number')} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Jersey Label / Name</label>
                        <input type="text" className="input-field" placeholder="e.g. SMITH" value={form.jersey_label} onChange={update('jersey_label')} />
                      </div>
                    </div>

                    {/* Whites */}
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">⚪ Whites</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">T-Shirt Size</label>
                          <select className="input-field text-sm" value={whites.tshirt_size} onChange={e => setWhites(w => ({ ...w, tshirt_size: e.target.value }))}>
                            {TSHIRT_SIZES.map(s => <option key={s} value={s}>{s || '—'}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Lower Size</label>
                          <select className="input-field text-sm" value={whites.lower_size} onChange={e => setWhites(w => ({ ...w, lower_size: e.target.value }))}>
                            {LOWER_SIZES.map(s => <option key={s} value={s}>{s || '—'}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Sleeve</label>
                          <select className="input-field text-sm" value={whites.sleeve} onChange={e => setWhites(w => ({ ...w, sleeve: e.target.value }))}>
                            {SLEEVES.map(s => <option key={s} value={s}>{s || '—'}</option>)}
                          </select>
                        </div>
                      </div>
                      <button type="button" onClick={copyWhitesToColored}
                        className="mt-2 text-xs text-blue-600 hover:underline">Copy Whites → Colored</button>
                    </div>

                    {/* Colored */}
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">🔵 Colored</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">T-Shirt Size</label>
                          <select className="input-field text-sm" value={colored.tshirt_size} onChange={e => setColored(c => ({ ...c, tshirt_size: e.target.value }))}>
                            {TSHIRT_SIZES.map(s => <option key={s} value={s}>{s || '—'}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Lower Size</label>
                          <select className="input-field text-sm" value={colored.lower_size} onChange={e => setColored(c => ({ ...c, lower_size: e.target.value }))}>
                            {LOWER_SIZES.map(s => <option key={s} value={s}>{s || '—'}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Sleeve</label>
                          <select className="input-field text-sm" value={colored.sleeve} onChange={e => setColored(c => ({ ...c, sleeve: e.target.value }))}>
                            {SLEEVES.map(s => <option key={s} value={s}>{s || '—'}</option>)}
                          </select>
                        </div>
                      </div>
                      <button type="button" onClick={copyColoredToWhites}
                        className="mt-2 text-xs text-blue-600 hover:underline">Copy Colored → Whites</button>
                    </div>
                  </div>
                )}
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

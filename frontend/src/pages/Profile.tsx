import { useEffect, useState, useRef, FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { User } from '../types';
import { Camera, Save, Trash2, User as UserIcon, Shield, KeyRound, Eye, EyeOff } from 'lucide-react';
import { formatLastLogin, formatDate, isExpiredSGT } from '../utils/formatters';

const BATTING_STYLES = ['', 'Right-hand bat', 'Left-hand bat'];
const BOWLING_STYLES = ['', 'Right-arm fast', 'Right-arm medium', 'Right-arm off-spin', 'Right-arm leg-spin', 'Left-arm fast', 'Left-arm medium', 'Left-arm spin', 'Does not bowl'];
const TSHIRT_SIZES  = ['', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
const LOWER_SIZES   = ['', '28', '30', '32', '34', '36', '38', '40', '42'];
const SLEEVES       = ['', 'Half Sleeve', 'Full Sleeve'];

const roleBadge: Record<string, string> = {
  player: 'badge-player', manager: 'badge-manager',
  selector: 'badge-selector', admin: 'badge-admin',
};

export default function Profile() {
  const { user: authUser, login } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [form, setForm] = useState({
    name: '', phone: '', bio: '', batting_style: '', bowling_style: '',
    date_of_birth: '', jersey_number: '', jersey_label: '',
    whites_tshirt_size: '', whites_lower_size: '', whites_sleeve: '',
    colored_tshirt_size: '', colored_lower_size: '', colored_sleeve: '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const [pwForm, setPwForm] = useState({ old_password: '', new_password: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    const { data } = await api.get('/profile');
    setProfile(data);
    setForm({
      name: data.name || '', phone: data.phone || '', bio: data.bio || '',
      batting_style: data.batting_style || '', bowling_style: data.bowling_style || '',
      date_of_birth: data.date_of_birth || '', jersey_number: data.jersey_number || '',
      jersey_label: data.jersey_label || '',
      whites_tshirt_size: data.whites_tshirt_size || '', whites_lower_size: data.whites_lower_size || '',
      whites_sleeve: data.whites_sleeve || '',
      colored_tshirt_size: data.colored_tshirt_size || '', colored_lower_size: data.colored_lower_size || '',
      colored_sleeve: data.colored_sleeve || '',
    });
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true); setMsg(''); setErr('');
    try {
      const { data } = await api.put('/profile', form);
      setProfile(data);
      setMsg('Profile updated successfully!');
      // Refresh name in navbar via localStorage
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({ ...stored, name: data.name }));
    } catch (e: any) {
      setErr(e.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setMsg(''); setErr('');
    const fd = new FormData();
    fd.append('avatar', file);
    try {
      const { data } = await api.post('/profile/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setProfile(p => p ? { ...p, avatar_url: data.avatar_url } : p);
      setMsg('Profile picture updated!');
    } catch (e: any) {
      setErr(e.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    if (!confirm('Remove profile picture?')) return;
    setErr(''); setMsg('');
    await api.delete('/profile/avatar');
    setProfile(p => p ? { ...p, avatar_url: undefined } : p);
    setMsg('Profile picture removed.');
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwErr(''); setPwMsg('');
    if (pwForm.new_password !== pwForm.confirm) { setPwErr('New passwords do not match'); return; }
    setPwSaving(true);
    try {
      await api.post('/profile/change-password', { old_password: pwForm.old_password, new_password: pwForm.new_password });
      setPwMsg('Password changed successfully!');
      setPwForm({ old_password: '', new_password: '', confirm: '' });
    } catch (e: any) {
      setPwErr(e.response?.data?.error || 'Failed to change password');
    } finally {
      setPwSaving(false);
    }
  };

  const avatarSrc = profile?.avatar_url || null;
  const initials = (profile?.name || authUser?.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <UserIcon size={26} className="text-blue-700" /> My Profile
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Avatar card */}
        <div className="card flex flex-col items-center gap-4 text-center">
          <div className="relative group">
            {avatarSrc ? (
              <img src={avatarSrc} alt="avatar" className="w-32 h-32 rounded-full object-cover ring-4 ring-blue-100" />
            ) : (
              <div className="w-32 h-32 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-4xl font-bold ring-4 ring-blue-50">
                {initials}
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 rounded-full bg-black/40 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Camera size={24} />
              <span className="text-xs mt-1">{uploading ? 'Uploading…' : 'Change'}</span>
            </button>
          </div>

          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />

          <div>
            <p className="font-bold text-lg text-gray-900">{profile?.name}</p>
            <span className={`text-xs ${roleBadge[profile?.role || 'player']}`}>{profile?.role}</span>
          </div>

          <div className="w-full space-y-2">
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="btn-secondary w-full text-sm flex items-center justify-center gap-2">
              <Camera size={15} /> {uploading ? 'Uploading…' : 'Upload Photo'}
            </button>
            {profile?.avatar_url && (
              <button onClick={handleRemoveAvatar} className="btn-danger w-full text-sm flex items-center justify-center gap-2">
                <Trash2 size={15} /> Remove Photo
              </button>
            )}
          </div>

          <div className="w-full border-t pt-3 text-left space-y-2">
            <div>
              <p className="text-xs text-gray-400">Member since</p>
              <p className="text-sm text-gray-700">{formatDate(profile?.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Last login</p>
              <p className="text-sm text-gray-700">{formatLastLogin((profile as any)?.last_login)}</p>
            </div>
            {(profile as any)?.membership_end && (
              <div>
                <p className="text-xs text-gray-400">Membership expires</p>
                <p className={`text-sm font-medium ${isExpiredSGT((profile as any).membership_end) ? 'text-red-600' : 'text-green-700'}`}>
                  {formatDate((profile as any).membership_end)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Edit form */}
        <div className="md:col-span-2 card">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Shield size={18} className="text-blue-600" /> Edit Details
          </h2>

          {msg && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 mb-4 text-sm">{msg}</div>}
          {err && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{err}</div>}

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input className="input-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input className="input-field bg-gray-50 cursor-not-allowed" value={profile?.email || ''} disabled />
              <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input className="input-field" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 98765 43210" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Batting Style</label>
                <select className="input-field" value={form.batting_style} onChange={e => setForm(f => ({ ...f, batting_style: e.target.value }))}>
                  {BATTING_STYLES.map(s => <option key={s} value={s}>{s || '— Not set —'}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bowling Style</label>
                <select className="input-field" value={form.bowling_style} onChange={e => setForm(f => ({ ...f, bowling_style: e.target.value }))}>
                  {BOWLING_STYLES.map(s => <option key={s} value={s}>{s || '— Not set —'}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
              <textarea className="input-field" rows={3} value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="Tell the team a little about yourself…" />
            </div>

            {/* Jersey & Kit */}
            <div className="border-t pt-4 mt-2">
              <p className="text-sm font-semibold text-gray-700 mb-3">🏏 Jersey & Kit Preferences</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                  <input type="date" className="input-field" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jersey Number</label>
                  <input type="text" className="input-field" placeholder="e.g. 7" value={form.jersey_number} onChange={e => setForm(f => ({ ...f, jersey_number: e.target.value }))} />
                </div>
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Jersey Label / Name</label>
                <input type="text" className="input-field" placeholder="e.g. SMITH" value={form.jersey_label} onChange={e => setForm(f => ({ ...f, jersey_label: e.target.value }))} />
              </div>
              {/* Whites */}
              <div className="bg-gray-50 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">⚪ Whites</p>
                  <button type="button" onClick={() => setForm(f => ({ ...f, colored_tshirt_size: f.whites_tshirt_size, colored_lower_size: f.whites_lower_size, colored_sleeve: f.whites_sleeve }))}
                    className="text-xs text-blue-600 hover:underline">Copy → Colored</button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">T-Shirt Size</label>
                    <select className="input-field text-sm" value={form.whites_tshirt_size} onChange={e => setForm(f => ({ ...f, whites_tshirt_size: e.target.value }))}>
                      {TSHIRT_SIZES.map(s => <option key={s} value={s}>{s || '—'}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Lower Size</label>
                    <select className="input-field text-sm" value={form.whites_lower_size} onChange={e => setForm(f => ({ ...f, whites_lower_size: e.target.value }))}>
                      {LOWER_SIZES.map(s => <option key={s} value={s}>{s || '—'}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Sleeve</label>
                    <select className="input-field text-sm" value={form.whites_sleeve} onChange={e => setForm(f => ({ ...f, whites_sleeve: e.target.value }))}>
                      {SLEEVES.map(s => <option key={s} value={s}>{s || '—'}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              {/* Colored */}
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">🔵 Colored</p>
                  <button type="button" onClick={() => setForm(f => ({ ...f, whites_tshirt_size: f.colored_tshirt_size, whites_lower_size: f.colored_lower_size, whites_sleeve: f.colored_sleeve }))}
                    className="text-xs text-blue-600 hover:underline">Copy → Whites</button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">T-Shirt Size</label>
                    <select className="input-field text-sm" value={form.colored_tshirt_size} onChange={e => setForm(f => ({ ...f, colored_tshirt_size: e.target.value }))}>
                      {TSHIRT_SIZES.map(s => <option key={s} value={s}>{s || '—'}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Lower Size</label>
                    <select className="input-field text-sm" value={form.colored_lower_size} onChange={e => setForm(f => ({ ...f, colored_lower_size: e.target.value }))}>
                      {LOWER_SIZES.map(s => <option key={s} value={s}>{s || '—'}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Sleeve</label>
                    <select className="input-field text-sm" value={form.colored_sleeve} onChange={e => setForm(f => ({ ...f, colored_sleeve: e.target.value }))}>
                      {SLEEVES.map(s => <option key={s} value={s}>{s || '—'}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
                <Save size={16} /> {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
      {/* Change Password */}
      <div className="card mt-6">
        <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <KeyRound size={18} className="text-blue-600" /> Change Password
        </h2>

        {pwMsg && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 mb-4 text-sm">{pwMsg}</div>}
        {pwErr && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{pwErr}</div>}

        <form onSubmit={handleChangePassword} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <div className="relative">
              <input type={showOld ? 'text' : 'password'} className="input-field pr-10"
                placeholder="••••••••" value={pwForm.old_password}
                onChange={e => setPwForm(f => ({ ...f, old_password: e.target.value }))} required />
              <button type="button" onClick={() => setShowOld(v => !v)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                {showOld ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <div className="relative">
              <input type={showNew ? 'text' : 'password'} className="input-field pr-10"
                placeholder="••••••••" value={pwForm.new_password}
                onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))} required />
              <button type="button" onClick={() => setShowNew(v => !v)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input type="password" className="input-field" placeholder="••••••••"
              value={pwForm.confirm}
              onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} required />
          </div>
          <div className="sm:col-span-3 flex justify-end pt-1">
            <button type="submit" disabled={pwSaving} className="btn-primary flex items-center gap-2">
              <KeyRound size={15} /> {pwSaving ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

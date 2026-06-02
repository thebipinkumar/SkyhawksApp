import { useEffect, useRef, useState, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { User } from '../types';
import { ArrowLeft, Save, Shield, UserCircle, Camera, Trash2, Upload } from 'lucide-react';
import { formatLastLogin, formatDate as fmtSGT, isExpiredSGT } from '../utils/formatters';

const BATTING_STYLES = ['', 'Right-hand bat', 'Left-hand bat'];
const BOWLING_STYLES = ['', 'Right-arm fast', 'Right-arm medium', 'Right-arm off-spin', 'Right-arm leg-spin', 'Left-arm fast', 'Left-arm medium', 'Left-arm spin', 'Does not bowl'];
const TSHIRT_SIZES  = ['', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
const LOWER_SIZES   = ['', '28', '30', '32', '34', '36', '38', '40', '42'];
const SLEEVES       = ['', 'Half Sleeve', 'Full Sleeve'];

const roleBadge: Record<string, string> = {
  player: 'badge-player', manager: 'badge-manager',
  selector: 'badge-selector', admin: 'badge-admin',
};

const fmt = (d?: string | null) => fmtSGT(d ?? undefined);
const isExpired = (d?: string | null) => isExpiredSGT(d ?? undefined);

export default function AdminMemberProfile() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<User | null>(null);
  const [form, setForm] = useState({
    name: '', phone: '', bio: '', batting_style: '', bowling_style: '',
    date_of_birth: '', jersey_number: '', jersey_label: '',
    whites_tshirt_size: '', whites_lower_size: '', whites_sleeve: '',
    colored_tshirt_size: '', colored_lower_size: '', colored_sleeve: '',
    membership_end: '',
  });
  const [saving, setSaving]           = useState(false);
  const [msg, setMsg]                 = useState('');
  const [err, setErr]                 = useState('');

  // Avatar
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarRemoving, setAvatarRemoving]   = useState(false);
  const fileInputRef                          = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await api.get(`/users/${id}/profile`);
    setProfile(data);
    setForm({
      name:              data.name             || '',
      phone:             data.phone            || '',
      bio:               data.bio              || '',
      batting_style:     data.batting_style    || '',
      bowling_style:     data.bowling_style    || '',
      date_of_birth:     data.date_of_birth    || '',
      jersey_number:     data.jersey_number    || '',
      jersey_label:      data.jersey_label     || '',
      whites_tshirt_size: data.whites_tshirt_size || '',
      whites_lower_size:  data.whites_lower_size  || '',
      whites_sleeve:      data.whites_sleeve      || '',
      colored_tshirt_size: data.colored_tshirt_size || '',
      colored_lower_size:  data.colored_lower_size  || '',
      colored_sleeve:      data.colored_sleeve      || '',
      membership_end:    data.membership_end   || '',
    });
  };

  useEffect(() => { load(); }, [id]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true); setMsg(''); setErr('');
    try {
      await api.put(`/users/${id}/profile`, form);
      setMsg('Profile updated successfully!');
      load();
    } catch (e: any) {
      setErr(e.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  // ── Avatar upload ─────────────────────────────────────────────────────────
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setErr('Image must be under 5 MB'); return; }
    setAvatarUploading(true); setMsg(''); setErr('');
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const { data } = await api.post(`/users/${id}/avatar`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setProfile(prev => prev ? { ...prev, avatar_url: data.avatar_url } : prev);
      setMsg('Profile photo updated!');
    } catch (e: any) {
      setErr(e.response?.data?.error || 'Upload failed');
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    if (!profile?.avatar_url) return;
    setAvatarRemoving(true); setMsg(''); setErr('');
    try {
      await api.delete(`/users/${id}/avatar`);
      setProfile(prev => prev ? { ...prev, avatar_url: undefined } : prev);
      setMsg('Profile photo removed.');
    } catch (e: any) {
      setErr(e.response?.data?.error || 'Failed to remove photo');
    } finally { setAvatarRemoving(false); }
  };

  const userRoles: string[] = (profile as any)?.roles ?? (profile?.role ? [profile.role] : []);
  const expired = isExpired(profile?.membership_end);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <button onClick={() => navigate('/users')}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-6 text-sm transition-colors">
        <ArrowLeft size={16} /> Back to Members
      </button>

      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-6">
        <UserCircle size={26} className="text-blue-700" /> Edit Member Profile
      </h1>

      {msg && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 mb-4 text-sm">{msg}</div>}
      {err && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{err}</div>}

      {/* Member info summary + avatar management */}
      {profile && (
        <div className="card mb-6 flex items-start gap-5">

          {/* Avatar with upload overlay */}
          <div className="relative shrink-0 group">
            {/* Avatar circle */}
            <div className="w-20 h-20 rounded-full overflow-hidden bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-2xl border-2 border-white shadow-md">
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                : <span className="select-none">{profile.name.charAt(0).toUpperCase()}</span>}
            </div>

            {/* Camera overlay (shown on hover) */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
              title="Upload new photo"
              className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:cursor-wait">
              {avatarUploading
                ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Camera size={20} className="text-white" />}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          {/* Member details + photo action buttons */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-gray-900">{profile.name}</p>
              {userRoles.map(r => <span key={r} className={roleBadge[r] ?? 'badge-player'}>{r}</span>)}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{profile.email}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-gray-400">
              <span>Joined: {fmt(profile.created_at)}</span>
              <span>Membership start: {fmt(profile.membership_start)}</span>
              <span className={expired ? 'text-red-600 font-medium' : ''}>
                Expires: {fmt(profile.membership_end)} {expired && '⚠ Expired'}
              </span>
              <span>Last login: {formatLastLogin((profile as any).last_login)}</span>
            </div>

            {/* Photo action buttons */}
            <div className="flex gap-2 mt-3 flex-wrap">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50">
                <Upload size={13} />
                {avatarUploading ? 'Uploading…' : profile.avatar_url ? 'Change Photo' : 'Upload Photo'}
              </button>
              {profile.avatar_url && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={avatarRemoving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium rounded-lg border border-red-200 transition-colors disabled:opacity-50">
                  <Trash2 size={13} />
                  {avatarRemoving ? 'Removing…' : 'Remove Photo'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="card space-y-5">
        <h2 className="font-bold text-gray-900 flex items-center gap-2">
          <Shield size={18} className="text-blue-600" /> Edit Details
        </h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
          <input className="input-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input className="input-field" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+65 9000 0000" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
            <input type="date" className="input-field" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <textarea className="input-field" rows={3} value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="Player bio…" />
        </div>

        {/* Jersey & Kit */}
        <div className="border-t pt-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">🏏 Jersey & Kit</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jersey Number</label>
              <input className="input-field" placeholder="e.g. 7" value={form.jersey_number} onChange={e => setForm(f => ({ ...f, jersey_number: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jersey Label</label>
              <input className="input-field" placeholder="e.g. SMITH" value={form.jersey_label} onChange={e => setForm(f => ({ ...f, jersey_label: e.target.value }))} />
            </div>
          </div>
          {/* Whites */}
          <div className="bg-gray-50 rounded-lg p-3 mb-3">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">⚪ Whites</p>
            <div className="grid grid-cols-3 gap-2">
              {[['T-Shirt', 'whites_tshirt_size', TSHIRT_SIZES], ['Lower', 'whites_lower_size', LOWER_SIZES], ['Sleeve', 'whites_sleeve', SLEEVES]].map(([label, key, opts]) => (
                <div key={key as string}>
                  <label className="block text-xs text-gray-500 mb-1">{label as string}</label>
                  <select className="input-field text-sm" value={(form as any)[key as string]} onChange={e => setForm(f => ({ ...f, [key as string]: e.target.value }))}>
                    {(opts as string[]).map(s => <option key={s} value={s}>{s || '—'}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
          {/* Colored */}
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">🔵 Colored</p>
            <div className="grid grid-cols-3 gap-2">
              {[['T-Shirt', 'colored_tshirt_size', TSHIRT_SIZES], ['Lower', 'colored_lower_size', LOWER_SIZES], ['Sleeve', 'colored_sleeve', SLEEVES]].map(([label, key, opts]) => (
                <div key={key as string}>
                  <label className="block text-xs text-gray-500 mb-1">{label as string}</label>
                  <select className="input-field text-sm" value={(form as any)[key as string]} onChange={e => setForm(f => ({ ...f, [key as string]: e.target.value }))}>
                    {(opts as string[]).map(s => <option key={s} value={s}>{s || '—'}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Membership expiry */}
        <div className="border-t pt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Membership Expiry Date
            {expired && <span className="ml-2 text-xs text-red-600 font-normal">⚠ Currently expired</span>}
          </label>
          <input type="date" className={`input-field max-w-xs ${expired ? 'border-red-300' : ''}`}
            value={form.membership_end}
            onChange={e => setForm(f => ({ ...f, membership_end: e.target.value }))} />
          <p className="text-xs text-gray-400 mt-1">Changing this date will immediately restore or expire the member's access.</p>
        </div>

        <div className="pt-2 flex justify-end">
          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
            <Save size={16} /> {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

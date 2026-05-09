import { useEffect, useState, useRef, FormEvent } from 'react';
import api from '../utils/api';
import { useClub } from '../contexts/ClubContext';
import { Settings, Upload, Trash2, Plus, X, Save, Image, GalleryHorizontal, Edit2, Check } from 'lucide-react';

interface BannerImage { id: number; image_url: string; caption: string | null; sort_order: number; }

export default function AdminSettings() {
  const { refresh } = useClub();

  // ── Club settings form ──
  const [form, setForm] = useState({
    club_name: '', tagline: '', founded: '', description: '',
    contact_email: '', ground: '', achievements: [''] as string[],
  });
  const [logoUrl, setLogoUrl]       = useState<string | null>(null);
  const [saving, setSaving]         = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [msg, setMsg]               = useState('');
  const [err, setErr]               = useState('');
  const logoRef                     = useRef<HTMLInputElement>(null);

  // ── Banner state ──
  const [banners, setBanners]               = useState<BannerImage[]>([]);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [editingCaption, setEditingCaption] = useState<Record<number, string>>({});
  const [savingCaption, setSavingCaption]   = useState<number | null>(null);
  const bannerRef                           = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/settings').then(({ data }) => {
      setForm({
        club_name:     data.club_name     || '',
        tagline:       data.tagline       || '',
        founded:       data.founded       || '',
        description:   data.description   || '',
        contact_email: data.contact_email || '',
        ground:        data.ground        || '',
        achievements:  data.achievements?.length ? data.achievements : [''],
      });
      setLogoUrl(data.logo_url || null);
    });
    loadBanners();
  }, []);

  const loadBanners = () =>
    api.get('/settings/banners').then(({ data }) => setBanners(data));

  // ── Logo ──
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setMsg(''); setErr('');
    const fd = new FormData();
    fd.append('logo', file);
    try {
      const { data } = await api.post('/settings/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setLogoUrl(data.logo_url); refresh(); setMsg('Logo updated!');
    } catch (e: any) { setErr(e.response?.data?.error || 'Upload failed'); }
    finally { setUploading(false); if (logoRef.current) logoRef.current.value = ''; }
  };

  const handleRemoveLogo = async () => {
    if (!confirm('Remove the club logo?')) return;
    await api.delete('/settings/logo');
    setLogoUrl(null); refresh(); setMsg('Logo removed.');
  };

  // ── About save ──
  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true); setMsg(''); setErr('');
    try {
      await api.put('/settings', { ...form, achievements: form.achievements.filter(a => a.trim()) });
      refresh(); setMsg('Club settings saved successfully!');
    } catch (e: any) { setErr(e.response?.data?.error || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const updateAchievement = (i: number, val: string) =>
    setForm(f => { const a = [...f.achievements]; a[i] = val; return { ...f, achievements: a }; });
  const addAchievement    = () => setForm(f => ({ ...f, achievements: [...f.achievements, ''] }));
  const removeAchievement = (i: number) =>
    setForm(f => ({ ...f, achievements: f.achievements.filter((_, idx) => idx !== i) }));

  // ── Banners ──
  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setBannerUploading(true); setMsg(''); setErr('');
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append('banner', file);
        await api.post('/settings/banners', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      await loadBanners();
      setMsg(`${files.length} banner photo${files.length > 1 ? 's' : ''} uploaded!`);
    } catch (e: any) { setErr(e.response?.data?.error || 'Upload failed'); }
    finally { setBannerUploading(false); if (bannerRef.current) bannerRef.current.value = ''; }
  };

  const deleteBanner = async (id: number) => {
    if (!confirm('Delete this banner photo?')) return;
    await api.delete(`/settings/banners/${id}`);
    loadBanners();
  };

  const startEditCaption = (b: BannerImage) =>
    setEditingCaption(prev => ({ ...prev, [b.id]: b.caption || '' }));

  const saveCaption = async (b: BannerImage) => {
    setSavingCaption(b.id);
    await api.put(`/settings/banners/${b.id}`, { caption: editingCaption[b.id], sort_order: b.sort_order });
    await loadBanners();
    setEditingCaption(prev => { const n = { ...prev }; delete n[b.id]; return n; });
    setSavingCaption(null);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        <Settings size={26} className="text-blue-700" /> Club Settings
      </h1>

      {msg && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 text-sm">{msg}</div>}
      {err && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{err}</div>}

      {/* ── Logo ── */}
      <div className="card">
        <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Image size={18} className="text-blue-600" /> Club Logo
        </h2>
        <div className="flex items-center gap-6">
          <div className="flex-shrink-0">
            {logoUrl ? (
              <img src={logoUrl!} alt="Club logo"
                className="w-24 h-24 object-contain rounded-xl border border-gray-200 bg-gray-50 p-2" />
            ) : (
              <div className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center text-gray-400">
                <Image size={28} /><span className="text-xs mt-1">No logo</span>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm text-gray-500">PNG, JPG, SVG or WebP — max 2 MB.<br />Shown in navbar and About page.</p>
            <div className="flex gap-2">
              <button onClick={() => logoRef.current?.click()} disabled={uploading}
                className="btn-primary text-sm flex items-center gap-2 py-2">
                <Upload size={14} /> {uploading ? 'Uploading…' : 'Upload Logo'}
              </button>
              {logoUrl && (
                <button onClick={handleRemoveLogo} className="btn-danger text-sm flex items-center gap-2 py-2">
                  <Trash2 size={14} /> Remove
                </button>
              )}
            </div>
            <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          </div>
        </div>
      </div>

      {/* ── Banner Slider Photos ── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <GalleryHorizontal size={18} className="text-blue-600" /> Homepage Banner Photos
          </h2>
          <button onClick={() => bannerRef.current?.click()} disabled={bannerUploading}
            className="btn-primary text-sm flex items-center gap-2 py-2">
            <Upload size={14} /> {bannerUploading ? 'Uploading…' : 'Add Photos'}
          </button>
          <input ref={bannerRef} type="file" accept="image/*" multiple className="hidden" onChange={handleBannerUpload} />
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Photos cycle automatically on the public homepage. You can select multiple files at once. Max 5 MB each.
        </p>

        {banners.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 rounded-xl py-12 text-center text-gray-400">
            <GalleryHorizontal size={40} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">No banner photos yet. Click "Add Photos" to upload.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {banners.map((b, idx) => (
              <div key={b.id} className="relative group rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                <img src={b.image_url} alt={b.caption || `Banner ${idx + 1}`}
                  className="w-full h-36 object-cover" />

                {/* Overlay actions */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button onClick={() => startEditCaption(b)}
                    className="bg-white/90 hover:bg-white text-gray-800 p-2 rounded-lg" title="Edit caption">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => deleteBanner(b.id)}
                    className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Order badge */}
                <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                  #{idx + 1}
                </div>

                {/* Caption display / edit */}
                {editingCaption[b.id] !== undefined ? (
                  <div className="p-2 flex gap-1">
                    <input
                      autoFocus
                      className="input-field text-xs py-1 px-2 flex-1"
                      value={editingCaption[b.id]}
                      onChange={e => setEditingCaption(prev => ({ ...prev, [b.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') saveCaption(b); if (e.key === 'Escape') setEditingCaption(prev => { const n = { ...prev }; delete n[b.id]; return n; }); }}
                      placeholder="Add caption…"
                    />
                    <button onClick={() => saveCaption(b)} disabled={savingCaption === b.id}
                      className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg flex-shrink-0">
                      <Check size={13} />
                    </button>
                    <button onClick={() => setEditingCaption(prev => { const n = { ...prev }; delete n[b.id]; return n; })}
                      className="p-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg flex-shrink-0">
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <div className="px-2 py-1.5 min-h-[2rem]">
                    {b.caption
                      ? <p className="text-xs text-gray-600 truncate">{b.caption}</p>
                      : <p className="text-xs text-gray-400 italic">No caption</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── About page content ── */}
      <form onSubmit={handleSave} className="card space-y-5">
        <h2 className="font-bold text-gray-900 flex items-center gap-2">
          <Settings size={18} className="text-blue-600" /> About Page Content
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Club Name *</label>
            <input className="input-field" value={form.club_name}
              onChange={e => setForm(f => ({ ...f, club_name: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Founded Year</label>
            <input className="input-field" value={form.founded} placeholder="e.g. 2018"
              onChange={e => setForm(f => ({ ...f, founded: e.target.value }))} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tagline</label>
          <input className="input-field" value={form.tagline} placeholder="e.g. Play Hard. Fly High."
            onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea className="input-field" rows={4} value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Tell visitors about the club…" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
            <input type="email" className="input-field" value={form.contact_email}
              onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ground / Venue</label>
            <input className="input-field" value={form.ground}
              onChange={e => setForm(f => ({ ...f, ground: e.target.value }))} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">Achievements</label>
            <button type="button" onClick={addAchievement}
              className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1">
              <Plus size={14} /> Add
            </button>
          </div>
          <div className="space-y-2">
            {form.achievements.map((a, i) => (
              <div key={i} className="flex gap-2">
                <input className="input-field" value={a} placeholder={`Achievement ${i + 1}`}
                  onChange={e => updateAchievement(i, e.target.value)} />
                <button type="button" onClick={() => removeAchievement(i)}
                  className="p-2 text-gray-400 hover:text-red-500 flex-shrink-0"><X size={16} /></button>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2">
          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
            <Save size={16} /> {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}

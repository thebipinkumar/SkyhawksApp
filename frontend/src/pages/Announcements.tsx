import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Announcement, BroadcastMember } from '../types';
import {
  Megaphone, Calendar, User, Send, X, CheckSquare, Square,
  UserCircle, Bell, BellOff, Settings, ChevronDown, ChevronUp,
  Trash2, ImagePlus, ImageOff,
} from 'lucide-react';

type Tab = 'announcements' | 'compose' | 'broadcast';
interface ReceiverMember { id: number; name: string; email: string; avatar_url?: string | null; }

/** Items older than this are "archived" (hidden from players by default) */
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export default function Announcements() {
  const { user } = useAuth();
  const userRoles: string[] = (user as any)?.roles ?? (user?.role ? [user.role] : []);
  const canCompose  = userRoles.some(r => ['selector', 'manager', 'admin'].includes(r));
  const canDelete   = userRoles.some(r => ['manager', 'admin'].includes(r));
  const isAdmin     = userRoles.includes('admin');
  const canSeeOld   = userRoles.some(r => ['selector', 'manager', 'admin'].includes(r));

  // ── Core state ─────────────────────────────────────────────────────────────
  const [tab, setTab]                           = useState<Tab>('announcements');
  const [announcements, setAnnouncements]       = useState<Announcement[]>([]);
  const [broadcastMembers, setBroadcastMembers] = useState<BroadcastMember[]>([]);
  const [receiverMembers, setReceiverMembers]   = useState<ReceiverMember[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [saving, setSaving]                     = useState(false);
  const [error, setError]                       = useState('');
  const [success, setSuccess]                   = useState('');
  const [previewExpanded, setPreviewExpanded]   = useState<number | null>(null);
  const [showOlderSection, setShowOlderSection] = useState(false);
  const [confirmDelete, setConfirmDelete]       = useState<{ type: 'team_selection' | 'custom'; id: number } | null>(null);
  const [deleting, setDeleting]                 = useState(false);

  // Compose form
  const [subject, setSubject]             = useState('');
  const [content, setContent]             = useState('');
  const [sendToAll, setSendToAll]         = useState(true);
  const [selectedIds, setSelectedIds]     = useState<Set<number>>(new Set());
  const [searchQ, setSearchQ]             = useState('');
  const [imageFile, setImageFile]         = useState<File | null>(null);
  const [imagePreview, setImagePreview]   = useState<string | null>(null);
  const [imagePosition, setImagePosition] = useState<'above' | 'below'>('below');
  const fileInputRef                      = useRef<HTMLInputElement>(null);

  const notify = (msg: string, isErr = false) => {
    if (isErr) setError(msg); else setSuccess(msg);
    setTimeout(() => { setError(''); setSuccess(''); }, 4000);
  };

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadAnnouncements = async () => {
    setLoading(true);
    try {
      const res = await api.get('/announcements');
      setAnnouncements(res.data);
    } catch { /* non-critical */ } finally {
      setLoading(false);
    }
  };

  const loadReceiverMembers = async () => {
    if (!canCompose || receiverMembers.length > 0) return;
    try { const res = await api.get('/announcements/members'); setReceiverMembers(res.data); } catch { /* ignore */ }
  };

  const loadBroadcastSettings = async () => {
    if (!isAdmin) return;
    try { const res = await api.get('/announcements/broadcast-settings'); setBroadcastMembers(res.data); } catch { /* ignore */ }
  };

  useEffect(() => { loadAnnouncements(); }, []);
  useEffect(() => {
    if (tab === 'compose')   loadReceiverMembers();
    if (tab === 'broadcast') loadBroadcastSettings();
  }, [tab]);

  // ── Age split ─────────────────────────────────────────────────────────────
  const cutoff = Date.now() - ONE_MONTH_MS;
  const recentAnnouncements = announcements.filter(a => new Date(a.sent_at).getTime() >= cutoff);
  const olderAnnouncements  = announcements.filter(a => new Date(a.sent_at).getTime() < cutoff);

  // ── Image handling ────────────────────────────────────────────────────────
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { notify('Image must be under 5 MB', true); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Send announcement ─────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!subject.trim()) { notify('Subject is required', true); return; }
    if (!content.trim()) { notify('Content is required', true);  return; }
    if (!sendToAll && selectedIds.size === 0) {
      notify('Select at least one recipient or choose "All Members"', true); return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('subject', subject.trim());
      fd.append('content', content.trim());
      fd.append('recipient_ids', sendToAll ? 'all' : JSON.stringify(Array.from(selectedIds)));
      if (imageFile) {
        fd.append('image', imageFile);
        fd.append('image_position', imagePosition);
      }
      const res = await api.post('/announcements', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      notify(res.data.message || 'Announcement sent!');
      setSubject(''); setContent(''); setSendToAll(true); setSelectedIds(new Set()); removeImage();
      setTab('announcements');
      loadAnnouncements();
    } catch (e: any) {
      notify(e.response?.data?.error || 'Failed to send announcement', true);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete announcement ───────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const endpoint = confirmDelete.type === 'team_selection'
        ? `/announcements/team/${confirmDelete.id}`
        : `/announcements/custom/${confirmDelete.id}`;
      await api.delete(endpoint);
      setAnnouncements(prev => prev.filter(a => !(a.id === confirmDelete.id && a.type === confirmDelete.type)));
      setConfirmDelete(null);
      notify('Announcement deleted.');
    } catch (e: any) {
      notify(e.response?.data?.error || 'Failed to delete', true);
    } finally {
      setDeleting(false);
    }
  };

  // ── Toggle broadcast ──────────────────────────────────────────────────────
  const handleToggleBroadcast = async (memberId: number, current: number) => {
    const newVal = current === 1 ? 0 : 1;
    try {
      await api.patch(`/announcements/broadcast-settings/${memberId}`, { broadcast_email: newVal });
      setBroadcastMembers(prev => prev.map(m => m.id === memberId ? { ...m, broadcast_email: newVal } : m));
    } catch (e: any) {
      notify(e.response?.data?.error || 'Failed to update', true);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const toggleMember = (id: number) =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const filteredMembers = receiverMembers.filter(m =>
    m.name.toLowerCase().includes(searchQ.toLowerCase()) ||
    m.email.toLowerCase().includes(searchQ.toLowerCase())
  );

  const broadcastEnabled  = broadcastMembers.filter(m => m.broadcast_email === 1).length;
  const broadcastDisabled = broadcastMembers.filter(m => m.broadcast_email === 0).length;

  // ── Announcement card renderer ────────────────────────────────────────────
  const AnnouncementCard = ({ ann, idx }: { ann: Announcement; idx: number }) => {
    const isTeam = ann.type === 'team_selection';
    const isOpen = previewExpanded === idx;
    const isConfirming = confirmDelete?.type === ann.type && confirmDelete?.id === ann.id;
    const hasImage = !isTeam && ann.image_url;

    return (
      <div className={`card hover:shadow-md transition-shadow border-l-4 ${isTeam ? 'border-green-500' : 'border-purple-500'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Badge row */}
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isTeam ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                {isTeam ? '🏏 Team Selection' : '📢 Broadcast'}
              </span>
              {!isTeam && ann.recipient_count != null && (
                <span className="text-xs text-gray-400">Sent to {ann.recipient_count} member{ann.recipient_count !== 1 ? 's' : ''}</span>
              )}
            </div>

            {/* Subject */}
            <h3 className="font-bold text-gray-900 text-base leading-snug">{ann.subject}</h3>
            {isTeam && ann.opponent && (
              <p className="text-blue-700 font-medium text-sm mt-0.5">vs {ann.opponent}</p>
            )}

            {/* Embedded image — above content */}
            {hasImage && ann.image_position === 'above' && (
              <div className="mt-3 mb-2">
                <img src={ann.image_url!} alt="Announcement" className="max-w-full rounded-xl object-contain max-h-72" />
              </div>
            )}

            {/* Content */}
            {!isTeam ? (
              <div className="mt-2">
                <p className={`text-gray-600 text-sm whitespace-pre-line ${isOpen ? '' : 'line-clamp-2'}`}>
                  {ann.content}
                </p>
                {ann.content.length > 120 && (
                  <button onClick={() => setPreviewExpanded(isOpen ? null : idx)}
                    className="mt-1 text-xs text-purple-600 hover:underline flex items-center gap-0.5">
                    {isOpen ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Read more</>}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-gray-600 mt-1 text-sm">{ann.content}</p>
            )}

            {/* Embedded image — below content */}
            {hasImage && ann.image_position !== 'above' && (
              <div className="mt-3">
                <img src={ann.image_url!} alt="Announcement" className="max-w-full rounded-xl object-contain max-h-72" />
              </div>
            )}

            {/* Meta */}
            <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-400">
              <span className="flex items-center gap-1"><User size={12} /> {ann.sent_by_name}</span>
              <span className="flex items-center gap-1"><Calendar size={12} /> {formatDate(ann.sent_at)}</span>
            </div>
          </div>

          {/* Right column: published badge + delete */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${isTeam ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
              Published
            </span>
            {canDelete && (
              isConfirming ? (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500 mr-1">Delete?</span>
                  <button onClick={handleDelete} disabled={deleting}
                    className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50">
                    {deleting ? '…' : 'Yes'}
                  </button>
                  <button onClick={() => setConfirmDelete(null)}
                    className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg">
                    No
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete({ type: ann.type, id: ann.id })}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                  title="Delete announcement">
                  <Trash2 size={15} />
                </button>
              )
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Megaphone size={26} className="text-green-600" /> Announcements
        </h1>
        <div className="flex gap-2 flex-wrap">
          {canCompose && (
            <button onClick={() => setTab(tab === 'compose' ? 'announcements' : 'compose')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'compose' ? 'bg-purple-700 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}>
              <Send size={15} /> New Broadcast
            </button>
          )}
          {isAdmin && (
            <button onClick={() => setTab(tab === 'broadcast' ? 'announcements' : 'broadcast')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'broadcast' ? 'bg-gray-800 text-white' : 'bg-gray-600 hover:bg-gray-700 text-white'}`}>
              <Settings size={15} /> Broadcast Settings
            </button>
          )}
        </div>
      </div>

      {/* Toast */}
      {error   && <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-700 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-300 text-green-700 rounded-lg text-sm">{success}</div>}

      {/* ═══ COMPOSE TAB ═══ */}
      {tab === 'compose' && (
        <div className="card mb-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Send size={18} className="text-purple-600" /> Compose Announcement
            </h2>
            <button onClick={() => setTab('announcements')} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X size={18} /></button>
          </div>

          <div className="space-y-4">
            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                placeholder="e.g. Training Session Cancelled This Saturday"
                className="input-field" maxLength={200} />
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
              <textarea value={content} onChange={e => setContent(e.target.value)}
                placeholder="Write your announcement here…"
                className="input-field min-h-[140px] resize-y" maxLength={4000} />
              <p className="text-xs text-gray-400 mt-1">{content.length}/4000 characters</p>
            </div>

            {/* Image attachment */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Attach Image <span className="text-gray-400 font-normal">(optional — embedded in email)</span>
              </label>

              {imagePreview ? (
                <div className="relative inline-block">
                  <img src={imagePreview} alt="preview" className="max-h-48 rounded-xl object-contain border border-gray-200" />
                  <button onClick={removeImage}
                    className="absolute -top-2 -right-2 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-md"
                    title="Remove image">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 hover:border-purple-400 rounded-xl text-sm text-gray-500 hover:text-purple-600 transition-colors">
                  <ImagePlus size={18} /> Click to attach image (max 5 MB)
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />

              {/* Image position */}
              {imageFile && (
                <div className="mt-3 flex items-center gap-4">
                  <span className="text-sm font-medium text-gray-700">Image position:</span>
                  {(['above', 'below'] as const).map(pos => (
                    <label key={pos} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="img_pos" value={pos}
                        checked={imagePosition === pos} onChange={() => setImagePosition(pos)}
                        className="accent-purple-600" />
                      <span className="text-sm capitalize text-gray-700">
                        {pos === 'above' ? '⬆ Above message' : '⬇ Below message'}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Recipients */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Recipients</label>
              <button onClick={() => { setSendToAll(!sendToAll); setSelectedIds(new Set()); }}
                className={`flex items-center gap-2 w-full px-4 py-3 rounded-xl border-2 text-left mb-3 transition-colors ${sendToAll ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                {sendToAll ? <CheckSquare size={18} className="text-purple-600 shrink-0" /> : <Square size={18} className="text-gray-400 shrink-0" />}
                <div>
                  <p className="font-medium text-sm text-gray-900">Send to All Members</p>
                  <p className="text-xs text-gray-500">Broadcast to every active member with email notifications enabled</p>
                </div>
              </button>

              {!sendToAll && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="p-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                    <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)}
                      placeholder="Search members…" className="input-field !py-1.5 text-sm flex-1" />
                    <span className="text-xs text-gray-500 whitespace-nowrap shrink-0">{selectedIds.size} selected</span>
                  </div>
                  <div className="max-h-52 overflow-y-auto divide-y divide-gray-100">
                    {filteredMembers.length === 0 ? (
                      <p className="text-center text-gray-400 text-sm py-6">No members found</p>
                    ) : filteredMembers.map(m => {
                      const checked = selectedIds.has(m.id);
                      return (
                        <button key={m.id} onClick={() => toggleMember(m.id)}
                          className={`flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors ${checked ? 'bg-purple-50' : ''}`}>
                          {checked ? <CheckSquare size={16} className="text-purple-600 shrink-0" /> : <Square size={16} className="text-gray-300 shrink-0" />}
                          {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" /> : <UserCircle size={24} className="text-gray-400 shrink-0" />}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{m.name}</p>
                            <p className="text-xs text-gray-400 truncate">{m.email}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {selectedIds.size > 0 && (
                    <div className="p-2 bg-gray-50 border-t border-gray-200 flex justify-end">
                      <button onClick={() => setSelectedIds(new Set())} className="text-xs text-red-500 hover:underline">Clear selection</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Send button */}
            <div className="flex items-center justify-between pt-2 flex-wrap gap-3">
              <p className="text-xs text-gray-400">Members with email notifications disabled won't receive this broadcast.</p>
              <button onClick={handleSend} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 text-sm">
                <Send size={15} /> {saving ? 'Sending…' : 'Send Announcement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ BROADCAST SETTINGS TAB ═══ */}
      {tab === 'broadcast' && isAdmin && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Settings size={18} className="text-gray-700" /> Broadcast Settings
            </h2>
            <button onClick={() => setTab('announcements')} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X size={18} /></button>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Manage which members receive email broadcasts. Disabled members won't get any announcement emails.
          </p>
          <div className="flex flex-wrap gap-3 mb-4">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-100 text-green-800 text-sm font-medium">
              <Bell size={14} /> {broadcastEnabled} Enabled
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-sm font-medium">
              <BellOff size={14} /> {broadcastDisabled} Disabled
            </span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Member</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Email</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Notifications</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {broadcastMembers.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" /> : <UserCircle size={28} className="text-gray-400 shrink-0" />}
                        <span className="font-medium text-gray-800">{m.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden sm:table-cell">{m.email}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleToggleBroadcast(m.id, m.broadcast_email)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${m.broadcast_email === 1 ? 'bg-green-100 text-green-800 hover:bg-red-100 hover:text-red-700' : 'bg-gray-100 text-gray-500 hover:bg-green-100 hover:text-green-700'}`}>
                        {m.broadcast_email === 1 ? <><Bell size={12} /> Enabled</> : <><BellOff size={12} /> Disabled</>}
                      </button>
                    </td>
                  </tr>
                ))}
                {broadcastMembers.length === 0 && (
                  <tr><td colSpan={3} className="text-center text-gray-400 py-10">No active members found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ ANNOUNCEMENTS LIST ═══ */}
      {tab === 'announcements' && (
        loading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : announcements.length === 0 ? (
          <div className="card text-center py-16 text-gray-400">
            <Megaphone size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-lg">No announcements yet</p>
            <p className="text-sm mt-1">Team announcements and club broadcasts will appear here.</p>
          </div>
        ) : (
          <>
            {/* Recent announcements */}
            {recentAnnouncements.length === 0 && (
              <div className="card text-center py-10 text-gray-400 mb-4">
                <Megaphone size={36} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No announcements in the past month.</p>
              </div>
            )}

            <div className="space-y-4">
              {recentAnnouncements.map((ann, idx) => (
                <AnnouncementCard key={`${ann.type}-${ann.id}`} ann={ann} idx={idx} />
              ))}
            </div>

            {/* Older announcements section */}
            {olderAnnouncements.length > 0 && (
              <div className="mt-6">
                {canSeeOld ? (
                  <>
                    <button
                      onClick={() => setShowOlderSection(v => !v)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors text-sm font-medium text-gray-600">
                      <span className="flex items-center gap-2">
                        <ImageOff size={15} className="text-gray-400" />
                        {showOlderSection ? 'Hide' : 'Show'} older announcements ({olderAnnouncements.length})
                      </span>
                      {showOlderSection ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {showOlderSection && (
                      <div className="space-y-4 mt-4">
                        {olderAnnouncements.map((ann, idx) => (
                          <AnnouncementCard key={`${ann.type}-${ann.id}`} ann={ann} idx={recentAnnouncements.length + idx} />
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  // Players see a subtle info line but no expand option
                  <p className="text-center text-xs text-gray-400 mt-4 py-3 border border-dashed border-gray-200 rounded-xl">
                    {olderAnnouncements.length} older announcement{olderAnnouncements.length !== 1 ? 's' : ''} not shown
                  </p>
                )}
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}

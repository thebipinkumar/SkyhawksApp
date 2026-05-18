import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Announcement, BroadcastMember } from '../types';
import {
  Megaphone, Calendar, User, Send, X, CheckSquare, Square,
  UserCircle, Bell, BellOff, Settings, ChevronDown, ChevronUp,
} from 'lucide-react';

type Tab = 'announcements' | 'compose' | 'broadcast';
interface ReceiverMember { id: number; name: string; email: string; avatar_url?: string | null; }

export default function Announcements() {
  const { user } = useAuth();
  const userRoles: string[] = (user as any)?.roles ?? (user?.role ? [user.role] : []);
  const canCompose = userRoles.some(r => ['selector', 'manager', 'admin'].includes(r));
  const isAdmin    = userRoles.includes('admin');

  // ── State ──────────────────────────────────────────────────────────────────
  const [tab, setTab]                           = useState<Tab>('announcements');
  const [announcements, setAnnouncements]       = useState<Announcement[]>([]);
  const [broadcastMembers, setBroadcastMembers] = useState<BroadcastMember[]>([]);
  const [receiverMembers, setReceiverMembers]   = useState<ReceiverMember[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [saving, setSaving]                     = useState(false);
  const [error, setError]                       = useState('');
  const [success, setSuccess]                   = useState('');
  const [previewExpanded, setPreviewExpanded]   = useState<number | null>(null);

  // Compose form
  const [subject, setSubject]         = useState('');
  const [content, setContent]         = useState('');
  const [sendToAll, setSendToAll]     = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [searchQ, setSearchQ]         = useState('');

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
    try {
      const res = await api.get('/announcements/members');
      setReceiverMembers(res.data);
    } catch { /* ignore */ }
  };

  const loadBroadcastSettings = async () => {
    if (!isAdmin) return;
    try {
      const res = await api.get('/announcements/broadcast-settings');
      setBroadcastMembers(res.data);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadAnnouncements(); }, []);
  useEffect(() => {
    if (tab === 'compose')   loadReceiverMembers();
    if (tab === 'broadcast') loadBroadcastSettings();
  }, [tab]);

  // ── Send announcement ─────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!subject.trim()) { notify('Subject is required', true); return; }
    if (!content.trim()) { notify('Content is required', true);  return; }
    if (!sendToAll && selectedIds.size === 0) {
      notify('Select at least one recipient or choose "All Members"', true); return;
    }
    setSaving(true);
    try {
      const res = await api.post('/announcements', {
        subject: subject.trim(),
        content: content.trim(),
        recipient_ids: sendToAll ? 'all' : Array.from(selectedIds),
      });
      notify(res.data.message || 'Announcement sent!');
      setSubject('');
      setContent('');
      setSendToAll(true);
      setSelectedIds(new Set());
      setTab('announcements');
      loadAnnouncements();
    } catch (e: any) {
      notify(e.response?.data?.error || 'Failed to send announcement', true);
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle broadcast flag ─────────────────────────────────────────────────
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
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === 'compose' ? 'bg-purple-700 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}>
              <Send size={15} /> New Broadcast
            </button>
          )}
          {isAdmin && (
            <button onClick={() => setTab(tab === 'broadcast' ? 'announcements' : 'broadcast')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === 'broadcast' ? 'bg-gray-800 text-white' : 'bg-gray-600 hover:bg-gray-700 text-white'
              }`}>
              <Settings size={15} /> Broadcast Settings
            </button>
          )}
        </div>
      </div>

      {/* Toast messages */}
      {error   && <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-700 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-300 text-green-700 rounded-lg text-sm">{success}</div>}

      {/* ═══ COMPOSE TAB ═══ */}
      {tab === 'compose' && (
        <div className="card mb-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Send size={18} className="text-purple-600" /> Compose Announcement
            </h2>
            <button onClick={() => setTab('announcements')} className="p-1 rounded hover:bg-gray-100 text-gray-400">
              <X size={18} />
            </button>
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

            {/* Receivers */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Recipients</label>

              {/* All Members toggle */}
              <button onClick={() => { setSendToAll(!sendToAll); setSelectedIds(new Set()); }}
                className={`flex items-center gap-2 w-full px-4 py-3 rounded-xl border-2 text-left mb-3 transition-colors ${
                  sendToAll ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}>
                {sendToAll
                  ? <CheckSquare size={18} className="text-purple-600 shrink-0" />
                  : <Square size={18} className="text-gray-400 shrink-0" />}
                <div>
                  <p className="font-medium text-sm text-gray-900">Send to All Members</p>
                  <p className="text-xs text-gray-500">Broadcast to every active member with email notifications enabled</p>
                </div>
              </button>

              {/* Individual member picker */}
              {!sendToAll && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="p-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                    <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)}
                      placeholder="Search members…" className="input-field !py-1.5 text-sm flex-1" />
                    <span className="text-xs text-gray-500 whitespace-nowrap shrink-0">
                      {selectedIds.size} selected
                    </span>
                  </div>
                  <div className="max-h-52 overflow-y-auto divide-y divide-gray-100">
                    {filteredMembers.length === 0 ? (
                      <p className="text-center text-gray-400 text-sm py-6">No members found</p>
                    ) : filteredMembers.map(m => {
                      const checked = selectedIds.has(m.id);
                      return (
                        <button key={m.id} onClick={() => toggleMember(m.id)}
                          className={`flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors ${checked ? 'bg-purple-50' : ''}`}>
                          {checked
                            ? <CheckSquare size={16} className="text-purple-600 shrink-0" />
                            : <Square size={16} className="text-gray-300 shrink-0" />}
                          {m.avatar_url
                            ? <img src={m.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                            : <UserCircle size={24} className="text-gray-400 shrink-0" />}
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
                      <button onClick={() => setSelectedIds(new Set())} className="text-xs text-red-500 hover:underline">
                        Clear selection
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 flex-wrap gap-3">
              <p className="text-xs text-gray-400">
                Members with email notifications disabled will not receive this broadcast.
              </p>
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
            <button onClick={() => setTab('announcements')} className="p-1 rounded hover:bg-gray-100 text-gray-400">
              <X size={18} />
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Manage which members receive email broadcasts. Disabling a member here prevents them
            from receiving any email announcements.
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
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Email Notifications</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {broadcastMembers.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {m.avatar_url
                          ? <img src={m.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                          : <UserCircle size={28} className="text-gray-400 shrink-0" />}
                        <span className="font-medium text-gray-800">{m.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden sm:table-cell">{m.email}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleToggleBroadcast(m.id, m.broadcast_email)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                          m.broadcast_email === 1
                            ? 'bg-green-100 text-green-800 hover:bg-red-100 hover:text-red-700'
                            : 'bg-gray-100 text-gray-500 hover:bg-green-100 hover:text-green-700'
                        }`}>
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
          <div className="space-y-4">
            {announcements.map((ann, idx) => {
              const isTeam = ann.type === 'team_selection';
              const isOpen = previewExpanded === idx;
              return (
                <div key={`${ann.type}-${ann.id}-${idx}`}
                  className={`card hover:shadow-md transition-shadow border-l-4 ${isTeam ? 'border-green-500' : 'border-purple-500'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Type badge + recipient count */}
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isTeam ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                          {isTeam ? '🏏 Team Selection' : '📢 Broadcast'}
                        </span>
                        {!isTeam && ann.recipient_count != null && (
                          <span className="text-xs text-gray-400">
                            Sent to {ann.recipient_count} member{ann.recipient_count !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      {/* Subject */}
                      <h3 className="font-bold text-gray-900 text-base leading-snug">{ann.subject}</h3>
                      {isTeam && ann.opponent && (
                        <p className="text-blue-700 font-medium text-sm mt-0.5">vs {ann.opponent}</p>
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

                      {/* Meta */}
                      <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><User size={12} /> {ann.sent_by_name}</span>
                        <span className="flex items-center gap-1"><Calendar size={12} /> {formatDate(ann.sent_at)}</span>
                      </div>
                    </div>

                    <span className={`shrink-0 text-xs font-semibold px-3 py-1 rounded-full ${isTeam ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                      Published
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

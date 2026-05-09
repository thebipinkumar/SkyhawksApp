import { useEffect, useState, FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Match, AvailabilityRecord, AvailabilityStatus } from '../types';
import { Calendar, Plus, X, Edit2, Trash2, MapPin, Clock, ChevronDown, ChevronUp, CheckCircle, XCircle, HelpCircle, MinusCircle } from 'lucide-react';

const MATCH_TYPES = ['T20', 'T25', 'T30'];
const STATUS_OPTIONS = ['scheduled', 'completed', 'cancelled'];
const BALL_TYPES = ['Red', 'White'];
const ATTIRE_OPTIONS = ['White', 'Colored'];

const emptyForm = {
  title: '', opponent: '', venue: '', match_date: '', match_time: '',
  match_type: 'T20', status: 'scheduled', result: '', notes: '',
  ball_type: 'White', attire: 'Colored', match_fee: ''
};

const availabilityConfig: Record<AvailabilityStatus, { label: string; color: string; icon: React.ReactNode }> = {
  available:     { label: 'Available',     color: 'bg-green-100 text-green-700 border-green-300',  icon: <CheckCircle size={14} /> },
  maybe:         { label: 'Maybe',         color: 'bg-yellow-100 text-yellow-700 border-yellow-300', icon: <HelpCircle size={14} /> },
  not_available: { label: 'Not Available', color: 'bg-red-100 text-red-700 border-red-300',        icon: <XCircle size={14} /> },
  not_responded: { label: 'Not Responded', color: 'bg-gray-100 text-gray-500 border-gray-200',     icon: <MinusCircle size={14} /> },
};

export default function Matches() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editMatch, setEditMatch] = useState<Match | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  // Availability state
  const [availability, setAvailability] = useState<Record<number, AvailabilityRecord[]>>({});
  const [myStatus, setMyStatus] = useState<Record<number, AvailabilityStatus>>({});
  const [expandedAvail, setExpandedAvail] = useState<Record<number, boolean>>({});
  const [updatingAvail, setUpdatingAvail] = useState<number | null>(null);

  const userRoles: string[] = user?.roles ?? (user?.role ? [user.role] : []);
  const canManage  = userRoles.some(r => ['manager', 'admin'].includes(r));
  const canSeeAll  = userRoles.some(r => ['manager', 'admin', 'selector'].includes(r));
  const isPlayer   = userRoles.includes('player');

  const load = async () => {
    try { const { data } = await api.get('/matches'); setMatches(data); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const loadAvailability = async (matchId: number) => {
    const { data } = await api.get(`/matches/${matchId}/availability`);
    setAvailability(prev => ({ ...prev, [matchId]: data }));
    if (user) {
      const mine = data.find((r: AvailabilityRecord) => r.player_id === user.id);
      setMyStatus(prev => ({ ...prev, [matchId]: mine?.status || 'not_responded' }));
    }
  };

  useEffect(() => {
    if (matches.length > 0) matches.forEach(m => loadAvailability(m.id));
  }, [matches]);

  const setAvail = async (matchId: number, status: AvailabilityStatus) => {
    if (status === 'not_responded') return;
    setUpdatingAvail(matchId);
    try {
      await api.put(`/matches/${matchId}/availability`, { status });
      setMyStatus(prev => ({ ...prev, [matchId]: status }));
      loadAvailability(matchId);
    } finally { setUpdatingAvail(null); }
  };

  const openCreate = () => { setForm(emptyForm); setEditMatch(null); setShowForm(true); setError(''); };
  const openEdit = (m: Match) => {
    setForm({ title: m.title, opponent: m.opponent, venue: m.venue, match_date: m.match_date,
      match_time: m.match_time, match_type: m.match_type, status: m.status, result: m.result || '', notes: m.notes || '',
      ball_type: m.ball_type || 'White', attire: m.attire || 'Colored', match_fee: m.match_fee != null ? String(m.match_fee) : '' });
    setEditMatch(m); setShowForm(true); setError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setSubmitting(true); setError('');
    try {
      const payload = { ...form, match_fee: form.match_fee !== '' ? Number(form.match_fee) : null };
      editMatch ? await api.put(`/matches/${editMatch.id}`, payload) : await api.post('/matches', payload);
      setShowForm(false); load();
    } catch (err: any) { setError(err.response?.data?.error || 'Failed to save match'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this match?')) return;
    try { await api.delete(`/matches/${id}`); load(); }
    catch (err: any) { alert(err.response?.data?.error || 'Failed to delete match.'); }
  };

  const filtered = filter === 'all' ? matches : matches.filter(m => m.status === filter);
  const statusColor: Record<string, string> = {
    scheduled: 'bg-blue-100 text-blue-700', completed: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-600',
  };
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  const availSummary = (recs: AvailabilityRecord[]) => ({
    available:     recs.filter(r => r.status === 'available').length,
    maybe:         recs.filter(r => r.status === 'maybe').length,
    not_available: recs.filter(r => r.status === 'not_available').length,
    not_responded: recs.filter(r => r.status === 'not_responded').length,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar size={26} className="text-blue-700" /> Match Schedule
          </h1>
          <p className="text-gray-500 text-sm mt-1">{matches.length} total matches</p>
        </div>
        {canManage && (
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus size={18} /> Schedule Match
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {['all', 'scheduled', 'completed', 'cancelled'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === f ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4">{[1,2,3].map(i => <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <Calendar size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg">No matches found</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map(match => {
            const recs  = availability[match.id] || [];
            const summ  = availSummary(recs);
            const mine  = myStatus[match.id] || 'not_responded';
            const cfg   = availabilityConfig[mine];
            const isExp = expandedAvail[match.id];

            return (
              <div key={match.id} className="card hover:shadow-md transition-shadow">
                {/* Match info row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-lg font-bold text-gray-900">{match.title}</h3>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${statusColor[match.status]}`}>{match.status}</span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600">{match.match_type}</span>
                    </div>
                    <p className="text-gray-700 font-medium">vs <span className="text-blue-700">{match.opponent}</span></p>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
                      <span className="flex items-center gap-1"><MapPin size={14} />{match.venue}</span>
                      <span className="flex items-center gap-1"><Calendar size={14} />{formatDate(match.match_date)}</span>
                      <span className="flex items-center gap-1"><Clock size={14} />{match.match_time}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {match.ball_type && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${match.ball_type === 'Red' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                          🏏 {match.ball_type} Ball
                        </span>
                      )}
                      {match.attire && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">
                          👕 {match.attire} Attire
                        </span>
                      )}
                      {match.match_fee != null && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 font-medium">
                          💰 Fee: £{match.match_fee}
                        </span>
                      )}
                    </div>
                    {match.result && <p className="mt-2 text-sm text-green-700 font-medium">Result: {match.result}</p>}
                    {match.notes && <p className="mt-1 text-sm text-gray-500 italic">{match.notes}</p>}
                  </div>
                  {canManage && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => openEdit(match)} className="btn-secondary flex items-center gap-1 text-sm py-1.5 px-3">
                        <Edit2 size={14} /> Edit
                      </button>
                      {userRoles.includes('admin') && (
                        <button onClick={() => handleDelete(match.id)} className="btn-danger flex items-center gap-1 text-sm py-1.5 px-3">
                          <Trash2 size={14} /> Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Availability section */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  {/* Player: mark own availability */}
                  {isPlayer && (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm font-medium text-gray-600">Your availability:</span>
                      <div className="flex gap-2">
                        {(['available', 'maybe', 'not_available'] as AvailabilityStatus[]).map(s => (
                          <button key={s} disabled={updatingAvail === match.id}
                            onClick={() => setAvail(match.id, s)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${mine === s ? availabilityConfig[s].color + ' font-semibold ring-2 ring-offset-1 ring-current' : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'}`}>
                            {availabilityConfig[s].icon} {availabilityConfig[s].label}
                          </button>
                        ))}
                      </div>
                      {mine === 'not_responded' && <span className="text-xs text-gray-400 italic">Not responded yet</span>}
                    </div>
                  )}

                  {/* Staff: see availability summary + toggle detail */}
                  {canSeeAll && recs.length > 0 && (
                    <div>
                      <div className="flex flex-wrap items-center gap-4">
                        <span className="text-sm font-medium text-gray-600">Player Availability:</span>
                        <div className="flex gap-3 text-xs flex-wrap">
                          <span className="flex items-center gap-1 text-green-700"><CheckCircle size={13} /> {summ.available} Available</span>
                          <span className="flex items-center gap-1 text-yellow-700"><HelpCircle size={13} /> {summ.maybe} Maybe</span>
                          <span className="flex items-center gap-1 text-red-600"><XCircle size={13} /> {summ.not_available} Unavailable</span>
                          <span className="flex items-center gap-1 text-gray-400"><MinusCircle size={13} /> {summ.not_responded} Not Responded</span>
                        </div>
                        <button onClick={() => setExpandedAvail(prev => ({ ...prev, [match.id]: !isExp }))}
                          className="ml-auto flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                          {isExp ? <><ChevronUp size={14} /> Hide</> : <><ChevronDown size={14} /> View All</>}
                        </button>
                      </div>

                      {isExp && (
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {recs.map(r => {
                            const c = availabilityConfig[r.status];
                            return (
                              <div key={r.player_id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs flex-shrink-0">
                                    {r.avatar_url
                                      ? <img src={r.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                                      : r.player_name.charAt(0)}
                                  </div>
                                  <span className="text-sm text-gray-800">{r.player_name}</span>
                                </div>
                                <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${c.color}`}>
                                  {c.icon} {c.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold">{editMatch ? 'Edit Match' : 'Schedule Match'}</h2>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Match Title *</label>
                <input className="input-field" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} required placeholder="e.g. League Match Round 5" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Opponent *</label>
                <input className="input-field" value={form.opponent} onChange={e => setForm(f => ({...f, opponent: e.target.value}))} required placeholder="Team name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Venue *</label>
                <input className="input-field" value={form.venue} onChange={e => setForm(f => ({...f, venue: e.target.value}))} required placeholder="Ground name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                  <input type="date" className="input-field" value={form.match_date} onChange={e => setForm(f => ({...f, match_date: e.target.value}))} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time *</label>
                  <input type="time" className="input-field" value={form.match_time} onChange={e => setForm(f => ({...f, match_time: e.target.value}))} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
                  <select className="input-field" value={form.match_type} onChange={e => setForm(f => ({...f, match_type: e.target.value}))}>
                    {MATCH_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                {editMatch && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select className="input-field" value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}>
                      {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ball Type</label>
                  <select className="input-field" value={form.ball_type} onChange={e => setForm(f => ({...f, ball_type: e.target.value}))}>
                    {BALL_TYPES.map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Attire</label>
                  <select className="input-field" value={form.attire} onChange={e => setForm(f => ({...f, attire: e.target.value}))}>
                    {ATTIRE_OPTIONS.map(a => <option key={a}>{a}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Match Fee <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="number" min="0" step="0.01" className="input-field" value={form.match_fee}
                  onChange={e => setForm(f => ({...f, match_fee: e.target.value}))} placeholder="e.g. 10" />
              </div>
              {editMatch && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Result</label>
                  <input className="input-field" value={form.result} onChange={e => setForm(f => ({...f, result: e.target.value}))} placeholder="e.g. Won by 5 wickets" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea className="input-field" rows={2} value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="Additional notes..." />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? 'Saving...' : editMatch ? 'Update Match' : 'Schedule Match'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

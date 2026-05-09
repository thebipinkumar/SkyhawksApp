import { useEffect, useState, FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Match } from '../types';
import { Calendar, Plus, X, Edit2, Trash2, MapPin, Clock } from 'lucide-react';

const MATCH_TYPES = ['T20', 'ODI', 'Test', 'Practice'];
const STATUS_OPTIONS = ['scheduled', 'completed', 'cancelled'];

const emptyForm = {
  title: '', opponent: '', venue: '', match_date: '', match_time: '',
  match_type: 'T20', status: 'scheduled', result: '', notes: ''
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

  const canManage = ['manager', 'admin'].includes(user?.role || '');

  const load = async () => {
    try {
      const { data } = await api.get('/matches');
      setMatches(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(emptyForm); setEditMatch(null); setShowForm(true); setError(''); };
  const openEdit = (m: Match) => {
    setForm({ title: m.title, opponent: m.opponent, venue: m.venue, match_date: m.match_date, match_time: m.match_time, match_type: m.match_type, status: m.status, result: m.result || '', notes: m.notes || '' });
    setEditMatch(m); setShowForm(true); setError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setError('');
    try {
      if (editMatch) {
        await api.put(`/matches/${editMatch.id}`, form);
      } else {
        await api.post('/matches', form);
      }
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save match');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this match?')) return;
    try {
      await api.delete(`/matches/${id}`);
      load();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete match. Please try again.');
    }
  };

  const filtered = filter === 'all' ? matches : matches.filter(m => m.status === filter);

  const statusColor: Record<string, string> = {
    scheduled: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-600',
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

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
        <div className="grid gap-4">
          {[1,2,3].map(i => <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <Calendar size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg">No matches found</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map(match => (
            <div key={match.id} className="card hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="text-lg font-bold text-gray-900">{match.title}</h3>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${statusColor[match.status]}`}>
                      {match.status}
                    </span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600">{match.match_type}</span>
                  </div>
                  <p className="text-gray-700 font-medium">vs <span className="text-blue-700">{match.opponent}</span></p>
                  <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
                    <span className="flex items-center gap-1"><MapPin size={14} />{match.venue}</span>
                    <span className="flex items-center gap-1"><Calendar size={14} />{formatDate(match.match_date)}</span>
                    <span className="flex items-center gap-1"><Clock size={14} />{match.match_time}</span>
                  </div>
                  {match.result && <p className="mt-2 text-sm text-green-700 font-medium">Result: {match.result}</p>}
                  {match.notes && <p className="mt-1 text-sm text-gray-500 italic">{match.notes}</p>}
                </div>
                {canManage && (
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(match)} className="btn-secondary flex items-center gap-1 text-sm py-1.5 px-3">
                      <Edit2 size={14} /> Edit
                    </button>
                    {user?.role === 'admin' && (
                      <button onClick={() => handleDelete(match.id)} className="btn-danger flex items-center gap-1 text-sm py-1.5 px-3">
                        <Trash2 size={14} /> Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
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

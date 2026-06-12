import { useEffect, useState, FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Match, AvailabilityRecord, AvailabilityStatus, Tournament, TeamSelection } from '../types';
import {
  Calendar, Plus, X, Edit2, Trash2, MapPin, Clock, ChevronDown, ChevronUp,
  CheckCircle, XCircle, HelpCircle, MinusCircle, ExternalLink, Trophy, Users, Bell,
} from 'lucide-react';
import VenueAutocomplete from '../components/VenueAutocomplete';

const MATCH_TYPES   = ['T20', 'T25', 'T30'];
const STATUS_OPTIONS = ['scheduled', 'completed', 'cancelled'];
const BALL_TYPES    = ['Red', 'White'];
const ATTIRE_OPTIONS = ['White', 'Colored'];
const FORMATS       = ['T20', 'T25', 'T30', 'ODI', 'Test', 'Other'];

const emptyMatch = {
  title: '', opponent: '', venue: '', venue_address: '', venue_maps_url: '',
  match_date: '', match_time: '',
  match_type: 'T20', status: 'scheduled', result: '', notes: '',
  ball_type: 'White', attire: 'Colored', match_fee: '', scorecard_url: '',
  tournament_id: '', notify_members: true,
};

const emptyTournament = { name: '', format: '', start_date: '', end_date: '', description: '' };

const availabilityConfig: Record<AvailabilityStatus, { label: string; color: string; icon: React.ReactNode }> = {
  available:     { label: 'Available',     color: 'bg-green-100 text-green-700 border-green-300',   icon: <CheckCircle size={14} /> },
  maybe:         { label: 'Maybe',         color: 'bg-yellow-100 text-yellow-700 border-yellow-300', icon: <HelpCircle size={14} /> },
  not_available: { label: 'Not Available', color: 'bg-red-100 text-red-700 border-red-300',          icon: <XCircle size={14} /> },
  not_responded: { label: 'Not Responded', color: 'bg-gray-100 text-gray-500 border-gray-200',       icon: <MinusCircle size={14} /> },
};

export default function Matches() {
  const { user } = useAuth();
  const [matches, setMatches]               = useState<Match[]>([]);
  const [pastMatches, setPastMatches]       = useState<Match[]>([]);
  const [pastLoaded, setPastLoaded]         = useState(false);
  const [tournaments, setTournaments]       = useState<Tournament[]>([]);
  const [loading, setLoading]               = useState(true);
  const [pastLoading, setPastLoading]       = useState(false);
  const [view, setView]                     = useState<'upcoming' | 'past'>('upcoming');
  const [showForm, setShowForm]             = useState(false);
  const [editMatch, setEditMatch]           = useState<Match | null>(null);
  const [form, setForm]                     = useState(emptyMatch);
  const [submitting, setSubmitting]         = useState(false);
  const [error, setError]                   = useState('');

  // Tournament management
  const [showTournamentModal, setShowTournamentModal] = useState(false);
  const [tForm, setTForm]                   = useState(emptyTournament);
  const [editTournament, setEditTournament] = useState<Tournament | null>(null);
  const [tSubmitting, setTSubmitting]       = useState(false);
  const [tError, setTError]                 = useState('');

  // Notifications
  const [notifying, setNotifying]           = useState<number | null>(null);
  const [notifyMsg, setNotifyMsg]           = useState('');

  // Availability
  const [availability, setAvailability]     = useState<Record<number, AvailabilityRecord[]>>({});
  const [myStatus, setMyStatus]             = useState<Record<number, AvailabilityStatus>>({});
  const [expandedAvail, setExpandedAvail]   = useState<Record<number, boolean>>({});
  const [updatingAvail, setUpdatingAvail]   = useState<number | null>(null);

  // Squad
  const [expandedSquad, setExpandedSquad]   = useState<Record<number, boolean>>({});
  const [squadData, setSquadData]           = useState<Record<number, TeamSelection[]>>({});
  const [loadingSquad, setLoadingSquad]     = useState<Record<number, boolean>>({});

  const userRoles: string[] = user?.roles ?? (user?.role ? [user.role] : []);
  const canManage  = userRoles.some(r => ['manager', 'admin'].includes(r));
  const canSeeAll  = userRoles.some(r => ['manager', 'admin', 'selector'].includes(r));
  const isPlayer   = userRoles.includes('player');

  const load = async () => {
    setLoading(true);
    try {
      const [matchRes, tRes] = await Promise.all([
        api.get('/matches?view=upcoming'),
        api.get('/tournaments'),
      ]);
      setMatches(matchRes.data);
      setTournaments(tRes.data);
    } finally { setLoading(false); }
  };

  const loadPast = async () => {
    if (pastLoaded) return;
    setPastLoading(true);
    try {
      const { data } = await api.get('/matches?view=past');
      setPastMatches(data);
      setPastLoaded(true);
    } finally { setPastLoading(false); }
  };

  const switchView = (v: 'upcoming' | 'past') => {
    setView(v);
    if (v === 'past') loadPast();
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

  useEffect(() => {
    if (pastMatches.length > 0) pastMatches.forEach(m => loadAvailability(m.id));
  }, [pastMatches]);

  const toggleSquad = async (match: Match) => {
    const open = !expandedSquad[match.id];
    setExpandedSquad(prev => ({ ...prev, [match.id]: open }));
    if (open && !squadData[match.id]) {
      setLoadingSquad(prev => ({ ...prev, [match.id]: true }));
      try {
        const { data } = await api.get(`/matches/${match.id}`);
        setSquadData(prev => ({ ...prev, [match.id]: data.team || [] }));
      } finally {
        setLoadingSquad(prev => ({ ...prev, [match.id]: false }));
      }
    }
  };

  const setAvail = async (matchId: number, status: AvailabilityStatus) => {
    if (status === 'not_responded') return;
    setUpdatingAvail(matchId);
    try {
      await api.put(`/matches/${matchId}/availability`, { status });
      setMyStatus(prev => ({ ...prev, [matchId]: status }));
      loadAvailability(matchId);
    } finally { setUpdatingAvail(null); }
  };

  // Match form
  const openCreate = () => { setForm(emptyMatch); setEditMatch(null); setShowForm(true); setError(''); };
  const openEdit = (m: Match) => {
    setForm({
      title: m.title, opponent: m.opponent, venue: m.venue,
      venue_address: (m as any).venue_address || '',
      venue_maps_url: (m as any).venue_maps_url || '',
      match_date: m.match_date, match_time: m.match_time,
      match_type: m.match_type, status: m.status, result: m.result || '', notes: m.notes || '',
      ball_type: m.ball_type || 'White', attire: m.attire || 'Colored',
      match_fee: m.match_fee != null ? String(m.match_fee) : '',
      scorecard_url: m.scorecard_url || '',
      tournament_id: m.tournament_id != null ? String(m.tournament_id) : '',
      notify_members: false,  // not used on edit; hidden in form
    });
    setEditMatch(m); setShowForm(true); setError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setSubmitting(true); setError('');
    try {
      const payload = {
        ...form,
        match_fee: form.match_fee !== '' ? Number(form.match_fee) : null,
        tournament_id: form.tournament_id !== '' ? Number(form.tournament_id) : null,
        // only send notify_members on create; strip from edit payload
        ...(editMatch ? { notify_members: undefined } : { notify_members: form.notify_members }),
      };
      editMatch ? await api.put(`/matches/${editMatch.id}`, payload) : await api.post('/matches', payload);
      setShowForm(false);
      // Refresh both views so stale data doesn't linger
      setPastLoaded(false); setPastMatches([]);
      load();
    } catch (err: any) { setError(err.response?.data?.error || 'Failed to save match'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this match?')) return;
    try {
      await api.delete(`/matches/${id}`);
      setPastLoaded(false); setPastMatches([]);
      load();
    }
    catch (err: any) { alert(err.response?.data?.error || 'Failed to delete match.'); }
  };

  const handleNotify = async (id: number) => {
    setNotifying(id); setNotifyMsg('');
    try {
      const { data } = await api.post(`/matches/${id}/notify`);
      setNotifyMsg(data.message || 'Notification sent!');
      setTimeout(() => setNotifyMsg(''), 4000);
    } catch (err: any) {
      setNotifyMsg(err.response?.data?.error || 'Failed to send notification');
      setTimeout(() => setNotifyMsg(''), 4000);
    } finally { setNotifying(null); }
  };

  // Tournament CRUD
  const openCreateTournament = () => { setTForm(emptyTournament); setEditTournament(null); setTError(''); };
  const openEditTournament = (t: Tournament) => {
    setTForm({ name: t.name, format: t.format || '', start_date: t.start_date || '', end_date: t.end_date || '', description: t.description || '' });
    setEditTournament(t); setTError('');
  };

  const handleTournamentSubmit = async (e: FormEvent) => {
    e.preventDefault(); setTSubmitting(true); setTError('');
    try {
      const payload = { ...tForm, format: tForm.format || null, start_date: tForm.start_date || null, end_date: tForm.end_date || null, description: tForm.description || null };
      editTournament ? await api.put(`/tournaments/${editTournament.id}`, payload) : await api.post('/tournaments', payload);
      const { data } = await api.get('/tournaments');
      setTournaments(data);
      setEditTournament(null);
      setTForm(emptyTournament);
    } catch (err: any) { setTError(err.response?.data?.error || 'Failed to save tournament'); }
    finally { setTSubmitting(false); }
  };

  const handleDeleteTournament = async (id: number) => {
    if (!confirm('Delete this tournament? Linked matches will be unlinked.')) return;
    try {
      await api.delete(`/tournaments/${id}`);
      const [tRes, mRes] = await Promise.all([api.get('/tournaments'), api.get('/matches')]);
      setTournaments(tRes.data);
      setMatches(mRes.data);
    } catch (err: any) { alert(err.response?.data?.error || 'Failed to delete tournament.'); }
  };

  const displayMatches = view === 'upcoming' ? matches : pastMatches;
  const isLoadingView  = view === 'upcoming' ? loading : pastLoading;
  const statusColor: Record<string, string> = {
    scheduled: 'bg-blue-100 text-blue-700', completed: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-600',
  };
  // match_date is stored as "YYYY-MM-DD"; append T00:00:00Z so browsers parse as SGT midnight
  const formatDate = (d: string) => new Date(d.length === 10 ? d + 'T00:00:00Z' : d).toLocaleDateString('en-GB', { timeZone: 'Asia/Singapore', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

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
          <p className="text-gray-500 text-sm mt-1">{displayMatches.length} {view === 'upcoming' ? 'upcoming' : 'past'} match{displayMatches.length !== 1 ? 'es' : ''}</p>
        </div>
        <div className="flex gap-2">
          {canManage && (
            <button onClick={() => setShowTournamentModal(true)} className="btn-secondary flex items-center gap-2">
              <Trophy size={16} /> Tournaments
            </button>
          )}
          {canManage && (
            <button onClick={openCreate} className="btn-primary flex items-center gap-2">
              <Plus size={18} /> Schedule Match
            </button>
          )}
        </div>
      </div>

      {/* View tabs */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => switchView('upcoming')}
          className={`px-5 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${view === 'upcoming' ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          <Calendar size={15} /> Upcoming Matches
          {view === 'upcoming' && matches.length > 0 && (
            <span className="bg-white/30 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">{matches.length}</span>
          )}
        </button>
        <button onClick={() => switchView('past')}
          className={`px-5 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${view === 'past' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          <Clock size={15} /> Past Matches
          {view === 'past' && pastMatches.length > 0 && (
            <span className="bg-white/30 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">{pastMatches.length}</span>
          )}
        </button>
      </div>

      {notifyMsg && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${notifyMsg.includes('Failed') || notifyMsg.includes('error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
          <Bell size={14} className="inline mr-1.5" />{notifyMsg}
        </div>
      )}

      {isLoadingView ? (
        <div className="grid gap-4">{[1,2,3].map(i => <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : displayMatches.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <Calendar size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg">{view === 'upcoming' ? 'No upcoming matches scheduled' : 'No past matches found'}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {displayMatches.map(match => {
            const recs    = availability[match.id] || [];
            const summ    = availSummary(recs);
            const mine    = myStatus[match.id] || 'not_responded';
            const cfg     = availabilityConfig[mine];
            const isExp   = expandedAvail[match.id];
            const squadOpen = expandedSquad[match.id];
            const squad   = squadData[match.id];

            return (
              <div key={match.id} className="card hover:shadow-md transition-shadow">
                {/* Match info row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-lg font-bold text-gray-900">{match.title}</h3>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${statusColor[match.status]}`}>{match.status}</span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600">{match.match_type}</span>
                      {match.tournament_name && (
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-yellow-50 text-yellow-700 font-medium flex items-center gap-1">
                          <Trophy size={11} /> {match.tournament_name}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-700 font-medium">vs <span className="text-blue-700">{match.opponent}</span></p>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <MapPin size={14} />
                        {match.venue}
                        {(match as any).venue_maps_url && (
                          <a
                            href={(match as any).venue_maps_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-1 inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline font-medium"
                            onClick={e => e.stopPropagation()}
                          >
                            <ExternalLink size={12} />
                            Map
                          </a>
                        )}
                      </span>
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
                          💰 Fee: S${match.match_fee}
                        </span>
                      )}
                    </div>
                    {match.result && <p className="mt-2 text-sm text-green-700 font-medium">Result: {match.result}</p>}
                    {match.notes && <p className="mt-1 text-sm text-gray-500 italic">{match.notes}</p>}
                    {match.scorecard_url && (
                      <a href={match.scorecard_url} target="_blank" rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium">
                        <ExternalLink size={14} /> View Scorecard
                      </a>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                      {match.status === 'scheduled' && (
                        <button
                          onClick={() => handleNotify(match.id)}
                          disabled={notifying === match.id}
                          title="Re-send match notification to all members"
                          className="flex items-center gap-1 text-sm py-1.5 px-3 rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors disabled:opacity-50">
                          <Bell size={14} className={notifying === match.id ? 'animate-bounce' : ''} />
                          {notifying === match.id ? 'Sending…' : 'Notify'}
                        </button>
                      )}
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

                {/* Playing Squad section */}
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => toggleSquad(match)}
                    className="flex items-center gap-1.5 text-sm font-medium text-purple-700 hover:text-purple-900 transition-colors">
                    <Users size={15} />
                    Playing Squad
                    {squadOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {squadOpen && (
                    <div className="mt-3">
                      {loadingSquad[match.id] ? (
                        <div className="flex gap-2">{[1,2,3].map(i => <div key={i} className="w-16 h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>
                      ) : !match.is_announced || !squad || squad.length === 0 ? (
                        <div className="flex items-center gap-2 text-sm text-gray-400 italic py-2">
                          <Users size={16} className="opacity-50" />
                          Playing Squad will be announced soon.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 mt-2">
                          {squad.map(player => {
                            const label = player.is_captain ? 'Captain'
                              : player.is_vice_captain ? 'Vice-Captain'
                              : player.role_in_match || '';
                            return (
                              <div key={player.player_id}
                                className="flex flex-col items-center text-center p-2 rounded-xl bg-purple-50 border border-purple-100">
                                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg overflow-hidden flex-shrink-0 mb-1.5">
                                  {player.player_avatar
                                    ? <img src={player.player_avatar} alt={player.player_name} className="w-12 h-12 rounded-full object-cover" />
                                    : player.player_name.charAt(0).toUpperCase()}
                                </div>
                                <p className="text-xs font-semibold text-gray-800 leading-tight">{player.player_name}</p>
                                {label && (
                                  <span className={`mt-1 text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                    player.is_captain ? 'bg-yellow-100 text-yellow-700'
                                    : player.is_vice_captain ? 'bg-blue-100 text-blue-700'
                                    : 'bg-gray-100 text-gray-600'
                                  }`}>
                                    {label}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Availability section */}
                <div className="mt-3 pt-3 border-t border-gray-100">
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

                  {canSeeAll && recs.length > 0 && (
                    <div className={isPlayer ? 'mt-3' : ''}>
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

      {/* Match Form Modal */}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Tournament <span className="text-gray-400 font-normal">(optional)</span></label>
                <select className="input-field" value={form.tournament_id} onChange={e => setForm(f => ({...f, tournament_id: e.target.value}))}>
                  <option value="">— No Tournament —</option>
                  {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}{t.format ? ` (${t.format})` : ''}</option>)}
                </select>
              </div>

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
                <VenueAutocomplete
                  value={form.venue}
                  onChange={v => setForm(f => ({ ...f, venue: v, venue_address: '', venue_maps_url: '' }))}
                  onPlaceSelect={p => setForm(f => ({ ...f, venue: p.venue, venue_address: p.venue_address || '', venue_maps_url: p.venue_maps_url || '' }))}
                  placeholder="Ground name"
                  required
                  className="input-field"
                />
                {form.venue_address && (
                  <p className="mt-1 text-xs text-gray-500">{form.venue_address}</p>
                )}
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scorecard URL <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="url" className="input-field" value={form.scorecard_url}
                  onChange={e => setForm(f => ({...f, scorecard_url: e.target.value}))}
                  placeholder="https://cricclubs.com/..." />
              </div>
              {/* Notify members — only on create */}
              {!editMatch && (
                <div className="border-t pt-4">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={form.notify_members}
                      onChange={e => setForm(f => ({ ...f, notify_members: e.target.checked }))}
                      className="mt-0.5 w-4 h-4 accent-blue-600 shrink-0"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-800 group-hover:text-blue-700 transition-colors flex items-center gap-1.5">
                        <Bell size={14} className="text-blue-600" /> Notify all members via email
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Sends a match alert to every active member with email notifications enabled.
                      </p>
                    </div>
                  </label>
                </div>
              )}

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

      {/* Tournament Management Modal */}
      {showTournamentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold flex items-center gap-2"><Trophy size={20} className="text-yellow-600" /> Manage Tournaments</h2>
              <button onClick={() => { setShowTournamentModal(false); setEditTournament(null); setTForm(emptyTournament); setTError(''); }}><X size={20} /></button>
            </div>
            <div className="p-6 space-y-6">
              {/* Add / Edit form */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-800 mb-3 text-sm">{editTournament ? 'Edit Tournament' : 'Add Tournament'}</h3>
                {tError && <div className="bg-red-50 text-red-700 rounded-lg p-2 text-sm mb-3">{tError}</div>}
                <form onSubmit={handleTournamentSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                    <input className="input-field text-sm" value={tForm.name} onChange={e => setTForm(f => ({...f, name: e.target.value}))} required placeholder="e.g. Singapore Premier League 2026" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Format</label>
                      <select className="input-field text-sm" value={tForm.format} onChange={e => setTForm(f => ({...f, format: e.target.value}))}>
                        <option value="">— Select —</option>
                        {FORMATS.map(f => <option key={f}>{f}</option>)}
                      </select>
                    </div>
                    <div />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                      <input type="date" className="input-field text-sm" value={tForm.start_date} onChange={e => setTForm(f => ({...f, start_date: e.target.value}))} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                      <input type="date" className="input-field text-sm" value={tForm.end_date} onChange={e => setTForm(f => ({...f, end_date: e.target.value}))} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                    <input className="input-field text-sm" value={tForm.description} onChange={e => setTForm(f => ({...f, description: e.target.value}))} placeholder="Optional notes..." />
                  </div>
                  <div className="flex gap-2 justify-end pt-1">
                    {editTournament && (
                      <button type="button" onClick={() => { setEditTournament(null); setTForm(emptyTournament); setTError(''); }}
                        className="btn-secondary text-sm py-1.5 px-3">Cancel</button>
                    )}
                    <button type="submit" disabled={tSubmitting} className="btn-primary text-sm py-1.5 px-4">
                      {tSubmitting ? 'Saving...' : editTournament ? 'Update' : 'Add Tournament'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Tournament list */}
              {tournaments.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No tournaments yet</p>
              ) : (
                <div className="space-y-2">
                  {tournaments.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-white hover:bg-gray-50">
                      <div>
                        <p className="font-semibold text-sm text-gray-900">{t.name}</p>
                        <p className="text-xs text-gray-500">
                          {[t.format, t.start_date && t.end_date ? `${t.start_date} → ${t.end_date}` : t.start_date || t.end_date].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <div className="flex gap-1 ml-2">
                        <button onClick={() => openEditTournament(t)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50">
                          <Edit2 size={14} />
                        </button>
                        {userRoles.includes('admin') && (
                          <button onClick={() => handleDeleteTournament(t.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

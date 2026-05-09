import { useEffect, useState } from 'react';
import api from '../utils/api';
import { Match, User, TeamSelection } from '../types';
import { Users, Send, CheckSquare, Square, Star } from 'lucide-react';

export default function TeamSelectionPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<User[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selections, setSelections] = useState<Record<number, { selected: boolean; role: string; is_captain: boolean; is_vice_captain: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [announcing, setAnnouncing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [existingTeam, setExistingTeam] = useState<TeamSelection[]>([]);

  useEffect(() => {
    Promise.all([api.get('/matches'), api.get('/users')]).then(([mRes, uRes]) => {
      setMatches(mRes.data.filter((m: Match) => m.status === 'scheduled'));
      setPlayers(uRes.data);
      setLoading(false);
    });
  }, []);

  const loadMatchTeam = async (match: Match) => {
    setSelectedMatch(match);
    setMessage(''); setError('');
    const { data } = await api.get(`/matches/${match.id}`);
    const team: TeamSelection[] = data.team || [];
    setExistingTeam(team);

    const init: Record<number, { selected: boolean; role: string; is_captain: boolean; is_vice_captain: boolean }> = {};
    players.forEach(p => {
      const sel = team.find(t => t.player_id === p.id);
      init[p.id] = sel
        ? { selected: true, role: sel.role_in_match, is_captain: !!sel.is_captain, is_vice_captain: !!sel.is_vice_captain }
        : { selected: false, role: 'Batsman', is_captain: false, is_vice_captain: false };
    });
    setSelections(init);
  };

  const togglePlayer = (id: number) => {
    setSelections(s => ({ ...s, [id]: { ...s[id], selected: !s[id].selected } }));
  };

  const setCaptain = (id: number) => {
    setSelections(s => {
      const updated = { ...s };
      Object.keys(updated).forEach(k => { updated[+k] = { ...updated[+k], is_captain: false }; });
      updated[id] = { ...updated[id], is_captain: true };
      return updated;
    });
  };

  const setViceCaptain = (id: number) => {
    setSelections(s => {
      const updated = { ...s };
      Object.keys(updated).forEach(k => { updated[+k] = { ...updated[+k], is_vice_captain: false }; });
      updated[id] = { ...updated[id], is_vice_captain: true };
      return updated;
    });
  };

  const saveSelection = async () => {
    if (!selectedMatch) return;
    setSaving(true); setError(''); setMessage('');
    const playerList = Object.entries(selections)
      .filter(([, v]) => v.selected)
      .map(([id, v]) => ({ player_id: +id, role_in_match: v.role, is_captain: v.is_captain, is_vice_captain: v.is_vice_captain }));

    if (playerList.length === 0) { setError('Select at least one player'); setSaving(false); return; }
    try {
      await api.post(`/selections/matches/${selectedMatch.id}/select`, { players: playerList });
      setMessage(`Team of ${playerList.length} players saved successfully!`);
      const { data } = await api.get(`/matches/${selectedMatch.id}`);
      setExistingTeam(data.team || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save selection');
    } finally {
      setSaving(false);
    }
  };

  const publishAnnouncement = async () => {
    if (!selectedMatch) return;
    if (!confirm('Send team announcement to all members?')) return;
    setAnnouncing(true); setError(''); setMessage('');
    try {
      const { data } = await api.post(`/selections/matches/${selectedMatch.id}/announce`, {});
      setMessage(`Announcement sent to ${data.recipients} members!`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send announcement');
    } finally {
      setAnnouncing(false);
    }
  };

  const selectedCount = Object.values(selections).filter(v => v.selected).length;
  const ROLES = ['Batsman', 'Bowler', 'All-Rounder', 'Wicket-Keeper', 'Captain'];

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-6">
        <Users size={26} className="text-purple-600" /> Team Selection
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Match list */}
        <div className="card">
          <h2 className="font-bold text-gray-900 mb-4">Select Match</h2>
          {matches.length === 0 ? (
            <p className="text-gray-400 text-sm">No upcoming matches</p>
          ) : (
            <div className="space-y-2">
              {matches.map(m => (
                <button key={m.id} onClick={() => loadMatchTeam(m)}
                  className={`w-full text-left p-3 rounded-xl transition-colors border ${selectedMatch?.id === m.id ? 'border-purple-500 bg-purple-50' : 'border-gray-100 hover:bg-gray-50'}`}>
                  <p className="font-semibold text-sm text-gray-900">{m.title}</p>
                  <p className="text-xs text-gray-500">vs {m.opponent}</p>
                  <p className="text-xs text-gray-400">{m.match_date} • {m.match_type}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Player selection */}
        <div className="lg:col-span-2">
          {!selectedMatch ? (
            <div className="card text-center py-16 text-gray-400">
              <Users size={48} className="mx-auto mb-3 opacity-30" />
              <p>Select a match to manage team selection</p>
            </div>
          ) : (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-bold text-gray-900">{selectedMatch.title}</h2>
                  <p className="text-sm text-gray-500">vs {selectedMatch.opponent} • {selectedMatch.match_date}</p>
                </div>
                <span className="text-sm font-semibold text-purple-700 bg-purple-50 px-3 py-1 rounded-full">
                  {selectedCount} selected
                </span>
              </div>

              {message && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 mb-4 text-sm">{message}</div>}
              {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>}

              <div className="space-y-2 max-h-96 overflow-y-auto pr-1 mb-4">
                {players.map(player => {
                  const sel = selections[player.id];
                  if (!sel) return null;
                  return (
                    <div key={player.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${sel.selected ? 'border-purple-300 bg-purple-50' : 'border-gray-100 bg-gray-50'}`}>
                      <button onClick={() => togglePlayer(player.id)} className="flex-shrink-0">
                        {sel.selected ? <CheckSquare size={20} className="text-purple-600" /> : <Square size={20} className="text-gray-400" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{player.name}</p>
                        <p className="text-xs text-gray-400 truncate">{player.email}</p>
                      </div>
                      {sel.selected && (
                        <>
                          <select
                            value={sel.role}
                            onChange={e => setSelections(s => ({ ...s, [player.id]: { ...s[player.id], role: e.target.value } }))}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
                          >
                            {ROLES.map(r => <option key={r}>{r}</option>)}
                          </select>
                          <button onClick={() => setCaptain(player.id)} title="Set as Captain"
                            className={`p-1 rounded ${sel.is_captain ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'}`}>
                            <Star size={16} fill={sel.is_captain ? 'currentColor' : 'none'} />
                          </button>
                          <button onClick={() => setViceCaptain(player.id)} title="Set as Vice-Captain"
                            className={`p-1 rounded ${sel.is_vice_captain ? 'text-blue-500' : 'text-gray-300 hover:text-blue-400'}`}>
                            <Star size={14} fill={sel.is_vice_captain ? 'currentColor' : 'none'} />
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button onClick={saveSelection} disabled={saving} className="btn-primary flex items-center gap-2">
                  {saving ? 'Saving...' : <><CheckSquare size={16} /> Save Selection</>}
                </button>
                {existingTeam.length > 0 && (
                  <button onClick={publishAnnouncement} disabled={announcing} className="btn-success flex items-center gap-2">
                    {announcing ? 'Sending...' : <><Send size={16} /> Announce Team</>}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

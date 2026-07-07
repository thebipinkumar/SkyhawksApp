import { useEffect, useState } from 'react';
import api from '../utils/api';
import { Match, TeamSelection, AvailabilityStatus } from '../types';
import { Users, Send, CheckSquare, Square, Star, Trophy, UserPlus, Trash2, UserCheck } from 'lucide-react';

interface AvailablePlayer {
  player_id: number;
  player_name: string;
  avatar_url?: string;
  status: AvailabilityStatus;
  note?: string | null;
}

interface GuestPlayer {
  clientId: string;
  name: string;
  role: string;
  is_captain: boolean;
  is_vice_captain: boolean;
}

export default function TeamSelectionPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchPlayers, setMatchPlayers] = useState<AvailablePlayer[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selections, setSelections] = useState<Record<number, { selected: boolean; role: string; is_captain: boolean; is_vice_captain: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [announcing, setAnnouncing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [existingTeam, setExistingTeam] = useState<TeamSelection[]>([]);

  // Guest players (non-members added manually)
  const [guests, setGuests] = useState<GuestPlayer[]>([]);
  const [guestInput, setGuestInput] = useState('');

  useEffect(() => {
    api.get('/matches').then(r => {
      setMatches(r.data.filter((m: Match) => m.status === 'scheduled'));
      setLoading(false);
    });
  }, []);

  const loadMatchTeam = async (match: Match) => {
    setSelectedMatch(match);
    setMessage(''); setError('');
    setLoadingPlayers(true);
    setGuests([]);
    setGuestInput('');

    const [matchData, availData] = await Promise.all([
      api.get(`/matches/${match.id}`),
      api.get(`/matches/${match.id}/availability`),
    ]);

    const team: (TeamSelection & { is_guest?: number; guest_id?: number })[] = matchData.data.team || [];
    setExistingTeam(team);

    // Restore guest players from existing team
    const existingGuests: GuestPlayer[] = team
      .filter(t => t.is_guest)
      .map(t => ({
        clientId:       String(t.guest_id ?? Math.random()),
        name:           t.player_name,
        role:           t.role_in_match || '',
        is_captain:     !!t.is_captain,
        is_vice_captain: !!t.is_vice_captain,
      }));
    setGuests(existingGuests);

    const selectedIds = new Set(team.filter(t => !t.is_guest).map((t: TeamSelection) => t.player_id));
    const eligible: AvailablePlayer[] = availData.data.filter((r: AvailablePlayer) =>
      r.status === 'available' || selectedIds.has(r.player_id)
    );
    setMatchPlayers(eligible);

    const init: Record<number, { selected: boolean; role: string; is_captain: boolean; is_vice_captain: boolean }> = {};
    eligible.forEach(p => {
      const sel = team.find(t => !t.is_guest && t.player_id === p.player_id);
      init[p.player_id] = sel
        ? { selected: true, role: sel.role_in_match, is_captain: !!sel.is_captain, is_vice_captain: !!sel.is_vice_captain }
        : { selected: false, role: '', is_captain: false, is_vice_captain: false };
    });
    setSelections(init);
    setLoadingPlayers(false);
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

  // ── Guest helpers ──────────────────────────────────────────────────────────
  const addGuest = () => {
    const name = guestInput.trim();
    if (!name) return;
    setGuests(g => [...g, { clientId: String(Date.now()), name, role: '', is_captain: false, is_vice_captain: false }]);
    setGuestInput('');
  };

  const removeGuest = (clientId: string) => setGuests(g => g.filter(x => x.clientId !== clientId));

  const updateGuest = (clientId: string, patch: Partial<GuestPlayer>) =>
    setGuests(g => g.map(x => x.clientId === clientId ? { ...x, ...patch } : x));

  const setGuestCaptain = (clientId: string) =>
    setGuests(g => g.map(x => ({ ...x, is_captain: x.clientId === clientId })));

  const setGuestViceCaptain = (clientId: string) =>
    setGuests(g => g.map(x => ({ ...x, is_vice_captain: x.clientId === clientId })));

  const saveSelection = async () => {
    if (!selectedMatch) return;
    setSaving(true); setError(''); setMessage('');

    const playerList = Object.entries(selections)
      .filter(([, v]) => v.selected)
      .map(([id, v]) => ({ player_id: +id, role_in_match: v.role, is_captain: v.is_captain, is_vice_captain: v.is_vice_captain }));
    const guestList = guests.filter(g => g.name.trim())
      .map(g => ({ name: g.name.trim(), role_in_match: g.role, is_captain: g.is_captain, is_vice_captain: g.is_vice_captain }));

    if (playerList.length === 0 && guestList.length === 0) {
      setError('Select at least one player or add a guest'); setSaving(false); return;
    }
    try {
      await api.post(`/selections/matches/${selectedMatch.id}/select`, { players: playerList, guests: guestList });
      setMessage(`Team of ${playerList.length + guestList.length} player${playerList.length + guestList.length !== 1 ? 's' : ''} saved successfully!`);
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

  const selectedCount = Object.values(selections).filter(v => v.selected).length + guests.length;
  const availableCount = matchPlayers.filter(p => p.status === 'available').length;
  const ROLES = ['', 'Wicket Keeper', 'Drinks Duty', 'Match Fee Collection'];

  const availabilityBadge = (status: AvailabilityStatus) => {
    if (status === 'available') return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Available</span>;
    return null;
  };

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
                  {m.tournament_name && (
                    <p className="text-xs text-yellow-700 flex items-center gap-1 mt-0.5">
                      <Trophy size={10} /> {m.tournament_name}
                    </p>
                  )}
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
                  {selectedMatch.tournament_name && (
                    <p className="text-xs text-yellow-700 flex items-center gap-1 mt-0.5">
                      <Trophy size={11} /> {selectedMatch.tournament_name}
                    </p>
                  )}
                  <p className="text-sm text-gray-500">vs {selectedMatch.opponent} • {selectedMatch.match_date}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <span className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded-full">{availableCount} available</span>
                  <span className="text-sm font-semibold text-purple-700 bg-purple-50 px-3 py-1 rounded-full">{selectedCount} selected</span>
                </div>
              </div>

              {message && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 mb-4 text-sm">{message}</div>}
              {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>}

              {loadingPlayers ? (
                <div className="space-y-2 mb-4">{[1,2,3,4].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
              ) : matchPlayers.length === 0 ? (
                <div className="text-center py-10 text-gray-400 mb-4">
                  <Users size={36} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No players have marked themselves as available yet.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1 mb-4">
                  {matchPlayers.map(player => {
                    const sel = selections[player.player_id];
                    if (!sel) return null;
                    return (
                      <div key={player.player_id} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${sel.selected ? 'border-purple-300 bg-purple-50' : 'border-gray-100 bg-gray-50'}`}>
                        <button onClick={() => togglePlayer(player.player_id)} className="flex-shrink-0">
                          {sel.selected ? <CheckSquare size={20} className="text-purple-600" /> : <Square size={20} className="text-gray-400" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">{player.player_name}</p>
                          {availabilityBadge(player.status)}
                          {player.note && <p className="text-xs text-gray-500 italic truncate mt-0.5">{player.note}</p>}
                        </div>
                        {sel.selected && (
                          <>
                            <select
                              value={sel.role}
                              onChange={e => setSelections(s => ({ ...s, [player.player_id]: { ...s[player.player_id], role: e.target.value } }))}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
                            >
                              {ROLES.map(r => <option key={r} value={r}>{r || '— No Responsibility —'}</option>)}
                            </select>
                            <button onClick={() => setCaptain(player.player_id)} title="Set as Captain"
                              className={`p-1 rounded ${sel.is_captain ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'}`}>
                              <Star size={16} fill={sel.is_captain ? 'currentColor' : 'none'} />
                            </button>
                            <button onClick={() => setViceCaptain(player.player_id)} title="Set as Vice-Captain"
                              className={`p-1 rounded ${sel.is_vice_captain ? 'text-blue-500' : 'text-gray-300 hover:text-blue-400'}`}>
                              <Star size={14} fill={sel.is_vice_captain ? 'currentColor' : 'none'} />
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Guest / Custom Players ─────────────────────────────── */}
              <div className="mt-4 pt-4 border-t border-dashed border-amber-200">
                <div className="flex items-center gap-2 mb-3">
                  <UserCheck size={16} className="text-amber-600 shrink-0" />
                  <h3 className="text-sm font-semibold text-gray-700">Guest / Custom Players</h3>
                  <span className="text-xs text-gray-400">(non-members, e.g. stand-ins)</span>
                </div>

                {/* Add guest input */}
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={guestInput}
                    onChange={e => setGuestInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addGuest(); } }}
                    placeholder="Guest player name…"
                    className="input-field text-sm flex-1"
                  />
                  <button
                    type="button"
                    onClick={addGuest}
                    disabled={!guestInput.trim()}
                    className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40">
                    <UserPlus size={15} /> Add
                  </button>
                </div>

                {/* Guest list */}
                {guests.length > 0 && (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {guests.map(g => (
                      <div key={g.clientId}
                        className="flex items-center gap-2 p-3 rounded-xl border border-amber-200 bg-amber-50">
                        {/* Name + guest badge */}
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-800 font-semibold shrink-0">Guest</span>
                          <p className="text-sm font-medium text-gray-900 truncate">{g.name}</p>
                        </div>
                        {/* Role */}
                        <select
                          value={g.role}
                          onChange={e => updateGuest(g.clientId, { role: e.target.value })}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white">
                          {ROLES.map(r => <option key={r} value={r}>{r || '— No Responsibility —'}</option>)}
                        </select>
                        {/* Captain */}
                        <button onClick={() => setGuestCaptain(g.clientId)} title="Set as Captain"
                          className={`p-1 rounded ${g.is_captain ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'}`}>
                          <Star size={16} fill={g.is_captain ? 'currentColor' : 'none'} />
                        </button>
                        {/* Vice-captain */}
                        <button onClick={() => setGuestViceCaptain(g.clientId)} title="Set as Vice-Captain"
                          className={`p-1 rounded ${g.is_vice_captain ? 'text-blue-500' : 'text-gray-300 hover:text-blue-400'}`}>
                          <Star size={14} fill={g.is_vice_captain ? 'currentColor' : 'none'} />
                        </button>
                        {/* Remove */}
                        <button onClick={() => removeGuest(g.clientId)}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {guests.length === 0 && (
                  <p className="text-xs text-gray-400 italic">No guest players added yet.</p>
                )}
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

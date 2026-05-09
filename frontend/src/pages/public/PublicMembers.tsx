import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { User } from '../../types';
import { Users, LogIn } from 'lucide-react';

const roleBadge: Record<string, string> = {
  player: 'badge-player', manager: 'badge-manager',
  selector: 'badge-selector', admin: 'badge-admin',
};

export default function PublicMembers() {
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => { api.get('/public/members').then(r => { setMembers(r.data); setLoading(false); }); }, []);

  const filtered = members.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = m.name.toLowerCase().includes(q) || (m.bio || '').toLowerCase().includes(q);
    const matchRole = roleFilter === 'all' || m.role === roleFilter;
    return matchSearch && matchRole;
  });

  const initials = (name: string) => name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-900 text-white py-12 px-4 text-center">
        <h1 className="text-3xl font-bold mb-2">Our Members</h1>
        <p className="text-blue-200">{members.length} registered members</p>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <input className="input-field max-w-xs" placeholder="Search members…" value={search} onChange={e => setSearch(e.target.value)} />
          <div className="flex gap-2 flex-wrap">
            {['all', 'player', 'manager', 'selector', 'admin'].map(r => (
              <button key={r} onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${roleFilter === r ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Users size={48} className="mx-auto mb-3 opacity-30" />
            <p>No members found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(m => (
              <div key={m.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow flex gap-4">
                <div className="flex-shrink-0">
                  {m.avatar_url ? (
                    <img src={m.avatar_url!} alt={m.name}
                      className="w-14 h-14 rounded-full object-cover" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg">
                      {initials(m.name)}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{m.name}</p>
                  <span className={`text-xs ${roleBadge[m.role]}`}>{m.role}</span>
                  {m.batting_style && <p className="text-xs text-gray-500 mt-1">🏏 {m.batting_style}</p>}
                  {m.bowling_style && m.bowling_style !== 'Does not bowl' && <p className="text-xs text-gray-500">⚾ {m.bowling_style}</p>}
                  {m.bio && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{m.bio}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-12 bg-blue-900 text-white rounded-xl p-8 text-center">
          <h3 className="text-lg font-bold mb-2">Join Skyhawks Cricket Club</h3>
          <p className="text-blue-200 text-sm mb-4">Register today to become part of the team!</p>
          <div className="flex justify-center gap-3">
            <Link to="/register" className="bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold px-5 py-2.5 rounded-lg text-sm">Register Now</Link>
            <Link to="/login" className="border border-blue-400 hover:bg-blue-800 text-white px-5 py-2.5 rounded-lg text-sm flex items-center gap-1">
              <LogIn size={14} /> Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

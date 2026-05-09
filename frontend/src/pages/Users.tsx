import { useEffect, useState } from 'react';
import api from '../utils/api';
import { User, Role, PendingUser } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Users as UsersIcon, Shield, Trash2, Phone, Mail, Calendar, Clock, CheckCircle, XCircle } from 'lucide-react';

const ROLES: Role[] = ['player', 'manager', 'selector', 'admin'];

const roleBadge: Record<Role, string> = {
  player: 'badge-player', manager: 'badge-manager',
  selector: 'badge-selector', admin: 'badge-admin',
};

export default function UsersPage() {
  const { user: me } = useAuth();
  const [tab, setTab] = useState<'members' | 'pending'>('members');
  const [users, setUsers] = useState<User[]>([]);
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const isAdmin   = me?.role === 'admin';
  const canManage = me?.role === 'admin' || me?.role === 'manager';

  const loadMembers = () => api.get('/users').then(({ data }) => { setUsers(data); setLoading(false); });
  const loadPending = () => api.get('/users/pending').then(({ data }) => setPending(data));

  useEffect(() => {
    loadMembers();
    if (canManage) loadPending();
  }, []);

  const updateRole = async (id: number, role: Role) => {
    if (!confirm(`Change role to "${role}"?`)) return;
    await api.patch(`/users/${id}/role`, { role });
    loadMembers();
  };

  const deleteUser = async (id: number, name: string) => {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    await api.delete(`/users/${id}`);
    loadMembers();
  };

  const approve = async (id: number, name: string) => {
    if (!confirm(`Approve registration for "${name}"?`)) return;
    await api.patch(`/users/${id}/approve`);
    loadPending();
  };

  const reject = async (id: number, name: string) => {
    if (!confirm(`Reject registration for "${name}"?`)) return;
    await api.patch(`/users/${id}/reject`);
    loadPending();
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) &&
      (roleFilter === 'all' || u.role === roleFilter);
  });

  const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <UsersIcon size={26} className="text-blue-700" /> Members
        </h1>
      </div>

      {/* Tabs */}
      {canManage && (
        <div className="flex gap-2 mb-6">
          <button onClick={() => setTab('members')}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${tab === 'members' ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Active Members ({users.length})
          </button>
          <button onClick={() => setTab('pending')}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${tab === 'pending' ? 'bg-orange-600 text-white' : 'bg-orange-50 text-orange-700 hover:bg-orange-100'}`}>
            Pending Approvals
            {pending.length > 0 && <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${tab === 'pending' ? 'bg-white text-orange-600' : 'bg-orange-600 text-white'}`}>{pending.length}</span>}
          </button>
        </div>
      )}

      {/* ── Pending Approvals ── */}
      {tab === 'pending' && canManage && (
        pending.length === 0 ? (
          <div className="card text-center py-16 text-gray-400">
            <CheckCircle size={48} className="mx-auto mb-3 opacity-30" />
            <p>No pending registrations</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {pending.map(u => (
              <div key={u.id} className="card flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-4 border-orange-400">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-sm flex-shrink-0">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{u.name}</p>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Mail size={11} />{u.email}</span>
                      {u.phone && <span className="flex items-center gap-1"><Phone size={11} />{u.phone}</span>}
                      <span className="flex items-center gap-1"><Clock size={11} />Requested {fmt(u.created_at)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => approve(u.id, u.name)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">
                    <CheckCircle size={14} /> Approve
                  </button>
                  <button onClick={() => reject(u.id, u.name)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors">
                    <XCircle size={14} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Active Members ── */}
      {tab === 'members' && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <input className="input-field max-w-xs" placeholder="Search by name or email..."
              value={search} onChange={e => setSearch(e.target.value)} />
            <div className="flex gap-2 flex-wrap">
              {['all', ...ROLES].map(r => (
                <button key={r} onClick={() => setRoleFilter(r)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${roleFilter === r ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="grid gap-3">{[1,2,3,4].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="card text-center py-16 text-gray-400">
              <UsersIcon size={48} className="mx-auto mb-3 opacity-30" />
              <p>No members found</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filtered.map(u => (
                <div key={u.id} className="card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                      {u.avatar_url
                        ? <img src={u.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                        : u.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">{u.name}</p>
                        <span className={roleBadge[u.role]}>{u.role}</span>
                        {u.id === me?.id && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">You</span>}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Mail size={11} />{u.email}</span>
                        {u.phone && <span className="flex items-center gap-1"><Phone size={11} />{u.phone}</span>}
                        {u.created_at && <span className="flex items-center gap-1"><Calendar size={11} />Joined {fmt(u.created_at)}</span>}
                      </div>
                    </div>
                  </div>
                  {isAdmin && u.id !== me?.id && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex items-center gap-1">
                        <Shield size={14} className="text-gray-400" />
                        <select value={u.role} onChange={e => updateRole(u.id, e.target.value as Role)}
                          className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white">
                          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <button onClick={() => deleteUser(u.id, u.name)} className="p-2 text-gray-400 hover:text-red-600 transition-colors" title="Delete user">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

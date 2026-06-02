import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { User, Role, PendingUser } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Users as UsersIcon, Trash2, Phone, Mail, Calendar, Clock, CheckCircle, XCircle, KeyRound, X, UserCog, CalendarClock } from 'lucide-react';
import { formatLastLoginShort } from '../utils/formatters';

const ROLES: Role[] = ['player', 'manager', 'selector', 'admin'];

const roleBadge: Record<Role, string> = {
  player: 'badge-player', manager: 'badge-manager',
  selector: 'badge-selector', admin: 'badge-admin',
};

export default function UsersPage() {
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const myRoles: string[] = me?.roles ?? (me?.role ? [me.role] : []);
  const isAdmin   = myRoles.includes('admin');
  const canManage = myRoles.includes('admin') || myRoles.includes('manager');

  const [tab, setTab] = useState<'members' | 'pending'>('members');
  const [users, setUsers] = useState<User[]>([]);
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [togglingRole, setTogglingRole] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [resetPw, setResetPw] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [expiryTarget, setExpiryTarget] = useState<User | null>(null);
  const [expiryDate, setExpiryDate] = useState('');
  const [expiryMsg, setExpiryMsg] = useState('');

  const loadMembers = () => api.get('/users').then(({ data }) => { setUsers(data); setLoading(false); });
  const loadPending = () => api.get('/users/pending').then(({ data }) => setPending(data));

  useEffect(() => {
    loadMembers();
    if (canManage) loadPending();
  }, []);

  const toggleRole = async (userId: number, role: Role, hasRole: boolean) => {
    const key = `${userId}-${role}`;
    setTogglingRole(key);
    try {
      if (hasRole) {
        await api.delete(`/users/${userId}/roles/${role}`);
      } else {
        await api.post(`/users/${userId}/roles/${role}`);
      }
      await loadMembers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update role');
    } finally {
      setTogglingRole(null);
    }
  };

  const deleteUser = async (id: number, name: string) => {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    await api.delete(`/users/${id}`);
    loadMembers();
  };

  const approve = async (id: number, name: string) => {
    if (!confirm(`Approve registration for "${name}"?`)) return;
    await api.patch(`/users/${id}/approve`);
    loadPending(); loadMembers();
  };

  const reject = async (id: number, name: string) => {
    if (!confirm(`Reject registration for "${name}"?`)) return;
    await api.patch(`/users/${id}/reject`);
    loadPending();
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchesSearch = u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchesRole = roleFilter === 'all' || (u.roles ?? [u.role]).includes(roleFilter as Role);
    return matchesSearch && matchesRole;
  });

  const fmt = (d?: string) => d
    ? new Date(d).toLocaleDateString('en-GB', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  const submitResetPw = async () => {
    if (!resetTarget || resetPw.length < 6) { setResetMsg('Password must be at least 6 characters'); return; }
    try {
      await api.post(`/users/${resetTarget.id}/reset-password`, { password: resetPw });
      setResetMsg('Password updated successfully!');
      setTimeout(() => { setResetTarget(null); setResetPw(''); setResetMsg(''); }, 1500);
    } catch (err: any) {
      setResetMsg(err.response?.data?.error || 'Failed to reset password');
    }
  };

  const submitExpiry = async () => {
    if (!expiryTarget || !expiryDate) { setExpiryMsg('Please select a date'); return; }
    try {
      await api.patch(`/users/${expiryTarget.id}/membership-expiry`, { membership_end: expiryDate });
      setExpiryMsg('Expiry date updated!');
      await loadMembers();
      setTimeout(() => { setExpiryTarget(null); setExpiryDate(''); setExpiryMsg(''); }, 1500);
    } catch (err: any) {
      setExpiryMsg(err.response?.data?.error || 'Failed to update expiry');
    }
  };

  const memberExpired = (u: User) => {
    if (!u.membership_end) return false;
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Singapore' }));
    const exp = new Date(new Date(u.membership_end).toLocaleString('en-US', { timeZone: 'Asia/Singapore' }));
    return exp < now;
  };

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
            {pending.length > 0 && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${tab === 'pending' ? 'bg-white text-orange-600' : 'bg-orange-600 text-white'}`}>
                {pending.length}
              </span>
            )}
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
            <input className="input-field max-w-xs" placeholder="Search by name or email…"
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
              {filtered.map(u => {
                const userRoles: Role[] = u.roles ?? [u.role];
                return (
                  <div key={u.id} className="card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                        {u.avatar_url
                          ? <img src={u.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                          : u.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900">{u.name}</p>
                          {userRoles.map(r => (
                            <span key={r} className={roleBadge[r]}>{r}</span>
                          ))}
                          {u.id === me?.id && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">You</span>}
                        </div>
                        <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><Mail size={11} />{u.email}</span>
                          {u.phone && <span className="flex items-center gap-1"><Phone size={11} />{u.phone}</span>}
                          {u.created_at && <span className="flex items-center gap-1"><Calendar size={11} />Joined {fmt(u.created_at)}</span>}
                          <span className="flex items-center gap-1"><Clock size={11} />Last seen {formatLastLoginShort(u.last_login)}</span>
                          {u.membership_end && (
                            <span className={`flex items-center gap-1 ${memberExpired(u) ? 'text-red-600 font-semibold' : 'text-green-700'}`}>
                              <CalendarClock size={11} />
                              {memberExpired(u) ? 'Expired ' : 'Expires '}{fmt(u.membership_end)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isAdmin && u.id !== me?.id && (
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {/* Multi-role checkboxes */}
                        <div className="flex gap-2 flex-wrap">
                          {ROLES.map(r => {
                            const has = userRoles.includes(r);
                            const key = `${u.id}-${r}`;
                            return (
                              <label key={r}
                                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border cursor-pointer transition-colors select-none
                                  ${has ? `${roleBadge[r]} border-transparent` : 'border-gray-200 text-gray-500 hover:border-gray-400'}
                                  ${togglingRole === key ? 'opacity-50 pointer-events-none' : ''}`}>
                                <input type="checkbox" className="hidden"
                                  checked={has}
                                  onChange={() => toggleRole(u.id, r, has)} />
                                {r}
                              </label>
                            );
                          })}
                        </div>
                        <button onClick={() => navigate(`/admin/members/${u.id}`)}
                          className="p-2 text-gray-400 hover:text-blue-600 transition-colors" title="Edit profile">
                          <UserCog size={16} />
                        </button>
                        <button onClick={() => { setExpiryTarget(u); setExpiryDate(u.membership_end || ''); setExpiryMsg(''); }}
                          className={`p-2 transition-colors ${memberExpired(u) ? 'text-red-500 hover:text-red-700' : 'text-gray-400 hover:text-orange-500'}`} title="Edit membership expiry">
                          <CalendarClock size={16} />
                        </button>
                        <button onClick={() => { setResetTarget(u); setResetPw(''); setResetMsg(''); }}
                          className="p-2 text-gray-400 hover:text-blue-600 transition-colors" title="Reset password">
                          <KeyRound size={16} />
                        </button>
                        <button onClick={() => deleteUser(u.id, u.name)}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors" title="Delete user">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      {/* Edit Membership Expiry Modal */}
      {expiryTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2"><CalendarClock size={18} className="text-orange-500" /> Membership Expiry</h3>
              <button onClick={() => { setExpiryTarget(null); setExpiryMsg(''); }} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Update membership expiry for <strong>{expiryTarget.name}</strong>.</p>
            {expiryMsg && (
              <div className={`rounded-lg p-3 mb-3 text-sm ${expiryMsg.includes('updated') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{expiryMsg}</div>
            )}
            <input type="date" className="input-field mb-4" value={expiryDate}
              onChange={e => setExpiryDate(e.target.value)} autoFocus />
            <div className="flex gap-3">
              <button onClick={() => { setExpiryTarget(null); setExpiryMsg(''); }} className="btn-secondary flex-1">Cancel</button>
              <button onClick={submitExpiry} className="btn-primary flex-1">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2"><KeyRound size={18} className="text-blue-600" /> Reset Password</h3>
              <button onClick={() => { setResetTarget(null); setResetMsg(''); }} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Set a new password for <strong>{resetTarget.name}</strong>.</p>
            {resetMsg && (
              <div className={`rounded-lg p-3 mb-3 text-sm ${resetMsg.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{resetMsg}</div>
            )}
            <input type="password" className="input-field mb-4" placeholder="New password (min 6 chars)"
              value={resetPw} onChange={e => setResetPw(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitResetPw()} autoFocus />
            <div className="flex gap-3">
              <button onClick={() => { setResetTarget(null); setResetMsg(''); }} className="btn-secondary flex-1">Cancel</button>
              <button onClick={submitResetPw} className="btn-primary flex-1">Update Password</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

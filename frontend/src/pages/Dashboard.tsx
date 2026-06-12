import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Match, BudgetSummary, MyMembershipStatus, PendingAvailabilityMatch } from '../types';
import { Calendar, Users, DollarSign, Megaphone, Clock, Trophy, AlertTriangle, CheckCircle, UserCircle } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([]);
  const [totalMembers, setTotalMembers] = useState(0);
  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [membershipStatus, setMembershipStatus] = useState<MyMembershipStatus | null>(null);
  const [pendingMatches, setPendingMatches] = useState<PendingAvailabilityMatch[]>([]);

  const userRoles: string[] = (user as any)?.roles ?? (user?.role ? [user.role] : []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const matchRes = await api.get('/matches');
        const upcoming = matchRes.data
          .filter((m: Match) => m.status === 'scheduled')
          .slice(0, 3);
        setUpcomingMatches(upcoming);

        if (userRoles.some(r => ['admin', 'manager', 'selector', 'account_manager'].includes(r))) {
          const usersRes = await api.get('/users');
          setTotalMembers(usersRes.data.length);
        }

        if (userRoles.some(r => ['admin', 'manager', 'account_manager'].includes(r))) {
          const budgetRes = await api.get('/budget');
          setBudget(budgetRes.data.summary);
        }

        // Membership fee status (all roles)
        try {
          const msRes = await api.get('/membership/my-payment');
          setMembershipStatus(msRes.data);
        } catch { /* non-critical */ }

        // Pending availability (all roles)
        try {
          const paRes = await api.get('/matches/my-pending');
          setPendingMatches(paRes.data);
        } catch { /* non-critical */ }

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const formatCurrency = (n: number) => new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD', maximumFractionDigits: 0 }).format(n || 0);

  const statusColor = { scheduled: 'text-blue-600 bg-blue-50', completed: 'text-green-600 bg-green-50', cancelled: 'text-red-600 bg-red-50' };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8 flex items-center gap-4">
        {/* Profile avatar */}
        {user?.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={user.name}
            className="w-16 h-16 rounded-full object-cover border-4 border-white shadow-md shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-blue-700 flex items-center justify-center text-white font-bold text-2xl shadow-md shrink-0 select-none">
            {user?.name?.charAt(0)?.toUpperCase() ?? <UserCircle size={32} />}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user?.name}!</h1>
          <p className="text-gray-500 mt-0.5">Here's what's happening at Skyhawks Cricket Club</p>
        </div>
      </div>

      {/* ── Membership Fee Pending Alert ── */}
      {membershipStatus && membershipStatus.status === 'pending' && (
        <div className="mb-6 rounded-xl border-2 border-amber-400 bg-amber-50 p-4 flex items-start gap-3 animate-pulse-border shadow-md">
          <span className="mt-0.5 shrink-0 animate-bounce">
            <AlertTriangle size={22} className="text-amber-500" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-amber-800 text-base">
              ⚠️ Annual Membership Fee Payment Pending
            </p>
            <p className="text-amber-700 text-sm mt-0.5">
              Your {membershipStatus.year} membership fee
              {membershipStatus.fee_amount
                ? ` of ${membershipStatus.fee_currency} ${membershipStatus.fee_amount.toFixed(2)}`
                : ''}{' '}
              is <strong>unpaid</strong>. Please make payment as soon as possible to avoid deactivation of your profile.
            </p>
          </div>
        </div>
      )}

      {/* ── Pending Availability Reminders ── */}
      {pendingMatches.length > 0 && (
        <div className="mb-6 rounded-xl border border-blue-300 bg-blue-50 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={20} className="text-blue-600 shrink-0" />
            <p className="font-bold text-blue-800 text-base">
              Availability Response Pending ({pendingMatches.length} match{pendingMatches.length > 1 ? 'es' : ''})
            </p>
          </div>
          <p className="text-blue-700 text-sm mb-3">
            Please update your availability for the following scheduled match{pendingMatches.length > 1 ? 'es' : ''}:
          </p>
          <div className="space-y-2">
            {pendingMatches.map(m => (
              <Link key={m.id} to="/matches"
                className="flex items-center justify-between bg-white rounded-lg px-4 py-2.5 hover:bg-blue-100 transition-colors border border-blue-200">
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{m.title}</p>
                  <p className="text-xs text-gray-500">vs {m.opponent}{m.tournament_name ? ` · ${m.tournament_name}` : ''}</p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-xs font-medium text-blue-700">
                    {new Date(m.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  <span className="text-xs text-gray-400">{m.match_time}</span>
                </div>
              </Link>
            ))}
          </div>
          <p className="text-xs text-blue-600 mt-3">
            Go to <Link to="/matches" className="underline font-medium">Matches</Link> to respond to each match.
          </p>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-xl"><Calendar size={24} className="text-blue-700" /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{upcomingMatches.length}</p>
            <p className="text-sm text-gray-500">Upcoming Matches</p>
          </div>
        </div>

        {userRoles.some(r => ['admin', 'manager', 'selector', 'account_manager'].includes(r)) && (
          <div className="card flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-xl"><Users size={24} className="text-purple-700" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalMembers}</p>
              <p className="text-sm text-gray-500">Total Members</p>
            </div>
          </div>
        )}

        {userRoles.some(r => ['admin', 'manager', 'account_manager'].includes(r)) && budget && (
          <>
            <div className="card flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-xl"><DollarSign size={24} className="text-green-700" /></div>
              <div>
                <p className="text-xl font-bold text-green-700">{formatCurrency(budget.total_revenue)}</p>
                <p className="text-sm text-gray-500">Total Revenue</p>
              </div>
            </div>
            <div className="card flex items-center gap-4">
              <div className={`p-3 rounded-xl ${budget.net_balance >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                <Trophy size={24} className={budget.net_balance >= 0 ? 'text-green-700' : 'text-red-700'} />
              </div>
              <div>
                <p className={`text-xl font-bold ${budget.net_balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {formatCurrency(budget.net_balance)}
                </p>
                <p className="text-sm text-gray-500">Net Balance</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Clock size={20} className="text-blue-600" /> Upcoming Matches
              </h2>
              <Link to="/matches" className="text-sm text-blue-600 hover:underline">View all</Link>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)}
              </div>
            ) : upcomingMatches.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <Calendar size={40} className="mx-auto mb-2 opacity-40" />
                <p>No upcoming matches scheduled</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingMatches.map(match => (
                  <Link key={match.id} to="/matches" className="flex items-center justify-between p-4 rounded-xl bg-gray-50 hover:bg-blue-50 transition-colors">
                    <div>
                      <p className="font-semibold text-gray-900">{match.title}</p>
                      <p className="text-sm text-gray-500">vs {match.opponent} • {match.venue}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-700">{formatDate(match.match_date)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[match.status]}`}>
                        {match.match_type}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Megaphone size={20} className="text-green-600" /> Quick Actions
            </h2>
            <div className="space-y-2">
              <Link to="/matches" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <Calendar size={18} className="text-blue-600" />
                <span className="text-sm font-medium">View Match Schedule</span>
              </Link>
              <Link to="/announcements" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <Megaphone size={18} className="text-green-600" />
                <span className="text-sm font-medium">Team Announcements</span>
              </Link>
              {userRoles.some(r => ['selector', 'admin'].includes(r)) && (
                <Link to="/team-selection" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <Users size={18} className="text-purple-600" />
                  <span className="text-sm font-medium">Select Team</span>
                </Link>
              )}
              {userRoles.some(r => ['manager', 'admin', 'account_manager'].includes(r)) && (
                <Link to="/budget" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <DollarSign size={18} className="text-green-600" />
                  <span className="text-sm font-medium">Manage Finance</span>
                </Link>
              )}
              {userRoles.some(r => ['manager', 'admin', 'account_manager'].includes(r)) && (
                <Link to="/membership" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <Users size={18} className="text-amber-600" />
                  <span className="text-sm font-medium">Membership Fees</span>
                </Link>
              )}
            </div>
          </div>

          <div className="card bg-blue-900 text-white">
            <Trophy size={28} className="text-yellow-400 mb-2" />
            <h3 className="font-bold text-lg">Skyhawks Cricket Club</h3>
            {user?.membership_end && (
              <p className="text-blue-200 text-sm mt-1">
                Membership expires:{' '}
                <span className={`font-semibold ${new Date(user.membership_end) < new Date() ? 'text-red-400' : 'text-white'}`}>
                  {new Date(user.membership_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </p>
            )}
            <p className="text-blue-300 text-xs mt-3">{user?.email}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

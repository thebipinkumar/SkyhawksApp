import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Match, BudgetSummary } from '../types';
import { Calendar, Users, DollarSign, Megaphone, Clock, Trophy } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([]);
  const [totalMembers, setTotalMembers] = useState(0);
  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const matchRes = await api.get('/matches');
        const upcoming = matchRes.data
          .filter((m: Match) => m.status === 'scheduled')
          .slice(0, 3);
        setUpcomingMatches(upcoming);

        if (['admin', 'manager', 'selector'].includes(user?.role || '')) {
          const usersRes = await api.get('/users');
          setTotalMembers(usersRes.data.length);
        }

        if (['admin', 'manager'].includes(user?.role || '')) {
          const budgetRes = await api.get('/budget');
          setBudget(budgetRes.data.summary);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const formatCurrency = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

  const statusColor = { scheduled: 'text-blue-600 bg-blue-50', completed: 'text-green-600 bg-green-50', cancelled: 'text-red-600 bg-red-50' };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user?.name}!</h1>
        <p className="text-gray-500 mt-1">Here's what's happening at Skyhawks Cricket Club</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-xl"><Calendar size={24} className="text-blue-700" /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{upcomingMatches.length}</p>
            <p className="text-sm text-gray-500">Upcoming Matches</p>
          </div>
        </div>

        {['admin', 'manager', 'selector'].includes(user?.role || '') && (
          <div className="card flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-xl"><Users size={24} className="text-purple-700" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalMembers}</p>
              <p className="text-sm text-gray-500">Total Members</p>
            </div>
          </div>
        )}

        {['admin', 'manager'].includes(user?.role || '') && budget && (
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
              {['selector', 'admin'].includes(user?.role || '') && (
                <Link to="/team-selection" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <Users size={18} className="text-purple-600" />
                  <span className="text-sm font-medium">Select Team</span>
                </Link>
              )}
              {['manager', 'admin'].includes(user?.role || '') && (
                <Link to="/budget" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <DollarSign size={18} className="text-green-600" />
                  <span className="text-sm font-medium">Manage Budget</span>
                </Link>
              )}
            </div>
          </div>

          <div className="card bg-blue-900 text-white">
            <Trophy size={28} className="text-yellow-400 mb-2" />
            <h3 className="font-bold text-lg">Skyhawks Cricket Club</h3>
            <p className="text-blue-200 text-sm mt-1">Your role: <span className="font-semibold text-white capitalize">{user?.role}</span></p>
            <p className="text-blue-300 text-xs mt-3">{user?.email}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

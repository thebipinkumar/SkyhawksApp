import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { Match } from '../../types';
import { Calendar, MapPin, Clock, LogIn } from 'lucide-react';

export default function PublicMatches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/public/matches').then(r => { setMatches(r.data); setLoading(false); });
  }, []);

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const typeColor: Record<string, string> = {
    T20: 'bg-blue-100 text-blue-700',
    ODI: 'bg-purple-100 text-purple-700',
    Test: 'bg-orange-100 text-orange-700',
    Practice: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-900 text-white py-12 px-4 text-center">
        <h1 className="text-3xl font-bold mb-2">Upcoming Matches</h1>
        <p className="text-blue-200">Follow Skyhawks on the field</p>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10">
        {loading ? (
          <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        ) : matches.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Calendar size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-lg">No matches scheduled at the moment</p>
            <p className="text-sm mt-1">Check back soon!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {matches.map(m => (
              <div key={m.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-bold text-gray-900 text-lg">{m.title}</h3>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${typeColor[m.match_type] || 'bg-gray-100 text-gray-600'}`}>{m.match_type}</span>
                    </div>
                    <p className="text-blue-700 font-semibold">vs {m.opponent}</p>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
                      <span className="flex items-center gap-1"><MapPin size={13} />{m.venue}</span>
                      <span className="flex items-center gap-1"><Calendar size={13} />{formatDate(m.match_date)}</span>
                      <span className="flex items-center gap-1"><Clock size={13} />{m.match_time}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {m.ball_type && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.ball_type === 'Red' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                          🏏 {m.ball_type} Ball
                        </span>
                      )}
                      {m.attire && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">
                          👕 {m.attire} Attire
                        </span>
                      )}
                      {m.match_fee != null && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 font-medium">
                          💰 Fee: S${m.match_fee}
                        </span>
                      )}
                    </div>
                    {m.notes && <p className="text-sm text-gray-400 mt-2 italic">{m.notes}</p>}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className="bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">Scheduled</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-12 bg-blue-900 text-white rounded-xl p-8 text-center">
          <h3 className="text-lg font-bold mb-2">Want full access?</h3>
          <p className="text-blue-200 text-sm mb-4">Register as a member to view team announcements, track budget, and more.</p>
          <div className="flex justify-center gap-3">
            <Link to="/register" className="bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold px-5 py-2.5 rounded-lg text-sm transition-colors">Join the Club</Link>
            <Link to="/login" className="border border-blue-400 hover:bg-blue-800 text-white px-5 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-1">
              <LogIn size={14} /> Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

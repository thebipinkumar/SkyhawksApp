import { useEffect, useState } from 'react';
import api from '../utils/api';
import { Announcement } from '../types';
import { Megaphone, Calendar, User } from 'lucide-react';

export default function Announcements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/selections/announcements').then(({ data }) => {
      setAnnouncements(data);
      setLoading(false);
    });
  }, []);

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-6">
        <Megaphone size={26} className="text-green-600" /> Team Announcements
      </h1>

      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : announcements.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <Megaphone size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg">No announcements yet</p>
          <p className="text-sm mt-1">Team announcements will appear here after selectors publish team selections.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map(ann => (
            <div key={ann.id} className="card border-l-4 border-green-500 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Megaphone size={16} className="text-green-600 flex-shrink-0" />
                    <h3 className="font-bold text-gray-900">{ann.match_title}</h3>
                  </div>
                  <p className="text-blue-700 font-medium">vs {ann.opponent}</p>
                  <p className="text-gray-600 mt-2">{ann.message}</p>
                  <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <User size={12} /> Announced by {ann.sent_by_name}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar size={12} /> {formatDate(ann.sent_at)}
                    </span>
                  </div>
                </div>
                <div className="flex-shrink-0 bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">
                  Published
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

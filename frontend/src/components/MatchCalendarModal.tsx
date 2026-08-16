import { useMemo, useState } from 'react';
import { Match, AvailabilityStatus } from '../types';
import {
  X, ChevronLeft, ChevronRight, MapPin, Clock, CheckCircle, XCircle, ArrowRight,
} from 'lucide-react';

interface Props {
  matches: Match[]; // all upcoming matches (unfiltered by any preview cap)
  isPlayer: boolean;
  myStatus: Record<number, AvailabilityStatus>;
  updatingAvail: number | null;
  onSetAvailability: (matchId: number, status: AvailabilityStatus) => void;
  onViewMatch: (matchId: number) => void;
  onClose: () => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = (n: number) => String(n).padStart(2, '0');
const dateKey = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

export default function MatchCalendarModal({
  matches, isPlayer, myStatus, updatingAvail, onSetAvailability, onViewMatch, onClose,
}: Props) {
  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const matchesByDate = useMemo(() => {
    const map: Record<string, Match[]> = {};
    matches.forEach(m => {
      const key = m.match_date.slice(0, 10);
      (map[key] ||= []).push(m);
    });
    return map;
  }, [matches]);

  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());
  const currentMonthKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;
  const cursorMonthKey = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}`;
  const isAtEarliestMonth = cursorMonthKey <= currentMonthKey;

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const changeMonth = (delta: number) => {
    setCursor(prev => {
      const next = new Date(prev.getFullYear(), prev.getMonth() + delta, 1);
      const nextKey = `${next.getFullYear()}-${pad(next.getMonth() + 1)}`;
      return nextKey < currentMonthKey ? prev : next;
    });
    setSelectedDate(null);
  };

  const selectedMatches = selectedDate ? (matchesByDate[selectedDate] || []) : [];
  const formatTime = (t: string) => t;
  const formatFull = (key: string) =>
    new Date(key + 'T00:00:00Z').toLocaleDateString('en-GB', { timeZone: 'Asia/Singapore', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-bold text-gray-900">Upcoming Matches Calendar</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => changeMonth(-1)}
              disabled={isAtEarliestMonth}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="font-semibold text-gray-800">
              {cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={() => changeMonth(1)} className="p-1.5 rounded-lg hover:bg-gray-100">
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-400 mb-1">
            {WEEKDAYS.map(d => <div key={d} className="py-1">{d}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (day === null) return <div key={`pad-${i}`} />;
              const key = dateKey(year, month, day);
              const dayMatches = matchesByDate[key];
              const hasMatch = !!dayMatches?.length;
              const isToday = key === todayKey;
              const isSelected = key === selectedDate;
              return (
                <button
                  key={key}
                  disabled={!hasMatch}
                  onClick={() => setSelectedDate(key)}
                  className={`relative aspect-square rounded-lg text-sm flex flex-col items-center justify-center transition-colors
                    ${isSelected ? 'bg-blue-700 text-white font-semibold'
                      : hasMatch ? 'bg-blue-50 text-blue-800 font-semibold hover:bg-blue-100 cursor-pointer'
                      : 'text-gray-400 cursor-default'}
                    ${isToday && !isSelected ? 'ring-2 ring-blue-400' : ''}`}
                >
                  {day}
                  {hasMatch && (
                    <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-600'}`} />
                  )}
                </button>
              );
            })}
          </div>

          {selectedDate && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-sm font-medium text-gray-600 mb-3">{formatFull(selectedDate)}</p>
              <div className="space-y-3">
                {selectedMatches.map(m => {
                  const mine = myStatus[m.id] || 'not_responded';
                  return (
                    <div key={m.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                      <p className="font-semibold text-gray-900 text-sm">{m.title}</p>
                      <p className="text-blue-700 text-sm font-medium">vs {m.opponent}</p>
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><MapPin size={12} />{m.venue}</span>
                        <span className="flex items-center gap-1"><Clock size={12} />{formatTime(m.match_time)}</span>
                      </div>

                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        {isPlayer && (
                          <>
                            <button
                              disabled={updatingAvail === m.id}
                              onClick={() => onSetAvailability(m.id, 'available')}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${mine === 'available' ? 'bg-green-100 text-green-700 border-green-300 ring-1 ring-green-400' : 'border-gray-200 text-gray-500 bg-white hover:border-gray-300'}`}
                            >
                              <CheckCircle size={13} /> Available
                            </button>
                            <button
                              disabled={updatingAvail === m.id}
                              onClick={() => onSetAvailability(m.id, 'not_available')}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${mine === 'not_available' ? 'bg-red-100 text-red-700 border-red-300 ring-1 ring-red-400' : 'border-gray-200 text-gray-500 bg-white hover:border-gray-300'}`}
                            >
                              <XCircle size={13} /> Not Available
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => onViewMatch(m.id)}
                          className="ml-auto flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Open match <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!selectedDate && (
            <p className="text-xs text-gray-400 text-center mt-5">Tap a highlighted date to view the match and mark your availability.</p>
          )}
        </div>
      </div>
    </div>
  );
}

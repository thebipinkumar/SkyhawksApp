import { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import api from '../utils/api';

interface EmailJob {
  id: number;
  label: string;
  recipients: number;
  totalBatches: number;
  doneBatches: number;
  failedBatches: number;
  percent: number;
  active: boolean;
}

const POLL_MS = 10_000;

export default function EmailProgressBar() {
  const [jobs, setJobs] = useState<EmailJob[]>([]);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const { data } = await api.get('/email-jobs');
        if (!cancelled) setJobs(data);
      } catch { /* keep last state */ }
    };
    poll();
    const t = setInterval(poll, POLL_MS);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  if (jobs.length === 0) return null;

  return (
    <div className="bg-blue-50 border-b border-blue-100">
      <div className="max-w-7xl mx-auto px-4 py-2 space-y-2">
        {jobs.map(j => (
          <div key={j.id}>
            <div className="flex items-center justify-between gap-3 text-xs text-blue-900">
              <span className="flex items-center gap-1.5 font-medium min-w-0">
                <Mail size={13} className="shrink-0" />
                <span className="truncate">{j.label}</span>
              </span>
              <span className="shrink-0">
                {j.active ? 'Sending' : 'Completed'} · {j.percent}% · batch {j.doneBatches}/{j.totalBatches} · {j.recipients} recipient{j.recipients !== 1 ? 's' : ''}
                {j.failedBatches > 0 && <span className="text-red-600"> · {j.failedBatches} failed</span>}
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-blue-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${j.failedBatches > 0 ? 'bg-amber-500' : j.active ? 'bg-blue-600' : 'bg-green-500'}`}
                style={{ width: `${j.percent}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';
import { Shirt, Download, CheckCircle, XCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const toDataURL = (url: string): Promise<string> =>
  fetch(url).then(r => r.blob()).then(blob => new Promise(resolve => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  }));

type Attire = 'whites' | 'colored';
type JerseyStatus = 'required' | 'not_required';

interface JerseyPlayer {
  id: number; name: string; email: string; date_of_birth?: string;
  jersey_number?: string; jersey_label?: string;
  whites_tshirt_size?: string; whites_lower_size?: string; whites_sleeve?: string;
  whites_jersey_status: JerseyStatus;
  colored_tshirt_size?: string; colored_lower_size?: string; colored_sleeve?: string;
  colored_jersey_status: JerseyStatus;
}

export default function JerseyList() {
  const { user } = useAuth();
  const { club } = useClub();
  const [players, setPlayers] = useState<JerseyPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [attire, setAttire] = useState<Attire>('whites');
  const [toggling, setToggling] = useState<string | null>(null);

  const myRoles: string[] = (user as any)?.roles ?? ((user as any)?.role ? [(user as any).role] : []);
  const canEdit = myRoles.includes('admin') || myRoles.includes('manager');

  const load = () => api.get('/jerseys').then(r => { setPlayers(r.data); setLoading(false); });
  useEffect(() => { load(); }, []);

  const toggleStatus = async (playerId: number, current: JerseyStatus) => {
    const key = `${playerId}-${attire}`;
    setToggling(key);
    const next: JerseyStatus = current === 'required' ? 'not_required' : 'required';
    try {
      await api.patch(`/jerseys/${playerId}/status`, { attire, status: next });
      setPlayers(ps => ps.map(p => p.id === playerId
        ? { ...p, [`${attire}_jersey_status`]: next }
        : p
      ));
    } finally { setToggling(null); }
  };

  const exportPdf = async () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const clubName = club?.club_name || 'Skyhawks Cricket Club';
    const pageW = doc.internal.pageSize.getWidth();
    let y = 15;

    if (club?.logo_url) {
      try {
        const dataUrl = await toDataURL(club.logo_url);
        doc.addImage(dataUrl, 'PNG', pageW / 2 - 12, y, 24, 24);
        y += 28;
      } catch { /* skip logo if CORS or network fails */ }
    }

    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(clubName, pageW / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(11); doc.setFont('helvetica', 'normal');
    doc.text(`Merchandise — ${attire === 'whites' ? 'Whites' : 'Colored'}`, pageW / 2, y, { align: 'center' });
    y += 6;
    doc.setFontSize(9); doc.setTextColor(120);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })}`, pageW / 2, y, { align: 'center' });
    doc.setTextColor(0);
    y += 8;

    const rows = players.map((p, i) => {
      const status = attire === 'whites' ? p.whites_jersey_status : p.colored_jersey_status;
      return [
        i + 1,
        p.name,
        p.jersey_number || '—',
        p.jersey_label  || '—',
        attire === 'whites' ? (p.whites_tshirt_size || '—') : (p.colored_tshirt_size || '—'),
        attire === 'whites' ? (p.whites_lower_size  || '—') : (p.colored_lower_size  || '—'),
        attire === 'whites' ? (p.whites_sleeve       || '—') : (p.colored_sleeve       || '—'),
        status === 'required' ? 'Required' : 'Not Required',
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [['#', 'Name', 'Jersey #', 'Label', 'T-Shirt', 'Lower', 'Sleeve', 'Status']],
      body: rows,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 58, 138] },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 7) {
          const val = data.cell.raw as string;
          data.cell.styles.textColor = val === 'Required' ? [22, 163, 74] : [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });

    doc.save(`merchandise-${attire}-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const displayed = players;
  const statusField = attire === 'whites' ? 'whites_jersey_status' : 'colored_jersey_status';
  const required    = displayed.filter(p => p[statusField] === 'required').length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Shirt size={26} className="text-blue-700" /> Merchandise
        </h1>
        <button onClick={exportPdf} className="btn-primary flex items-center gap-2">
          <Download size={16} /> Export PDF
        </button>
      </div>

      {/* Attire tabs */}
      <div className="flex gap-2 mb-6">
        {(['whites', 'colored'] as Attire[]).map(a => (
          <button key={a} onClick={() => setAttire(a)}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${attire === a ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {a === 'whites' ? '⚪ Whites' : '🔵 Colored'}
          </button>
        ))}
        {!loading && (
          <span className="ml-auto text-sm text-gray-500 self-center">
            <span className="text-green-700 font-semibold">{required}</span> required · <span className="text-red-600 font-semibold">{displayed.length - required}</span> not required
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-blue-900 text-white">
              <tr>
                <th className="text-left px-4 py-3 font-medium">#</th>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Jersey #</th>
                <th className="text-left px-4 py-3 font-medium">Label</th>
                <th className="text-left px-4 py-3 font-medium">T-Shirt</th>
                <th className="text-left px-4 py-3 font-medium">Lower</th>
                <th className="text-left px-4 py-3 font-medium">Sleeve</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayed.map((p, i) => {
                const status: JerseyStatus = attire === 'whites' ? p.whites_jersey_status : p.colored_jersey_status;
                const key = `${p.id}-${attire}`;
                return (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3 text-gray-600">{p.jersey_number || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{p.jersey_label  || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {(attire === 'whites' ? p.whites_tshirt_size : p.colored_tshirt_size) || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {(attire === 'whites' ? p.whites_lower_size : p.colored_lower_size) || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {(attire === 'whites' ? p.whites_sleeve : p.colored_sleeve) || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {canEdit ? (
                        <button onClick={() => toggleStatus(p.id, status)} disabled={toggling === key}
                          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium border transition-colors
                            ${status === 'required'
                              ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                              : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'}
                            ${toggling === key ? 'opacity-50 pointer-events-none' : ''}`}>
                          {status === 'required'
                            ? <><CheckCircle size={12} /> Required</>
                            : <><XCircle size={12} /> Not Required</>}
                        </button>
                      ) : (
                        <span className={`flex items-center gap-1 text-xs font-medium ${status === 'required' ? 'text-green-700' : 'text-red-600'}`}>
                          {status === 'required' ? <><CheckCircle size={12} /> Required</> : <><XCircle size={12} /> Not Required</>}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          {displayed.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Shirt size={40} className="mx-auto mb-3 opacity-30" />
              <p>No players found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

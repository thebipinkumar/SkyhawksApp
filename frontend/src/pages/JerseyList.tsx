import { useEffect, useState, FormEvent } from 'react';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';
import { Shirt, Download, CheckCircle, XCircle, Plus, X, Trash2 } from 'lucide-react';
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
  id: number; name: string;
  jersey_number?: string; jersey_label?: string;
  whites_tshirt_size?: string; whites_lower_size?: string; whites_sleeve?: string;
  whites_jersey_status: JerseyStatus;
  colored_tshirt_size?: string; colored_lower_size?: string; colored_sleeve?: string;
  colored_jersey_status: JerseyStatus;
  is_dummy: number; // 0 = real member, 1 = extra/dummy
}

const TSHIRT_SIZES = ['', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
const LOWER_SIZES  = ['', '28', '30', '32', '34', '36', '38', '40', '42'];
const SLEEVES      = ['', 'Half Sleeve', 'Full Sleeve'];

const emptyDummy = {
  name: '', jersey_number: '', jersey_label: '',
  whites_tshirt_size: '', whites_lower_size: '', whites_sleeve: '',
  whites_jersey_status: 'required' as JerseyStatus,
  colored_tshirt_size: '', colored_lower_size: '', colored_sleeve: '',
  colored_jersey_status: 'required' as JerseyStatus,
};

export default function JerseyList() {
  const { user } = useAuth();
  const { club } = useClub();
  const [players, setPlayers] = useState<JerseyPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [attire, setAttire] = useState<Attire>('whites');
  const [toggling, setToggling] = useState<string | null>(null);

  // Dummy entry form
  const [showDummyForm, setShowDummyForm] = useState(false);
  const [dForm, setDForm] = useState(emptyDummy);
  const [dSubmitting, setDSubmitting] = useState(false);
  const [dError, setDError] = useState('');
  const [jerseyNumError, setJerseyNumError] = useState('');

  const myRoles: string[] = (user as any)?.roles ?? ((user as any)?.role ? [(user as any).role] : []);
  const canEdit    = myRoles.includes('admin') || myRoles.includes('manager');
  const isPlayerOnly = !canEdit && myRoles.includes('player');

  const load = () => api.get('/jerseys').then(r => { setPlayers(r.data); setLoading(false); });
  useEffect(() => { load(); }, []);

  const toggleStatus = async (player: JerseyPlayer, current: JerseyStatus) => {
    const key = `${player.id}-${attire}`;
    setToggling(key);
    const next: JerseyStatus = current === 'required' ? 'not_required' : 'required';
    const url = player.is_dummy
      ? `/jerseys/dummy/${player.id}/status`
      : `/jerseys/${player.id}/status`;
    try {
      await api.patch(url, { attire, status: next });
      setPlayers(ps => ps.map(p =>
        p.id === player.id && p.is_dummy === player.is_dummy
          ? { ...p, [`${attire}_jersey_status`]: next }
          : p
      ));
    } finally { setToggling(null); }
  };

  const handleDeleteDummy = async (id: number) => {
    if (!confirm('Remove this extra entry?')) return;
    await api.delete(`/jerseys/dummy/${id}`);
    setPlayers(ps => ps.filter(p => !(p.id === id && p.is_dummy === 1)));
  };

  // Check jersey number uniqueness on blur
  const checkJerseyNum = async (num: string, skipExtraId?: number) => {
    if (!num) { setJerseyNumError(''); return; }
    try {
      const { data } = await api.get('/jerseys/check-number', {
        params: { number: num, ...(skipExtraId ? { skip_extra_id: skipExtraId } : {}) },
      });
      setJerseyNumError(data.taken ? `Jersey #${num} is already assigned to ${data.by}` : '');
    } catch { /* ignore */ }
  };

  const handleDummySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (jerseyNumError) return;
    setDSubmitting(true); setDError('');
    try {
      await api.post('/jerseys/dummy', dForm);
      setShowDummyForm(false);
      setDForm(emptyDummy);
      setJerseyNumError('');
      load();
    } catch (err: any) {
      setDError(err.response?.data?.error || 'Failed to add entry');
    } finally { setDSubmitting(false); }
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
    doc.text(`Merchandise — ${attire === 'whites' ? 'Whites' : 'Colored'} (Required Only)`, pageW / 2, y, { align: 'center' });
    y += 6;
    doc.setFontSize(9); doc.setTextColor(120);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, pageW / 2, y, { align: 'center' });
    doc.setTextColor(0);
    y += 8;

    // Only "required" rows
    const pdfRows = players
      .filter(p => (attire === 'whites' ? p.whites_jersey_status : p.colored_jersey_status) === 'required')
      .map((p, i) => [
        i + 1,
        p.name + (p.is_dummy ? ' ★' : ''),
        p.jersey_number || '—',
        p.jersey_label  || '—',
        attire === 'whites' ? (p.whites_tshirt_size || '—') : (p.colored_tshirt_size || '—'),
        attire === 'whites' ? (p.whites_lower_size  || '—') : (p.colored_lower_size  || '—'),
        attire === 'whites' ? (p.whites_sleeve      || '—') : (p.colored_sleeve      || '—'),
      ]);

    if (pdfRows.length === 0) {
      doc.setFontSize(10); doc.setTextColor(150);
      doc.text('No required entries for this attire.', pageW / 2, y + 10, { align: 'center' });
    } else {
      autoTable(doc, {
        startY: y,
        head: [['#', 'Name', 'Jersey #', 'Label', 'T-Shirt', 'Lower', 'Sleeve']],
        body: pdfRows,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [30, 58, 138] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
    }

    doc.save(`merchandise-${attire}-required-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const statusField = attire === 'whites' ? 'whites_jersey_status' : 'colored_jersey_status';
  const required    = players.filter(p => p[statusField] === 'required').length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Shirt size={26} className="text-blue-700" /> Merchandise
        </h1>
        <div className="flex gap-2 flex-wrap">
          {canEdit && (
            <button onClick={() => { setShowDummyForm(true); setDError(''); setDForm(emptyDummy); setJerseyNumError(''); }}
              className="btn-secondary flex items-center gap-2">
              <Plus size={16} /> Add Extra Entry
            </button>
          )}
          <button onClick={exportPdf} className="btn-primary flex items-center gap-2">
            <Download size={16} /> Export PDF
          </button>
        </div>
      </div>

      {isPlayerOnly && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-4 py-2 text-sm mb-4">
          You have read-only access. Download PDF to get a printable copy.
        </div>
      )}

      {/* Attire tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(['whites', 'colored'] as Attire[]).map(a => (
          <button key={a} onClick={() => setAttire(a)}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${attire === a ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {a === 'whites' ? '⚪ Whites' : '🔵 Colored'}
          </button>
        ))}
        {!loading && (
          <span className="ml-auto text-sm text-gray-500 self-center">
            <span className="text-green-700 font-semibold">{required}</span> required ·{' '}
            <span className="text-red-600 font-semibold">{players.length - required}</span> not required
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
                  {canEdit && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {players.map((p, i) => {
                  const status: JerseyStatus = attire === 'whites' ? p.whites_jersey_status : p.colored_jersey_status;
                  const key = `${p.id}-${attire}`;
                  return (
                    <tr key={`${p.is_dummy}-${p.id}`}
                      className={`hover:bg-gray-50 transition-colors ${p.is_dummy ? 'bg-yellow-50/40' : ''}`}>
                      <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {p.name}
                        {!!p.is_dummy && <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-normal">Extra</span>}
                      </td>
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
                          <button onClick={() => toggleStatus(p, status)} disabled={toggling === key}
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
                      {canEdit && (
                        <td className="px-4 py-3 text-right">
                          {!!p.is_dummy && (
                            <button onClick={() => handleDeleteDummy(p.id)}
                              className="p-1 text-gray-400 hover:text-red-600 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {players.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Shirt size={40} className="mx-auto mb-3 opacity-30" />
              <p>No entries found</p>
            </div>
          )}
        </div>
      )}

      {/* Add Extra Entry Modal */}
      {showDummyForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Plus size={18} className="text-blue-600" /> Add Extra Entry
              </h2>
              <button onClick={() => setShowDummyForm(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleDummySubmit} className="p-6 space-y-4">
              {dError && <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm">{dError}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input className="input-field" value={dForm.name} onChange={e => setDForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Spare Jersey" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jersey Number</label>
                  <input className={`input-field ${jerseyNumError ? 'border-red-400' : ''}`}
                    value={dForm.jersey_number}
                    onChange={e => { setDForm(f => ({ ...f, jersey_number: e.target.value })); setJerseyNumError(''); }}
                    onBlur={e => checkJerseyNum(e.target.value)}
                    placeholder="e.g. 99" />
                  {jerseyNumError && <p className="text-xs text-red-600 mt-1">{jerseyNumError}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jersey Label</label>
                  <input className="input-field" value={dForm.jersey_label} onChange={e => setDForm(f => ({ ...f, jersey_label: e.target.value }))} placeholder="e.g. RESERVE" />
                </div>
              </div>

              {/* Whites */}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">⚪ Whites</p>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {([['T-Shirt', 'whites_tshirt_size', TSHIRT_SIZES], ['Lower', 'whites_lower_size', LOWER_SIZES], ['Sleeve', 'whites_sleeve', SLEEVES]] as [string, keyof typeof emptyDummy, string[]][]).map(([label, key, opts]) => (
                    <div key={key}>
                      <label className="block text-xs text-gray-500 mb-1">{label}</label>
                      <select className="input-field text-sm" value={(dForm as any)[key]} onChange={e => setDForm(f => ({ ...f, [key]: e.target.value }))}>
                        {opts.map(s => <option key={s} value={s}>{s || '—'}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Status</label>
                  <select className="input-field text-sm" value={dForm.whites_jersey_status} onChange={e => setDForm(f => ({ ...f, whites_jersey_status: e.target.value as JerseyStatus }))}>
                    <option value="required">Required</option>
                    <option value="not_required">Not Required</option>
                  </select>
                </div>
              </div>

              {/* Colored */}
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">🔵 Colored</p>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {([['T-Shirt', 'colored_tshirt_size', TSHIRT_SIZES], ['Lower', 'colored_lower_size', LOWER_SIZES], ['Sleeve', 'colored_sleeve', SLEEVES]] as [string, keyof typeof emptyDummy, string[]][]).map(([label, key, opts]) => (
                    <div key={key}>
                      <label className="block text-xs text-gray-500 mb-1">{label}</label>
                      <select className="input-field text-sm" value={(dForm as any)[key]} onChange={e => setDForm(f => ({ ...f, [key]: e.target.value }))}>
                        {opts.map(s => <option key={s} value={s}>{s || '—'}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Status</label>
                  <select className="input-field text-sm" value={dForm.colored_jersey_status} onChange={e => setDForm(f => ({ ...f, colored_jersey_status: e.target.value as JerseyStatus }))}>
                    <option value="required">Required</option>
                    <option value="not_required">Not Required</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowDummyForm(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={dSubmitting || !!jerseyNumError} className="btn-primary">
                  {dSubmitting ? 'Saving…' : 'Add Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

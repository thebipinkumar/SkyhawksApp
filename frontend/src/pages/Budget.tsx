import { useEffect, useState, FormEvent } from 'react';
import api from '../utils/api';
import { BudgetEntry, BudgetSummary } from '../types';
import { DollarSign, Plus, X, TrendingUp, TrendingDown, Edit2, Trash2, FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const REVENUE_CATEGORIES = ['Sponsorship', 'Membership Fee', 'Match Fee', 'Event Income', 'Donation', 'Other'];
const EXPENSE_CATEGORIES = ['Equipment', 'Ground Booking', 'Travel', 'Accommodation', 'Uniforms', 'Coaching', 'Administration', 'Other'];

const emptyForm = { type: 'revenue', category: REVENUE_CATEGORIES[0], amount: '', description: '', entry_date: new Date().toISOString().split('T')[0] };

const toDataURL = (url: string): Promise<string> =>
  fetch(url).then(r => r.blob()).then(blob => new Promise(resolve => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  }));

export default function Budget() {
  const { user } = useAuth();
  const { club } = useClub();
  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<BudgetEntry | null>(null);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const isAdmin = user?.role === 'admin';

  const load = async () => {
    const { data } = await api.get('/budget');
    setEntries(data.entries); setSummary(data.summary); setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(emptyForm); setEditEntry(null); setShowForm(true); setError(''); };
  const openEdit = (e: BudgetEntry) => {
    setForm({ type: e.type, category: e.category, amount: String(e.amount), description: e.description, entry_date: e.entry_date });
    setEditEntry(e); setShowForm(true); setError('');
  };

  const categories = form.type === 'revenue' ? REVENUE_CATEGORIES : EXPENSE_CATEGORIES;

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault(); setSubmitting(true); setError('');
    try {
      editEntry ? await api.put(`/budget/${editEntry.id}`, form) : await api.post('/budget', form);
      setShowForm(false); load();
    } catch (err: any) { setError(err.response?.data?.error || 'Failed to save entry'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this entry?')) return;
    await api.delete(`/budget/${id}`); load();
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD', maximumFractionDigits: 0 }).format(n || 0);
  const filtered = filterType === 'all' ? entries : entries.filter(e => e.type === filterType);

  const generatePDF = async () => {
    setGeneratingPdf(true);
    try {
      const doc = new jsPDF();
      const clubName = club?.club_name || 'Skyhawks Cricket Club';
      const pageW = doc.internal.pageSize.getWidth();
      let y = 15;

      // Logo
      if (club?.logo_url) {
        try {
          const dataUrl = await toDataURL(club.logo_url);
          doc.addImage(dataUrl, 'PNG', pageW / 2 - 12, y, 24, 24);
          y += 28;
        } catch { /* skip logo if CORS or network fails */ }
      }

      // Header
      doc.setFontSize(18); doc.setFont('helvetica', 'bold');
      doc.text(clubName, pageW / 2, y, { align: 'center' });
      y += 8;
      doc.setFontSize(13); doc.setFont('helvetica', 'normal');
      doc.text('Budget Balance Sheet', pageW / 2, y, { align: 'center' });
      y += 6;
      doc.setFontSize(9); doc.setTextColor(120);
      doc.text(`Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, pageW / 2, y, { align: 'center' });
      doc.setTextColor(0);
      y += 8;

      // Summary boxes
      if (summary) {
        doc.setDrawColor(220); doc.setFillColor(240, 253, 244); doc.roundedRect(14, y, 56, 18, 2, 2, 'FD');
        doc.setFontSize(8); doc.setTextColor(80); doc.text('Total Revenue', 42, y + 6, { align: 'center' });
        doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(22, 163, 74);
        doc.text(fmt(summary.total_revenue), 42, y + 13, { align: 'center' });

        doc.setFillColor(254, 242, 242); doc.roundedRect(77, y, 56, 18, 2, 2, 'FD');
        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(80); doc.text('Total Expense', 105, y + 6, { align: 'center' });
        doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(220, 38, 38);
        doc.text(fmt(summary.total_expense), 105, y + 13, { align: 'center' });

        const balColor = summary.net_balance >= 0 ? [29, 78, 216] : [234, 88, 12];
        doc.setFillColor(239, 246, 255); doc.roundedRect(140, y, 56, 18, 2, 2, 'FD');
        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(80); doc.text('Net Balance', 168, y + 6, { align: 'center' });
        doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(balColor[0], balColor[1], balColor[2]);
        doc.text(fmt(summary.net_balance), 168, y + 13, { align: 'center' });
        doc.setTextColor(0);
        y += 26;
      }

      // Transactions table
      autoTable(doc, {
        startY: y,
        head: [['Date', 'Type', 'Category', 'Description', 'Amount', 'By']],
        body: entries.map(e => [
          e.entry_date,
          e.type.toUpperCase(),
          e.category,
          e.description,
          (e.type === 'revenue' ? '+' : '-') + fmt(e.amount),
          e.created_by_name,
        ]),
        headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 18 },
          4: { halign: 'right', cellWidth: 28 },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 1) {
            data.cell.styles.textColor = data.cell.raw === 'REVENUE' ? [22, 163, 74] : [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          }
          if (data.section === 'body' && data.column.index === 4) {
            const isRevenue = String(data.cell.raw).startsWith('+');
            data.cell.styles.textColor = isRevenue ? [22, 163, 74] : [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          }
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 },
      });

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8); doc.setTextColor(160);
        doc.text(`${clubName} — Confidential`, 14, doc.internal.pageSize.getHeight() - 8);
        doc.text(`Page ${i} of ${pageCount}`, pageW - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
      }

      doc.save(`${clubName.replace(/\s+/g, '_')}_Budget_${new Date().toISOString().split('T')[0]}.pdf`);
    } finally { setGeneratingPdf(false); }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <DollarSign size={26} className="text-green-600" /> Team Budget
        </h1>
        <div className="flex gap-2">
          <button onClick={generatePDF} disabled={generatingPdf || loading}
            className="btn-secondary flex items-center gap-2">
            <FileText size={16} /> {generatingPdf ? 'Generating…' : 'Download PDF'}
          </button>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus size={18} /> Add Entry
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="card border-l-4 border-green-500">
            <div className="flex items-center gap-3">
              <TrendingUp size={24} className="text-green-600" />
              <div><p className="text-sm text-gray-500">Total Revenue</p><p className="text-2xl font-bold text-green-700">{fmt(summary.total_revenue)}</p></div>
            </div>
          </div>
          <div className="card border-l-4 border-red-500">
            <div className="flex items-center gap-3">
              <TrendingDown size={24} className="text-red-600" />
              <div><p className="text-sm text-gray-500">Total Expense</p><p className="text-2xl font-bold text-red-700">{fmt(summary.total_expense)}</p></div>
            </div>
          </div>
          <div className={`card border-l-4 ${summary.net_balance >= 0 ? 'border-blue-500' : 'border-orange-500'}`}>
            <div className="flex items-center gap-3">
              <DollarSign size={24} className={summary.net_balance >= 0 ? 'text-blue-600' : 'text-orange-600'} />
              <div>
                <p className="text-sm text-gray-500">Net Balance</p>
                <p className={`text-2xl font-bold ${summary.net_balance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>{fmt(summary.net_balance)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {['all', 'revenue', 'expense'].map(f => (
          <button key={f} onClick={() => setFilterType(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filterType === f ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <DollarSign size={48} className="mx-auto mb-3 opacity-30" /><p>No entries found</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Category</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Description</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Amount</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">By</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(entry => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{entry.entry_date}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${entry.type === 'revenue' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{entry.type}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{entry.category}</td>
                  <td className="px-4 py-3 text-gray-700">{entry.description}</td>
                  <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${entry.type === 'revenue' ? 'text-green-700' : 'text-red-700'}`}>
                    {entry.type === 'revenue' ? '+' : '-'}{fmt(entry.amount)}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{entry.created_by_name}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(entry)} className="p-1 text-gray-400 hover:text-blue-600"><Edit2 size={14} /></button>
                      {isAdmin && <button onClick={() => handleDelete(entry.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold">{editEntry ? 'Edit Entry' : 'Add Budget Entry'}</h2>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm">{error}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                  <select className="input-field" value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value, category: e.target.value === 'revenue' ? REVENUE_CATEGORIES[0] : EXPENSE_CATEGORIES[0] }))}>
                    <option value="revenue">Revenue</option>
                    <option value="expense">Expense</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <select className="input-field" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {categories.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹) *</label>
                <input type="number" min="0.01" step="0.01" className="input-field" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <input className="input-field" placeholder="Brief description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input type="date" className="input-field" value={form.entry_date} onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))} required />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? 'Saving...' : editEntry ? 'Update' : 'Add Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

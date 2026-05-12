import { useEffect, useState, FormEvent } from 'react';
import api from '../utils/api';
import { BudgetEntry, BudgetSummary } from '../types';
import { DollarSign, Plus, X, TrendingUp, TrendingDown, Edit2, Trash2, FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const REVENUE_CATEGORIES = ['Sponsorship', 'Membership Fee', 'Match Fee', 'Tournament Fee', 'Merchandise', 'Event Income', 'Donation', 'Other'];
const EXPENSE_CATEGORIES = ['Equipment', 'Ground Booking', 'Travel', 'Accommodation', 'Uniforms', 'Coaching', 'Administration', 'Tournament Fee', 'Match Fee', 'Merchandise', 'Other'];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 2019 }, (_, i) => String(CURRENT_YEAR - i));
const MONTHS = [
  { value: 'all', label: 'All Months' },
  { value: '01', label: 'January' }, { value: '02', label: 'February' },
  { value: '03', label: 'March' },   { value: '04', label: 'April' },
  { value: '05', label: 'May' },     { value: '06', label: 'June' },
  { value: '07', label: 'July' },    { value: '08', label: 'August' },
  { value: '09', label: 'September' },{ value: '10', label: 'October' },
  { value: '11', label: 'November' },{ value: '12', label: 'December' },
];

const PAGE_SIZE = 20;

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
  const [allTimeSummary, setAllTimeSummary] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<BudgetEntry | null>(null);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const userRoles: string[] = (user as any)?.roles ?? (user?.role ? [user.role] : []);
  const isAdmin = userRoles.includes('admin');
  const [filterYear, setFilterYear] = useState(String(CURRENT_YEAR));
  const [filterMonth, setFilterMonth] = useState('all');
  const [page, setPage] = useState(1);

  const load = async () => {
    const { data } = await api.get('/budget');
    setEntries(data.entries); setAllTimeSummary(data.summary); setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { setPage(1); }, [filterType, filterYear, filterMonth]);

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

  // Entries for the selected period (year+month only, ignoring type — used for period summary cards)
  const periodEntries = entries.filter(e => {
    if (filterYear !== 'all' && e.entry_date.slice(0, 4) !== filterYear) return false;
    if (filterMonth !== 'all' && e.entry_date.slice(5, 7) !== filterMonth) return false;
    return true;
  });

  // Entries for the table (all active filters including type)
  const filtered = periodEntries.filter(e =>
    filterType === 'all' || e.type === filterType
  );

  const periodSummary = {
    total_revenue: periodEntries.filter(e => e.type === 'revenue').reduce((s, e) => s + e.amount, 0),
    total_expense: periodEntries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0),
    get net_balance() { return this.total_revenue - this.total_expense; },
  };

  const isPeriodFiltered = filterYear !== 'all' || filterMonth !== 'all';

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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

      // All-time summary boxes
      if (allTimeSummary) {
        doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(100);
        doc.text('ALL TIME', 14, y + 4);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(0);

        doc.setDrawColor(220); doc.setFillColor(240, 253, 244); doc.roundedRect(14, y + 6, 56, 16, 2, 2, 'FD');
        doc.setFontSize(7); doc.setTextColor(80); doc.text('Total Revenue', 42, y + 12, { align: 'center' });
        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(22, 163, 74);
        doc.text(fmt(allTimeSummary.total_revenue), 42, y + 18, { align: 'center' });

        doc.setFillColor(254, 242, 242); doc.roundedRect(77, y + 6, 56, 16, 2, 2, 'FD');
        doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(80); doc.text('Total Expense', 105, y + 12, { align: 'center' });
        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(220, 38, 38);
        doc.text(fmt(allTimeSummary.total_expense), 105, y + 18, { align: 'center' });

        const balColor = allTimeSummary.net_balance >= 0 ? [29, 78, 216] : [234, 88, 12];
        doc.setFillColor(239, 246, 255); doc.roundedRect(140, y + 6, 56, 16, 2, 2, 'FD');
        doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(80); doc.text('Net Balance', 168, y + 12, { align: 'center' });
        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(balColor[0], balColor[1], balColor[2]);
        doc.text(fmt(allTimeSummary.net_balance), 168, y + 18, { align: 'center' });
        doc.setTextColor(0);
        y += 30;
      }

      // Period summary boxes (only if date filter active)
      if (isPeriodFiltered) {
        const periodLabel = `${filterMonth !== 'all' ? MONTHS.find(m => m.value === filterMonth)?.label + ' ' : ''}${filterYear !== 'all' ? filterYear : ''}`;
        doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(100);
        doc.text(`SELECTED PERIOD — ${periodLabel.toUpperCase()}`, 14, y + 4);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(0);

        doc.setDrawColor(200); doc.setFillColor(236, 253, 245); doc.roundedRect(14, y + 6, 56, 16, 2, 2, 'FD');
        doc.setFontSize(7); doc.setTextColor(80); doc.text('Revenue', 42, y + 12, { align: 'center' });
        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(22, 163, 74);
        doc.text(fmt(periodSummary.total_revenue), 42, y + 18, { align: 'center' });

        doc.setFillColor(255, 241, 242); doc.roundedRect(77, y + 6, 56, 16, 2, 2, 'FD');
        doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(80); doc.text('Expense', 105, y + 12, { align: 'center' });
        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(220, 38, 38);
        doc.text(fmt(periodSummary.total_expense), 105, y + 18, { align: 'center' });

        const pBalColor = periodSummary.net_balance >= 0 ? [29, 78, 216] : [234, 88, 12];
        doc.setFillColor(239, 246, 255); doc.roundedRect(140, y + 6, 56, 16, 2, 2, 'FD');
        doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(80); doc.text('Net Balance', 168, y + 12, { align: 'center' });
        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(pBalColor[0], pBalColor[1], pBalColor[2]);
        doc.text(fmt(periodSummary.net_balance), 168, y + 18, { align: 'center' });
        doc.setTextColor(0);
        y += 30;
      }

      // Filter label
      const filterLabel = [
        filterYear !== 'all' ? filterYear : 'All Years',
        filterMonth !== 'all' ? (MONTHS.find(m => m.value === filterMonth)?.label ?? filterMonth) : 'All Months',
        filterType !== 'all' ? filterType.charAt(0).toUpperCase() + filterType.slice(1) : 'All Types',
      ].join(' · ');
      doc.setFontSize(9); doc.setTextColor(100);
      doc.text(`Filter: ${filterLabel}`, pageW / 2, y, { align: 'center' });
      doc.setTextColor(0);
      y += 6;

      // Transactions table
      autoTable(doc, {
        startY: y,
        head: [['Date', 'Type', 'Category', 'Description', 'Amount', 'By']],
        body: filtered.map(e => [
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

      {/* All-time summary cards — always shown */}
      {!loading && allTimeSummary && (
        <div className="mb-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">All Time</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card border-l-4 border-green-500">
              <div className="flex items-center gap-3">
                <TrendingUp size={24} className="text-green-600" />
                <div><p className="text-sm text-gray-500">Total Revenue</p><p className="text-2xl font-bold text-green-700">{fmt(allTimeSummary.total_revenue)}</p></div>
              </div>
            </div>
            <div className="card border-l-4 border-red-500">
              <div className="flex items-center gap-3">
                <TrendingDown size={24} className="text-red-600" />
                <div><p className="text-sm text-gray-500">Total Expense</p><p className="text-2xl font-bold text-red-700">{fmt(allTimeSummary.total_expense)}</p></div>
              </div>
            </div>
            <div className={`card border-l-4 ${allTimeSummary.net_balance >= 0 ? 'border-blue-500' : 'border-orange-500'}`}>
              <div className="flex items-center gap-3">
                <DollarSign size={24} className={allTimeSummary.net_balance >= 0 ? 'text-blue-600' : 'text-orange-600'} />
                <div>
                  <p className="text-sm text-gray-500">Net Balance</p>
                  <p className={`text-2xl font-bold ${allTimeSummary.net_balance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>{fmt(allTimeSummary.net_balance)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Period summary cards — shown only when a date filter is active */}
      {!loading && isPeriodFiltered && (
        <div className="mb-6 mt-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Selected Period — {filterMonth !== 'all' ? MONTHS.find(m => m.value === filterMonth)?.label : 'All Months'}{filterYear !== 'all' ? ` ${filterYear}` : ''}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card border-l-4 border-green-400 bg-green-50/40">
              <div className="flex items-center gap-3">
                <TrendingUp size={22} className="text-green-600" />
                <div><p className="text-sm text-gray-500">Revenue</p><p className="text-xl font-bold text-green-700">{fmt(periodSummary.total_revenue)}</p></div>
              </div>
            </div>
            <div className="card border-l-4 border-red-400 bg-red-50/40">
              <div className="flex items-center gap-3">
                <TrendingDown size={22} className="text-red-600" />
                <div><p className="text-sm text-gray-500">Expense</p><p className="text-xl font-bold text-red-700">{fmt(periodSummary.total_expense)}</p></div>
              </div>
            </div>
            <div className={`card border-l-4 ${periodSummary.net_balance >= 0 ? 'border-blue-400 bg-blue-50/40' : 'border-orange-400 bg-orange-50/40'}`}>
              <div className="flex items-center gap-3">
                <DollarSign size={22} className={periodSummary.net_balance >= 0 ? 'text-blue-600' : 'text-orange-600'} />
                <div>
                  <p className="text-sm text-gray-500">Net Balance</p>
                  <p className={`text-xl font-bold ${periodSummary.net_balance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>{fmt(periodSummary.net_balance)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {!loading && !isPeriodFiltered && <div className="mb-6" />}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Type filter */}
        {['all', 'revenue', 'expense'].map(f => (
          <button key={f} onClick={() => setFilterType(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filterType === f ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <div className="h-5 border-l border-gray-200 mx-1" />
        {/* Year filter */}
        <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
          className="input-field py-1.5 text-sm w-auto pr-8">
          <option value="all">All Years</option>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {/* Month filter */}
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
          className="input-field py-1.5 text-sm w-auto pr-8">
          {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        {filtered.length > 0 && (
          <span className="text-xs text-gray-400 ml-1">{filtered.length} entr{filtered.length === 1 ? 'y' : 'ies'}</span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <DollarSign size={48} className="mx-auto mb-3 opacity-30" /><p>No entries found</p>
        </div>
      ) : (
        <>
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
                {paginated.map(entry => (
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed">← Prev</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) => p === '...'
                    ? <span key={`ellipsis-${i}`} className="px-2">…</span>
                    : <button key={p} onClick={() => setPage(p as number)}
                        className={`px-3 py-1.5 rounded-lg ${page === p ? 'bg-blue-700 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>{p}</button>
                  )}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed">Next →</button>
              </div>
            </div>
          )}
        </>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (S$) *</label>
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

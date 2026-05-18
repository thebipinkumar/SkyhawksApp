import { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import { MembershipFee, MembershipPayment, MembershipPaymentStatus } from '../types';
import { DollarSign, CheckCircle, Clock, XCircle, UserCircle, Edit2, Save, X, Plus } from 'lucide-react';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR + 1 - i); // next year down to 5 years ago

const STATUS_CONFIG: Record<MembershipPaymentStatus, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  paid:    { label: 'Paid',    bg: 'bg-green-100',  text: 'text-green-800',  icon: <CheckCircle size={14} /> },
  pending: { label: 'Pending', bg: 'bg-amber-100',  text: 'text-amber-800',  icon: <Clock size={14} /> },
  waived:  { label: 'Waived',  bg: 'bg-gray-100',   text: 'text-gray-600',   icon: <XCircle size={14} /> },
};

interface EditFeeState { year: number; amount: string; }
interface EditPaymentState { userId: number; status: MembershipPaymentStatus; paid_date: string; notes: string; }

export default function MembershipPage() {
  const [activeTab, setActiveTab] = useState<'fees' | 'payments'>('payments');
  const [fees, setFees] = useState<MembershipFee[]>([]);
  const [payments, setPayments] = useState<MembershipPayment[]>([]);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fee editing
  const [editFee, setEditFee] = useState<EditFeeState | null>(null);
  const [newFeeYear, setNewFeeYear] = useState(String(CURRENT_YEAR));
  const [newFeeAmount, setNewFeeAmount] = useState('');
  const [showFeeForm, setShowFeeForm] = useState(false);

  // Payment editing
  const [editPayment, setEditPayment] = useState<EditPaymentState | null>(null);

  const notify = (msg: string, isErr = false) => {
    if (isErr) setError(msg); else setSuccess(msg);
    setTimeout(() => { setError(''); setSuccess(''); }, 3500);
  };

  const loadFees = useCallback(async () => {
    const res = await api.get('/membership/fees');
    setFees(res.data);
  }, []);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/membership/payments?year=${selectedYear}`);
      setPayments(res.data);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    loadFees();
  }, [loadFees]);

  useEffect(() => {
    if (activeTab === 'payments') loadPayments();
  }, [activeTab, loadPayments]);

  // ── Fee Actions ──
  const handleSaveFee = async (year: number, amount: string) => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      notify('Enter a valid positive amount', true); return;
    }
    setSaving(true);
    try {
      await api.put(`/membership/fees/${year}`, { amount: Number(amount), currency: 'SGD' });
      await loadFees();
      setEditFee(null);
      setShowFeeForm(false);
      setNewFeeYear(String(CURRENT_YEAR));
      setNewFeeAmount('');
      notify(`Fee for ${year} saved successfully.`);
    } catch (e: any) {
      notify(e.response?.data?.error || 'Failed to save fee', true);
    } finally {
      setSaving(false);
    }
  };

  // ── Payment Actions ──
  const handleUpdatePayment = async () => {
    if (!editPayment) return;
    setSaving(true);
    try {
      await api.patch(`/membership/payments/${editPayment.userId}`, {
        year: selectedYear,
        status: editPayment.status,
        paid_date: editPayment.paid_date || null,
        notes: editPayment.notes || null,
      });
      await loadPayments();
      setEditPayment(null);
      notify('Payment status updated.');
    } catch (e: any) {
      notify(e.response?.data?.error || 'Failed to update', true);
    } finally {
      setSaving(false);
    }
  };

  const feeForYear = fees.find(f => f.year === selectedYear);

  const stats = {
    paid:    payments.filter(p => p.status === 'paid').length,
    pending: payments.filter(p => p.status === 'pending').length,
    waived:  payments.filter(p => p.status === 'waived').length,
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <DollarSign size={26} className="text-amber-600" /> Membership Fees
        </h1>
        <p className="text-gray-500 text-sm mt-1">Manage yearly fee amounts and track member payment status.</p>
      </div>

      {/* Toast */}
      {error   && <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-700 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-300 text-green-700 rounded-lg text-sm">{success}</div>}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {(['payments', 'fees'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {tab === 'payments' ? 'Member Payments' : 'Fee Settings'}
          </button>
        ))}
      </div>

      {/* ═══ PAYMENTS TAB ═══ */}
      {activeTab === 'payments' && (
        <div>
          {/* Year + fee info */}
          <div className="flex flex-wrap items-center gap-4 mb-5">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Year:</label>
              <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
                className="input-field !w-28 !py-1.5 text-sm">
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            {feeForYear ? (
              <span className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 font-medium">
                Fee: S$ {feeForYear.amount.toFixed(2)}
              </span>
            ) : (
              <span className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 italic">
                No fee set for {selectedYear} — go to Fee Settings to add one.
              </span>
            )}
          </div>

          {/* Summary badges */}
          {!loading && (
            <div className="flex flex-wrap gap-3 mb-5">
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-100 text-green-800 text-sm font-medium">
                <CheckCircle size={15} /> {stats.paid} Paid
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 text-sm font-medium">
                <Clock size={15} /> {stats.pending} Pending
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-sm font-medium">
                <XCircle size={15} /> {stats.waived} Waived
              </span>
            </div>
          )}

          {loading ? (
            <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)}</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Member</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Paid Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Notes</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payments.map(p => {
                    const cfg = STATUS_CONFIG[p.status];
                    const isEditing = editPayment?.userId === p.user_id;
                    return (
                      <tr key={p.user_id} className={`hover:bg-gray-50 transition-colors ${isEditing ? 'bg-blue-50' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {p.avatar_url
                              ? <img src={p.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                              : <UserCircle size={28} className="text-gray-400 shrink-0" />}
                            <div>
                              <p className="font-medium text-gray-800">{p.name}</p>
                              <p className="text-xs text-gray-400 hidden sm:block">{p.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <select value={editPayment.status}
                              onChange={e => setEditPayment({ ...editPayment, status: e.target.value as MembershipPaymentStatus })}
                              className="input-field !py-1 !px-2 text-sm w-28">
                              <option value="pending">Pending</option>
                              <option value="paid">Paid</option>
                              <option value="waived">Waived</option>
                            </select>
                          ) : (
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                              {cfg.icon} {cfg.label}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          {isEditing ? (
                            <input type="date" value={editPayment.paid_date}
                              onChange={e => setEditPayment({ ...editPayment, paid_date: e.target.value })}
                              className="input-field !py-1 !px-2 text-sm w-36" />
                          ) : (
                            <span className="text-gray-500 text-sm">
                              {p.paid_date ? new Date(p.paid_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          {isEditing ? (
                            <input type="text" placeholder="Optional note" value={editPayment.notes}
                              onChange={e => setEditPayment({ ...editPayment, notes: e.target.value })}
                              className="input-field !py-1 !px-2 text-sm" />
                          ) : (
                            <span className="text-gray-400 text-sm">{p.notes || '—'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={handleUpdatePayment} disabled={saving}
                                className="p-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-50" title="Save">
                                <Save size={15} />
                              </button>
                              <button onClick={() => setEditPayment(null)}
                                className="p-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700" title="Cancel">
                                <X size={15} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setEditPayment({ userId: p.user_id, status: p.status, paid_date: p.paid_date || '', notes: p.notes || '' })}
                              className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500" title="Edit">
                              <Edit2 size={15} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {payments.length === 0 && (
                    <tr><td colSpan={5} className="text-center text-gray-400 py-10">No active members found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══ FEES TAB ═══ */}
      {activeTab === 'fees' && (
        <div>
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm text-gray-500">Set the annual membership fee amount per year.</p>
            <button onClick={() => setShowFeeForm(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors">
              <Plus size={16} /> Add Year
            </button>
          </div>

          {/* Add fee form */}
          {showFeeForm && (
            <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Year</label>
                <select value={newFeeYear} onChange={e => setNewFeeYear(e.target.value)}
                  className="input-field !w-24 !py-1.5 text-sm">
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Amount (S$)</label>
                <input type="number" min="0" step="0.01" placeholder="e.g. 120.00"
                  value={newFeeAmount} onChange={e => setNewFeeAmount(e.target.value)}
                  className="input-field !w-36 !py-1.5 text-sm" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleSaveFee(Number(newFeeYear), newFeeAmount)} disabled={saving}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 flex items-center gap-1">
                  <Save size={14} /> Save
                </button>
                <button onClick={() => { setShowFeeForm(false); setNewFeeAmount(''); }}
                  className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium rounded-lg flex items-center gap-1">
                  <X size={14} /> Cancel
                </button>
              </div>
            </div>
          )}

          {fees.length === 0 ? (
            <div className="text-center py-14 text-gray-400">
              <DollarSign size={40} className="mx-auto mb-2 opacity-30" />
              <p>No fee records yet. Click "Add Year" to create one.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full min-w-[400px] text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Year</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Amount</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Last Updated</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {fees.map(fee => {
                    const isEditing = editFee?.year === fee.year;
                    return (
                      <tr key={fee.year} className={`hover:bg-gray-50 ${isEditing ? 'bg-blue-50' : ''}`}>
                        <td className="px-4 py-3 font-semibold text-gray-800">
                          {fee.year}
                          {fee.year === CURRENT_YEAR && (
                            <span className="ml-2 text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full">Current</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <input type="number" min="0" step="0.01" value={editFee.amount}
                              onChange={e => setEditFee({ ...editFee, amount: e.target.value })}
                              className="input-field !py-1 !px-2 text-sm w-32" />
                          ) : (
                            <span className="font-medium text-amber-700">S$ {fee.amount.toFixed(2)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-400 hidden sm:table-cell text-sm">
                          {new Date(fee.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => handleSaveFee(editFee.year, editFee.amount)} disabled={saving}
                                className="p-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-50" title="Save">
                                <Save size={15} />
                              </button>
                              <button onClick={() => setEditFee(null)}
                                className="p-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700" title="Cancel">
                                <X size={15} />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => setEditFee({ year: fee.year, amount: String(fee.amount) })}
                              className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500" title="Edit">
                              <Edit2 size={15} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

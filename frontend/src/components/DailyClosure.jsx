import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import api from '../utils/api';
import { useCurrentRole } from '../utils/auth';

function formatBDT(value) {
  return `৳ ${Number(value || 0).toLocaleString()}`;
}

function DailyClosure() {
  const role = useCurrentRole();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [notes, setNotes] = useState('');
  const [success, setSuccess] = useState(false);

  async function fetchPreview() {
    try {
      setLoading(true);
      const { data } = await api.get('/reports/preview');
      setData(data);
    } catch (err) {
      console.error('Failed to fetch preview', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPreview();
  }, []);

  async function handleCloseDay() {
    if (!window.confirm('Are you sure you want to close the day and lock the records? This action cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);
      await api.post('/reports/close-day', { date: data.date, notes });
      setSuccess(true);
      fetchPreview();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to close day');
    } finally {
      setLoading(false);
    }
  }

  if (role !== 'admin') {
    return null;
  }

  return (
    <div className="rounded-3xl bg-white p-6 shadow-[0_12px_40px_rgba(0,31,42,0.06)] border border-slate-100">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="[font-family:Manrope,ui-sans-serif,system-ui] text-xl font-bold text-[#001f2a]">Daily Z-Report</h2>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-1">Shop Closer & Cash Verification</p>
        </div>
        <div className="h-10 w-10 flex items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04z" />
          </svg>
        </div>
      </div>

      {loading && !data ? (
        <div className="py-8 text-center text-sm text-slate-500">Calculating today's totals...</div>
      ) : data ? (
        <div className="mt-6 space-y-4">
          {data.isAlreadyLocked ? (
            <div className="rounded-2xl bg-emerald-50 p-4 border border-emerald-100">
              <div className="flex items-center gap-3 text-emerald-800">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-bold">Business Closed for {dayjs(data.date).format('DD MMM')}</span>
              </div>
              <p className="mt-2 text-sm text-emerald-700">Financials are locked and archived. Check Discord for the full summary.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Opening Cash</p>
                  <p className="mt-1 text-lg font-bold text-slate-700">{formatBDT(data.openingBalance)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Transactions</p>
                  <p className="mt-1 text-lg font-bold text-slate-700">{data.transactionCount}</p>
                </div>
                <div className="rounded-2xl bg-emerald-50/50 p-4">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Total Income</p>
                  <p className="mt-1 text-lg font-extrabold text-emerald-700">+ {formatBDT(data.totalIncome)}</p>
                </div>
                <div className="rounded-2xl bg-red-50/50 p-4">
                  <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest">Total Expenses</p>
                  <p className="mt-1 text-lg font-extrabold text-red-700">- {formatBDT(data.totalOutgoing)}</p>
                </div>
              </div>

              <div className="rounded-2xl bg-[#001f2a] p-5 text-white shadow-lg">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Expected Closing Cash</p>
                <p className="mt-2 text-3xl font-black">{formatBDT(data.closingBalance)}</p>
              </div>

              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Internal Notes</label>
                <textarea
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00694b]/20"
                  rows="2"
                  placeholder="Any cash discrepancies? Mention here..."
                   value={notes}
                   onChange={e => setNotes(e.target.value)}
                />
              </div>

              <button
                onClick={handleCloseDay}
                disabled={loading}
                className="w-full py-4 rounded-2xl bg-gradient-to-br from-[#ba1a1a] to-[#8c1d1d] text-white font-bold text-sm uppercase tracking-[0.2em] shadow-xl hover:opacity-90 disabled:opacity-50 transition transform active:scale-95"
              >
                {loading ? 'Processing Closure...' : '🔐 Close Business (End Day)'}
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default DailyClosure;

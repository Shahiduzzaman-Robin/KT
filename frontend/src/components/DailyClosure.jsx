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
    <div className="relative overflow-hidden rounded-[2rem] bg-white p-5 shadow-[0_20px_50px_rgba(0,31,42,0.12)] border border-slate-100/50">
      {/* Background Decoration */}
      <div className="absolute -right-4 -top-10 h-32 w-32 rounded-full bg-emerald-500/5 blur-3xl" />
      
      <div className="relative">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="[font-family:Manrope,ui-sans-serif,system-ui] text-lg font-extrabold tracking-tight text-[#001f2a]">Daily Z-Report</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#00694b]/70 mt-0.5">Shop Closer</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-400 shadow-inner">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        </div>

        {loading && !data ? (
          <div className="flex flex-col items-center py-10">
             <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#00694b] border-t-transparent" />
             <p className="mt-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Calculating...</p>
          </div>
        ) : data ? (
          <div className="mt-5 space-y-3.5">
            {data.isAlreadyLocked ? (
              <div className="relative rounded-2xl bg-gradient-to-br from-[#00694b] to-[#004d37] p-5 text-center shadow-lg shadow-emerald-900/20">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-md">
                   <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                   </svg>
                </div>
                <h3 className="mt-3 text-sm font-bold text-white">Business Closed</h3>
                <p className="mt-1 text-[11px] font-medium text-emerald-100 opacity-80">Final report sent to Discord.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-2xl border border-slate-50 bg-slate-50/50 p-3">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Opening Cash</p>
                    <p className="mt-0.5 text-xs font-extrabold text-[#001f2a]">{formatBDT(data.openingBalance)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-50 bg-slate-50/50 p-3">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Transactions</p>
                    <p className="mt-0.5 text-xs font-extrabold text-[#001f2a]">{data.transactionCount}</p>
                  </div>
                </div>

                <div className="space-y-2">
                   <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Today's Income</span>
                      <span className="text-xs font-black text-emerald-700">+{formatBDT(data.totalIncome)}</span>
                   </div>
                   <div className="h-[1px] w-full bg-slate-100" />
                   <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Today's Expense</span>
                      <span className="text-xs font-black text-red-600">-{formatBDT(data.totalOutgoing)}</span>
                   </div>
                </div>

                <div className="group relative mt-2 overflow-hidden rounded-2xl bg-[#001f2a] p-4 text-white shadow-xl transition-all hover:scale-[1.02]">
                  <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-white/5 to-transparent" />
                  <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-emerald-400">Expected Closing Cash</p>
                  <p className="mt-1.5 text-2xl font-black tracking-tight">{formatBDT(data.closingBalance)}</p>
                </div>

                <div className="mt-2">
                  <textarea
                    className="w-full rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs font-medium text-[#001f2a] placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00694b]/10 transition"
                    rows="2"
                    placeholder="Notes for today..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>

                <button
                  onClick={handleCloseDay}
                  disabled={loading}
                  className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-[#ba1a1a] to-[#8c1d1d] py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-red-900/20 transition hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full transition-transform group-hover:translate-y-0" />
                  <span className="relative">🔐 Secure End Day</span>
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default DailyClosure;

import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import api from '../utils/api';
import { useCurrentRole } from '../utils/auth';
import { getSocketUrl } from '../utils/socket';
import { io } from 'socket.io-client';

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

    // Listen for real-time transaction changes to refresh the report
    const socket = io(getSocketUrl());
    socket.on('transactions-changed', () => {
      fetchPreview();
    });

    return () => {
      socket.disconnect();
    };
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
    <div className="relative overflow-hidden rounded-[2.5rem] bg-white p-6 shadow-[0_25px_60px_rgba(0,31,42,0.15)] border border-slate-100">
      {/* Background Decoration */}
      <div className="absolute -right-4 -top-10 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl opacity-50" />
      
      <div className="relative">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="[font-family:Manrope,ui-sans-serif,system-ui] text-2xl font-black tracking-tight text-[#001f2a]">Daily Z-Report</h2>
            <p className="text-[12px] font-black uppercase tracking-[0.25em] text-[#00694b] mt-1">Shop Closure System</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-lg shadow-emerald-900/10 border border-emerald-50">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        </div>

        {loading && !data ? (
          <div className="flex flex-col items-center py-12">
             <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#00694b] border-t-transparent" />
             <p className="mt-4 text-xs font-black text-slate-400 uppercase tracking-widest">Calculating Shop Totals...</p>
          </div>
        ) : data ? (
          <div className="mt-7 space-y-5">
            {data.isAlreadyLocked ? (
              <div className="relative rounded-[2rem] bg-gradient-to-br from-[#00694b] to-[#004d37] p-7 text-center shadow-2xl shadow-emerald-900/30">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md border border-white/30">
                   <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                   </svg>
                </div>
                <h3 className="mt-5 text-lg font-black text-white">Business Closed</h3>
                <p className="mt-2 text-sm font-bold text-emerald-100/80 tracking-wide">Financial archive is locked.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="rounded-2xl border border-slate-50 bg-slate-50/70 p-4">
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Opening Cash</p>
                    <p className="mt-1 text-base font-black text-[#001f2a]">{formatBDT(data.openingBalance)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-50 bg-slate-50/70 p-4">
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Total Entries</p>
                    <p className="mt-1 text-base font-black text-[#001f2a]">{data.transactionCount}</p>
                  </div>
                </div>

                <div className="space-y-3 px-1">
                   <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-emerald-600 uppercase tracking-[0.15em]">Today's Income</span>
                      <span className="text-base font-black text-emerald-700">+{formatBDT(data.totalIncome)}</span>
                   </div>
                   <div className="h-[1.5px] w-full bg-slate-100" />
                   <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-red-500 uppercase tracking-[0.15em]">Today's Expense</span>
                      <span className="text-base font-black text-red-600">-{formatBDT(data.totalOutgoing)}</span>
                   </div>
                </div>

                <div className="group relative mt-3 overflow-hidden rounded-[2rem] bg-[#001f2a] p-6 text-white shadow-2xl transition-all hover:scale-[1.01] border-l-8 border-emerald-500">
                  <div className="absolute right-0 top-0 h-full w-32 bg-gradient-to-l from-white/10 to-transparent" />
                  <p className="text-[12px] font-black uppercase tracking-[0.3em] text-emerald-400/80">Expected Closing Cash</p>
                  <p className="mt-2 text-4xl font-black tracking-tighter text-white drop-shadow-lg">{formatBDT(data.closingBalance)}</p>
                </div>

                <div className="mt-2">
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Closing Notes</p>
                  <textarea
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 p-4 text-sm font-bold text-[#001f2a] placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#00694b]/10 transition min-h-[80px]"
                    placeholder="Enter today's summary..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>

                <button
                  onClick={handleCloseDay}
                  disabled={loading}
                  className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-br from-[#ba1a1a] to-[#8c1d1d] py-5 text-sm font-black uppercase tracking-[0.25em] text-white shadow-2xl shadow-red-900/30 transition hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
                >
                  <div className="absolute inset-0 bg-white/10 translate-y-full transition-transform group-hover:translate-y-0" />
                  <span className="relative flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Secure Closure
                  </span>
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

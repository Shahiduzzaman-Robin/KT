import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import api from '../utils/api';
import { useCurrentRole } from '../utils/auth';
import { getSocketUrl } from '../utils/socket';
import { io } from 'socket.io-client';
import ActionModal from './ActionModal';

function formatBDT(value) {
  return `৳ ${Number(value || 0).toLocaleString()}`;
}

function DailyClosure() {
  const role = useCurrentRole();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [notes, setNotes] = useState('');
  const [success, setSuccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null); // { title, message, type, isConfirm, onConfirm }

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

    const socket = io(getSocketUrl());
    socket.on('transactions-changed', () => {
      fetchPreview();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  async function handleCloseDay() {
    setStatusMessage({
      title: 'Finalize Day?',
      message: 'Are you sure you want to close the day and lock the records? This action cannot be undone.',
      type: 'warning',
      isConfirm: true,
      onConfirm: async () => {
        setStatusMessage(null);
        await performClosure();
      }
    });
  }

  async function performClosure() {
    try {
      setLoading(true);
      await api.post('/reports/close-day', { date: data.date, notes });
      setSuccess(true);
      fetchPreview();
    } catch (err) {
      console.error(err);
      setStatusMessage({
        title: 'Closure Failed',
        message: err.response?.data?.message || 'Failed to close day',
        type: 'danger'
      });
    } finally {
      setLoading(false);
    }
  }

  if (role !== 'admin') {
    return null;
  }

  return (
    <div className="relative overflow-hidden rounded-[2.5rem] bg-white border border-slate-100 shadow-[0_30px_70px_rgba(0,31,42,0.12)]">
      {/* Refined Background Pulse */}
      <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-emerald-500/5 blur-3xl" />
      
      {/* Header Section */}
      <div className="bg-[#fcfdfe] px-7 py-6 border-b border-slate-50 flex items-center justify-between">
        <div>
          <h2 className="[font-family:Manrope,ui-sans-serif,system-ui] text-xl font-black tracking-tight text-[#001f2a]">
            Z-Report 
            <span className="ml-2 inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </h2>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mt-0.5">Financial Ledger Closer</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-300 shadow-sm border border-slate-100">
           <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" />
           </svg>
        </div>
      </div>

      <div className="p-7">
        {loading && !data ? (
          <div className="flex flex-col items-center py-10">
             <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
             <p className="mt-4 text-[10px] font-bold text-slate-300 uppercase tracking-widest text-center">Auditing Transactions...</p>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {data.isAlreadyLocked ? (
              <div className="group relative rounded-[2rem] bg-gradient-to-br from-[#00694b] to-[#004d37] p-8 text-center shadow-2xl shadow-emerald-900/30 overflow-hidden transform transition hover:scale-[1.02]">
                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20">
                   <svg className="h-9 w-9 text-emerald-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                   </svg>
                </div>
                <h3 className="mt-5 text-lg font-black text-white tracking-tight">Business Closed</h3>
                <p className="mt-2 text-[12px] font-bold text-emerald-100/60 uppercase tracking-widest">Snapshot Archived</p>
              </div>
            ) : (
              <>
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-slate-50/50 border border-slate-100/50 p-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Opening Cash</p>
                    <p className="text-sm font-black text-[#001f2a]">{formatBDT(data.openingBalance)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50/50 border border-slate-100/50 p-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Entries</p>
                    <p className="text-sm font-black text-[#001f2a]">{data.transactionCount}</p>
                  </div>
                </div>

                {/* Inline Performance */}
                <div className="space-y-4 px-1 py-2">
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                         <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                         <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Total Income</span>
                      </div>
                      <span className="text-sm font-black text-emerald-700">+{formatBDT(data.totalIncome)}</span>
                   </div>
                   <div className="h-px w-full bg-slate-50" />
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                         <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                         <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Total Expense</span>
                      </div>
                      <span className="text-sm font-black text-red-700">-{formatBDT(data.totalOutgoing)}</span>
                   </div>
                </div>

                {/* Highlight Result Card */}
                <div className="relative group overflow-hidden rounded-[2.2rem] bg-[#001f2a] p-7 text-white shadow-2xl transition hover:shadow-emerald-900/10 active:scale-[0.99]">
                  <div className="absolute right-[-10%] top-[-20%] h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-emerald-400 opacity-80 mb-3">Expected Closing Cash</p>
                  <p className="text-4xl font-black tracking-tighter tabular-nums drop-shadow-md">{formatBDT(data.closingBalance)}</p>
                </div>

                {/* Notes Input */}
                <div className="mt-2">
                  <textarea
                    rows={2}
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50/30 p-4 text-xs font-bold text-[#001f2a] placeholder:text-slate-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/5 transition resize-none"
                    placeholder="Closing notes or adjustments..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>

                {/* Action Button */}
                <button
                  onClick={handleCloseDay}
                  disabled={loading}
                  className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#ba1a1a] to-[#8c1d1d] py-5 text-[11px] font-black uppercase tracking-[0.3em] text-white shadow-xl shadow-red-950/20 transition-all hover:translate-y-[-2px] hover:shadow-red-950/30 active:translate-y-0 disabled:opacity-50"
                >
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20 w-full group-hover:h-full transition-all duration-300" />
                  <span className="relative flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Confirm Stop & Exit
                  </span>
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>

      <ActionModal 
        isOpen={!!statusMessage}
        onClose={() => setStatusMessage(null)}
        onConfirm={statusMessage?.isConfirm ? statusMessage.onConfirm : () => setStatusMessage(null)}
        title={statusMessage?.title}
        message={statusMessage?.message}
        confirmText={statusMessage?.isConfirm ? 'Confirm Closure' : 'Got it'}
        type={statusMessage?.type}
      />
    </div>
  );
}

export default DailyClosure;

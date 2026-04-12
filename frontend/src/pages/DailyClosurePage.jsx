import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../utils/api';
import { useCurrentRole } from '../utils/auth';
import { getSocketUrl } from '../utils/socket';
import { io } from 'socket.io-client';
import AppSidebar from '../components/AppSidebar';
import UserSessionBadge from '../components/UserSessionBadge';
import PasswordModal from '../components/PasswordModal';
import ActionModal from '../components/ActionModal';

function formatBDT(value) {
  return `৳ ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function DailyClosurePage() {
  const role = useCurrentRole();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [notes, setNotes] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [revertLoading, setRevertLoading] = useState(false);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null); // { title, message, type }

  async function fetchFullData() {
    try {
      setLoading(true);
      // Get preview totals
      const { data: previewData } = await api.get('/reports/preview');
      setData(previewData);

      // Get today's transactions for the audit list
      const today = dayjs().format('YYYY-MM-DD');
      const { data: txData } = await api.get(`/transactions?from=${today}&to=${today}&limit=100`);
      setTransactions(txData.items || []);
    } catch (err) {
      console.error('Failed to fetch closure data', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFullData();

    const socket = io(getSocketUrl());
    socket.on('transactions-changed', fetchFullData);
    return () => socket.disconnect();
  }, []);

  async function handleCloseDayConfirm() {
    setIsCloseConfirmOpen(false);
    try {
      setLoading(true);
      await api.post('/reports/close-day', { date: data.date, notes });
      setStatusMessage({
        title: 'Closure Success!',
        message: 'Business day has been securely locked and archived. You can viewed the finalized report in the archive.',
        type: 'success'
      });
      fetchFullData();
    } catch (err) {
      setStatusMessage({
        title: 'Closure Failed',
        message: err.response?.data?.message || 'The system encountered an error while trying to lock the day.',
        type: 'danger'
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleRevertConfirm(password) {
    try {
      setRevertLoading(true);
      // Find the report ID for today
      const { data: reports } = await api.get('/reports');
      const todayReport = reports.find(r => dayjs(r.date).isSame(dayjs(), 'day'));
      
      if (!todayReport) {
        alert('Could not find today\'s closure record to unlock.');
        return;
      }

      await api.post(`/reports/${todayReport._id}/revert`, { password });
      setStatusMessage({
        title: 'Day Unlocked',
        message: 'The business day is now editable again. Existing reports for this date have been removed.',
        type: 'success'
      });
      setIsPasswordModalOpen(false);
      fetchFullData();
    } catch (err) {
      setStatusMessage({
        title: 'Unlock Failed',
        message: err.response?.data?.message || 'Verification failed. Password may be incorrect.',
        type: 'danger'
      });
    } finally {
      setRevertLoading(false);
    }
  }

  if (role !== 'admin') {
    return (
        <div className="flex h-screen items-center justify-center bg-red-50 text-red-800 font-bold uppercase tracking-widest">
            Access Denied: Admin Authorization Required
        </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#f4faff] text-[#001f2a] [font-family:Inter,ui-sans-serif,system-ui]">
      <div className="mx-auto flex max-w-[1700px] gap-5 px-4 py-5 md:px-6">
        <AppSidebar />
        <main className="min-w-0 flex-1 space-y-6">
          <header className="rounded-3xl bg-white p-8 shadow-[0_12px_40px_rgba(0,31,42,0.06)] flex items-center justify-between border border-slate-50">
            <div>
              <div className="flex items-center gap-3">
                 <h1 className="[font-family:Manrope,ui-sans-serif,system-ui] text-4xl font-black tracking-tight text-[#001f2a]">
                   End Day Control
                 </h1>
                 {data?.isAlreadyLocked ? (
                   <span className="rounded-full bg-red-100 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-red-700">Records Locked 🔒</span>
                 ) : (
                   <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-700 animate-pulse">Live Audit Active</span>
                 )}
              </div>
              <p className="mt-2 text-sm font-medium text-slate-500 uppercase tracking-[0.2em]">Business Day: {dayjs().format('DD MMMM YYYY')}</p>
            </div>
            <UserSessionBadge compact />
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* LEFT COLUMN: Financial Command */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Main Totals Card */}
              <div className={`rounded-[2.5rem] p-8 shadow-[0_30px_70px_rgba(0,31,42,0.12)] border ${data?.isAlreadyLocked ? 'bg-gradient-to-br from-[#00694b] to-[#004d37] border-emerald-800 text-white' : 'bg-white border-slate-100'}`}>
                <h3 className={`text-xs font-black uppercase tracking-[0.3em] mb-8 border-b pb-4 ${data?.isAlreadyLocked ? 'text-emerald-200/50 border-emerald-700' : 'text-slate-400 border-slate-50'}`}>
                  {data?.isAlreadyLocked ? 'Audit Snapshot (Finalized)' : 'Financial Snapshots'}
                </h3>
                
                <div className="space-y-8">
                  <div className="flex items-center justify-between group cursor-default">
                    <div>
                        <p className={`text-[10px] font-bold uppercase tracking-widest ${data?.isAlreadyLocked ? 'text-emerald-200/70' : 'text-slate-400'}`}>Opening Cash</p>
                        <p className="text-xl font-black mt-1">{formatBDT(data?.openingBalance)}</p>
                    </div>
                    <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${data?.isAlreadyLocked ? 'bg-white/10 text-emerald-200' : 'bg-slate-50 text-slate-300'}`}>
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>

                  <div className={`grid grid-cols-2 gap-6 pt-4 border-t ${data?.isAlreadyLocked ? 'border-emerald-700' : 'border-slate-50'}`}>
                     <div className={`p-4 rounded-3xl border ${data?.isAlreadyLocked ? 'bg-white/5 border-white/10' : 'bg-emerald-50/50 border-emerald-100/50'}`}>
                        <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${data?.isAlreadyLocked ? 'text-emerald-300' : 'text-emerald-600'}`}>Total Income</p>
                        <p className={`text-lg font-black ${data?.isAlreadyLocked ? 'text-white' : 'text-emerald-800'}`}>+{formatBDT(data?.totalIncome)}</p>
                     </div>
                     <div className={`p-4 rounded-3xl border ${data?.isAlreadyLocked ? 'bg-white/5 border-white/10' : 'bg-red-50/50 border-red-100/50'}`}>
                        <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${data?.isAlreadyLocked ? 'text-red-300' : 'text-red-500'}`}>Total Expense</p>
                        <p className={`text-lg font-black ${data?.isAlreadyLocked ? 'text-white' : 'text-red-800'}`}>-{formatBDT(data?.totalOutgoing)}</p>
                     </div>
                  </div>

                  <div className={`relative group overflow-hidden rounded-[2.5rem] p-10 shadow-2xl transition-all ${data?.isAlreadyLocked ? 'bg-white/10 border border-white/20' : 'bg-[#001f2a] text-white hover:scale-[1.01]'}`}>
                     {!data?.isAlreadyLocked && <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl opacity-50" />}
                     <p className={`text-[11px] font-black uppercase tracking-[0.4em] mb-4 opacity-80 ${data?.isAlreadyLocked ? 'text-emerald-300' : 'text-emerald-400'}`}>Closing Cash</p>
                     <p className="text-5xl font-black tracking-tighter tabular-nums drop-shadow-xl">{formatBDT(data?.closingBalance)}</p>
                     <div className={`mt-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest ${data?.isAlreadyLocked ? 'text-emerald-200/50' : 'text-emerald-100/60'}`}>
                        <div className={`h-1.5 w-1.5 rounded-full ${data?.isAlreadyLocked ? 'bg-white/30' : 'bg-emerald-500'}`} />
                        Validated entries: {data?.transactionCount}
                     </div>
                  </div>
                </div>
              </div>

              {/* Action & Notes */}
              <div className="rounded-[2.5rem] bg-white p-8 shadow-[0_20px_50px_rgba(0,31,42,0.08)] border border-slate-100 text-center">
                 {data?.isAlreadyLocked ? (
                   <div className="py-2">
                     <div className="mx-auto h-16 w-16 mb-4 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                     </div>
                     <h3 className="text-xl font-black text-[#001f2a] tracking-tight">Business is Closed</h3>
                     <p className="mt-2 text-sm font-semibold text-slate-400 max-w-[300px] mx-auto">This day is locked for security. To make corrections, you must revert the closure.</p>
                     
                     <button 
                       onClick={() => setIsPasswordModalOpen(true)}
                       disabled={loading}
                       className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-slate-100 py-4 text-xs font-black uppercase tracking-widest text-slate-500 transition hover:bg-slate-50 hover:text-red-600 hover:border-red-100 disabled:opacity-50"
                     >
                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2z" />
                       </svg>
                       Unlock Business Day
                     </button>
                   </div>
                 ) : (
                   <div className="space-y-5">
                      <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 mb-6 text-left">Closure Finalization</h3>
                      <textarea 
                        className="w-full rounded-2xl border border-slate-100 bg-[#fcfdfe] p-5 text-sm font-bold text-[#001f2a] placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-500/5 transition min-h-[140px] resize-none"
                        placeholder="Add any specific notes about today's business..."
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                      />
                      
                      <button 
                        onClick={() => setIsCloseConfirmOpen(true)}
                        disabled={loading}
                        className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-br from-[#ba1a1a] to-[#8c1d1d] py-6 text-xs font-black uppercase tracking-[0.3em] text-white shadow-2xl shadow-red-900/30 transition hover:translate-y-[-2px] disabled:opacity-50"
                      >
                        <div className="absolute inset-y-0 left-0 w-0 bg-white/10 transition-all group-hover:w-full" />
                        <span className="relative flex items-center gap-2">
                           <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                           </svg>
                           SECURE CLOSURE & ARCHIVE
                        </span>
                      </button>
                   </div>
                 )}
              </div>
            </div>

            {/* RIGHT COLUMN: Live Audit List */}
            <div className="lg:col-span-7 bg-white rounded-[2.5rem] shadow-[0_12px_40px_rgba(0,31,42,0.06)] border border-slate-50 flex flex-col h-full overflow-hidden min-h-[600px]">
               <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Activity Audit List</h3>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{transactions.length} entries today</span>
               </div>
               
               <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-left">
                     <thead>
                        <tr className="bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-50">
                           <th className="px-8 py-4">Time</th>
                           <th className="px-8 py-4">Ledger</th>
                           <th className="px-8 py-4 text-right">Amount</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50">
                        {transactions.map(tx => (
                          <tr key={tx._id} className="hover:bg-slate-50 transition-colors group">
                             <td className="px-8 py-5 text-xs font-bold text-slate-400">{dayjs(tx.createdAt).format('hh:mm A')}</td>
                             <td className="px-8 py-5">
                                <div className="text-sm font-black text-[#001f2a]">{tx.ledgerId?.name}</div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{tx.type}</div>
                             </td>
                             <td className="px-8 py-5 text-right">
                                <span className={`text-sm font-black ${tx.type === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>
                                   {tx.type === 'income' ? '+' : '-'} {formatBDT(tx.amount)}
                                </span>
                             </td>
                          </tr>
                        ))}
                        {transactions.length === 0 && (
                          <tr>
                            <td colSpan="3" className="px-8 py-10 text-center text-slate-400 text-sm font-medium">No activity recorded for today yet.</td>
                          </tr>
                        )}
                     </tbody>
                  </table>
               </div>
            </div>

          </div>
        </main>
      </div>
      <PasswordModal 
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onConfirm={handleRevertConfirm}
        loading={revertLoading}
        title="Confirm Unlock"
        message="DANGER: You are about to UNLOCK today's records. They will become editable and the archival report will be deleted."
      />
      <ActionModal 
        isOpen={isCloseConfirmOpen}
        onClose={() => setIsCloseConfirmOpen(false)}
        onConfirm={handleCloseDayConfirm}
        title="Finalize Closure?"
        message="Are you sure you want to lock ALL today's records? This will generate a permanent archive and block further entries."
        confirmText="Yes, Lock Everything"
        type="danger"
      />

      <ActionModal 
        isOpen={!!statusMessage}
        onClose={() => setStatusMessage(null)}
        onConfirm={() => setStatusMessage(null)}
        title={statusMessage?.title}
        message={statusMessage?.message}
        confirmText="Got it"
        type={statusMessage?.type}
      />
    </div>
  );
}

export default DailyClosurePage;

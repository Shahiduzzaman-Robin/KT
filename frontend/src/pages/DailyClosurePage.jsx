import { useEffect, useState } from 'react';
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
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [targetDate, setTargetDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [notes, setNotes] = useState('');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [revertLoading, setRevertLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null); // { title, message, type }

  async function fetchClosureData(dateToFetch = targetDate) {
    try {
      setLoading(true);
      const { data: res } = await api.get('/reports/preview', {
        params: { date: dateToFetch }
      });
      setData(res);
      
      const { data: txRes } = await api.get('/transactions', {
        params: { from: dateToFetch, to: dateToFetch, limit: 100 }
      });
      const { data: loansRes } = await api.get('/loans', {
        params: { from: dateToFetch, to: dateToFetch }
      });

      // Filter logically for this business day AND sort chronologically (Noon before Evening)
      const combined = [
        ...(txRes.items || []).map(t => ({ ...t, kind: 'transaction' })),
        ...(loansRes || []).map(l => ({ ...l, kind: 'loan' }))
      ]
      .filter(item => dayjs(item.date).isSame(dayjs(dateToFetch), 'day'))
      .sort((a, b) => {
        const dateA = dayjs(a.createdAt);
        const dateB = dayjs(b.createdAt);
        
        // Sort purely by the 'Time of Day' (Minutes from Midnight)
        const minA = dateA.hour() * 60 + dateA.minute();
        const minB = dateB.hour() * 60 + dateB.minute();
        
        if (minA !== minB) return minA - minB;
        
        // Final tie-breaker: creation sequence
        return dateA.valueOf() - dateB.valueOf();
      });

      setTransactions(combined);
    } catch (err) {
      console.error('Failed to fetch closure data', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchClosureData(targetDate);

    const socket = io(getSocketUrl());
    socket.on('transactions:changed', () => fetchClosureData(targetDate));
    return () => socket.disconnect();
  }, [targetDate]);

  async function handleCloseDayConfirm() {
    try {
      setLoading(true);
      await api.post('/reports', { notes, date: targetDate });
      setStatusMessage({
        title: 'Success',
        message: 'Business day closed successfully! All records have been locked and archived.',
        type: 'success'
      });
      setIsCloseConfirmOpen(false);
      fetchClosureData(targetDate);
    } catch (err) {
      setStatusMessage({
        title: 'Error',
        message: err.response?.data?.message || 'Failed to close day',
        type: 'danger'
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleRevertConfirm(password) {
    try {
      setRevertLoading(true);
      await api.post(`/reports/${data?.reportId}/revert`, { password });
      setStatusMessage({
        title: 'Unlocked',
        message: 'Records successfully unlocked. You can now make corrections.',
        type: 'success'
      });
      setIsPasswordModalOpen(false);
      fetchClosureData();
    } catch (err) {
      setStatusMessage({
        title: 'Auth Failed',
        message: err.response?.data?.message || 'Incorrect password',
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
          <header className="rounded-lg bg-white p-8 shadow-[0_12px_40px_rgba(0,31,42,0.06)] flex items-center justify-between border border-slate-50">
            <div>
              <div className="flex items-center gap-3">
                 <h1 className="[font-family:Manrope,ui-sans-serif,system-ui] text-4xl font-black tracking-tight text-[#001f2a]">
                   End Day Control
                 </h1>
                 {data?.isAlreadyLocked ? (
                   <span className="rounded bg-red-100 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-red-700">Records Locked 🔒</span>
                 ) : data?.isImplicitlyLocked ? (
                   <span className="rounded bg-amber-100 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-700">Implicitly Finalized 🛡️</span>
                 ) : (
                   <span className="rounded bg-emerald-100 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-700 animate-pulse">Live Audit Active</span>
                 )}
              </div>
              <p className="mt-2 text-sm font-medium text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                Business Day: 
                <input 
                  type="date" 
                  value={targetDate}
                  max={dayjs().format('YYYY-MM-DD')}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="bg-transparent border-none p-0 text-sm font-black text-[#00694b] focus:ring-0 cursor-pointer"
                />
              </p>
            </div>
            <div className="flex items-center gap-4">
              <UserSessionBadge compact />
              <button 
                onClick={() => window.location.href = '/reports'}
                className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-white"
              >
                View Archive
              </button>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* LEFT COLUMN: Financial Command */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Main Totals Card */}
              <div className={`rounded-lg p-8 shadow-[0_30px_70px_rgba(0,31,42,0.12)] border ${data?.isAlreadyLocked ? 'bg-gradient-to-br from-[#00694b] to-[#004d37] border-emerald-800 text-white' : 'bg-white border-slate-100'}`}>
                <h3 className={`text-xs font-black uppercase tracking-[0.3em] mb-8 border-b pb-4 ${data?.isAlreadyLocked ? 'text-emerald-200/50 border-emerald-700' : 'text-slate-400 border-slate-50'}`}>
                  {data?.isAlreadyLocked ? 'Audit Snapshot (Finalized)' : 'Financial Snapshots'}
                </h3>
                
                <div className="space-y-8">
                  <div className="flex items-center justify-between group cursor-default">
                    <div>
                        <p className={`text-[10px] font-bold uppercase tracking-widest ${data?.isAlreadyLocked ? 'text-emerald-200/70' : 'text-slate-400'}`}>Opening Cash</p>
                        <p className="text-xl font-black mt-1">{formatBDT(data?.openingBalance)}</p>
                        {data?.lastReportDate && (
                           <p className={`text-[9px] mt-2 font-bold uppercase tracking-tighter ${data?.isAlreadyLocked ? 'text-emerald-300/50' : 'text-slate-400'}`}>
                              From {dayjs(data.lastReportDate).format('DD MMM')} 
                              {dayjs(targetDate).diff(dayjs(data.lastReportDate), 'day') > 1 && (
                                <span className="ml-1 text-amber-500 font-black">({dayjs(targetDate).diff(dayjs(data.lastReportDate), 'day') - 1} Day Gap)</span>
                              )}
                           </p>
                         )}
                    </div>
                    <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${data?.isAlreadyLocked ? 'bg-white/10 text-emerald-200' : 'bg-slate-50 text-slate-300'}`}>
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>

                  <div className={`grid grid-cols-2 gap-6 pt-4 border-t ${data?.isAlreadyLocked ? 'border-emerald-700' : 'border-slate-50'}`}>
                     <div className={`p-4 rounded-lg border ${data?.isAlreadyLocked ? 'bg-white/5 border-white/10' : 'bg-emerald-50/50 border-emerald-100/50'}`}>
                        <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${data?.isAlreadyLocked ? 'text-emerald-300' : 'text-emerald-600'}`}>Total Income</p>
                        <p className={`text-lg font-black ${data?.isAlreadyLocked ? 'text-white' : 'text-emerald-800'}`}>+{formatBDT(data?.totalIncome)}</p>
                     </div>
                     <div className={`p-4 rounded-lg border ${data?.isAlreadyLocked ? 'bg-white/5 border-white/10' : 'bg-red-50/50 border-red-100/50'}`}>
                        <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${data?.isAlreadyLocked ? 'text-red-300' : 'text-red-500'}`}>Total Expense</p>
                        <p className={`text-lg font-black ${data?.isAlreadyLocked ? 'text-white' : 'text-red-800'}`}>-{formatBDT(data?.totalOutgoing)}</p>
                     </div>
                  </div>

                  <div className={`p-4 rounded-lg border ${data?.isAlreadyLocked ? 'bg-white/5 border-white/10' : 'bg-blue-50/50 border-blue-100/50'}`}>
                    <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${data?.isAlreadyLocked ? 'text-blue-200' : 'text-blue-600'}`}>Active Loans & Advances</p>
                    <p className={`text-xl font-black ${data?.isAlreadyLocked ? 'text-white' : 'text-blue-800'}`}>৳ {Number(data?.totalLoanOutstanding || 0).toLocaleString()}</p>
                  </div>

                  <div className="pt-8 space-y-4">
                     <div>
                        <p className={`text-[10px] font-bold uppercase tracking-[0.2em] mb-1 ${data?.isAlreadyLocked ? 'text-emerald-200' : 'text-slate-400'}`}>Liquid Cash Balance</p>
                        <div className="flex items-center gap-3">
                           <span className="text-4xl font-black tracking-tighter tabular-nums">{formatBDT(data?.closingBalance)}</span>
                           {data?.isAlreadyLocked && (
                             <div className="h-10 w-10 flex items-center justify-center bg-white/20 rounded-lg text-white">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                             </div>
                           )}
                        </div>
                     </div>

                     <div className={`pt-4 border-t ${data?.isAlreadyLocked ? 'border-emerald-700' : 'border-slate-100'}`}>
                        <p className={`text-[10px] font-bold uppercase tracking-[0.2em] mb-1 ${data?.isAlreadyLocked ? 'text-emerald-200/70' : 'text-[#00694b]'}`}>Total Business Valuation (Cash + Loans)</p>
                        <p className="text-3xl font-black tracking-tighter tabular-nums">
                           {formatBDT((data?.closingBalance || 0) + (data?.totalLoanOutstanding || 0))}
                        </p>
                     </div>
                  </div>
                </div>
              </div>

               {/* Action & Notes */}
               <div className="rounded-lg bg-white p-8 shadow-[0_20px_50px_rgba(0,31,42,0.08)] border border-slate-100 text-center">
                  {data?.isAlreadyLocked ? (
                    <div className="py-2">
                      <div className="mx-auto h-16 w-16 mb-4 rounded-lg bg-red-50 flex items-center justify-center text-red-500">
                         <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                         </svg>
                      </div>
                      <h3 className="text-xl font-black text-[#001f2a] tracking-tight">Business is Closed</h3>
                      <p className="mt-2 text-sm font-semibold text-slate-400 max-w-[300px] mx-auto">This day is locked for security. To make corrections, you must revert the closure.</p>
                      
                      <button 
                        onClick={() => setIsPasswordModalOpen(true)}
                        className="mt-8 flex w-full items-center justify-center gap-3 rounded-lg border-2 border-slate-100 py-4 text-xs font-black uppercase tracking-widest text-slate-500 transition hover:bg-slate-50 hover:text-red-600 hover:border-red-100"
                      >
                        Unlock Business Day
                      </button>
                    </div>
                  ) : data?.isImplicitlyLocked ? (
                   <div className="py-2">
                      <div className="mx-auto h-16 w-16 mb-4 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500">
                         <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                         </svg>
                      </div>
                      <h3 className="text-xl font-black text-[#001f2a] tracking-tight">Implicitly Locked</h3>
                      <p className="mt-2 text-sm font-semibold text-slate-400 max-w-[300px] mx-auto whitespace-pre-line">
                        This day is read-only because a future closure exists (<strong>{dayjs(data?.nextReportDate).format('DD MMM')}</strong>).{"\n"}
                        To edit these records, you must first unlock the later dates.
                      </p>
                      
                      <button 
                        onClick={() => setIsCloseConfirmOpen(true)}
                        className="mt-8 flex w-full items-center justify-center gap-3 rounded-lg border-2 border-slate-100 py-4 text-xs font-black uppercase tracking-widest text-slate-500 transition hover:bg-slate-50 hover:text-[#00694b] hover:border-emerald-100"
                      >
                        Archive Retroactively
                      </button>
                   </div>
                  ) : (
                    <div className="space-y-5">
                       <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 mb-6 text-left">Closure Finalization</h3>
                       <textarea 
                         className="w-full rounded-lg border border-slate-100 bg-[#fcfdfe] p-5 text-sm font-bold text-[#001f2a] placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-500/5 transition min-h-[140px] resize-none"
                         placeholder="Add any specific notes about today's business..."
                         value={notes}
                         onChange={e => setNotes(e.target.value)}
                       />
                       
                       <button 
                         onClick={() => setIsCloseConfirmOpen(true)}
                         disabled={loading}
                         className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-lg bg-gradient-to-br from-[#ba1a1a] to-[#8c1d1d] py-6 text-xs font-black uppercase tracking-[0.3em] text-white shadow-2xl shadow-red-900/30 transition hover:translate-y-[-2px] disabled:opacity-50"
                       >
                         SECURE CLOSURE & ARCHIVE
                       </button>
                    </div>
                  )}
               </div>
            </div>

            {/* RIGHT COLUMN: Live Audit List */}
            <div className="lg:col-span-7 bg-white rounded-lg shadow-[0_12px_40px_rgba(0,31,42,0.06)] border border-slate-50 flex flex-col h-full overflow-hidden min-h-[600px]">
               <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Activity Audit List</h3>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{transactions.length} entries on this day</span>
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
                        {transactions.map(item => (
                          <tr key={item._id} className="hover:bg-slate-50 transition-colors group">
                             <td className="px-8 py-5 text-xs font-bold text-slate-400">{dayjs(item.createdAt).format('hh:mm A')}</td>
                             <td className="px-8 py-5">
                                {item.kind === 'loan' ? (
                                  <>
                                    <div className="text-sm font-black text-blue-800">{item.borrowerName}</div>
                                    <div className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Loan & Advance</div>
                                  </>
                                ) : (
                                  <>
                                    <div className="text-sm font-black text-[#001f2a]">{item.ledgerId?.name || 'N/A'}</div>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.type}</div>
                                  </>
                                )}
                             </td>
                             <td className="px-8 py-5 text-right">
                                {item.kind === 'loan' ? (
                                   <span className="text-sm font-black text-blue-600">
                                      {formatBDT(item.totalAmount)}
                                   </span>
                                ) : (
                                   <span className={`text-sm font-black ${item.type === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>
                                      {item.type === 'income' ? '+' : '-'} {formatBDT(item.amount)}
                                   </span>
                                )}
                             </td>
                          </tr>
                        ))}
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

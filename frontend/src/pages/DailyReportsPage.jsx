import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import dayjs from 'dayjs';
import api from '../utils/api';
import AppSidebar from '../components/AppSidebar';
import UserSessionBadge from '../components/UserSessionBadge';
import PasswordModal from '../components/PasswordModal';
import ActionModal from '../components/ActionModal';

function formatBDT(value) {
  if (value === 0) return '0.00';
  return Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });
}

function DailyReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [details, setDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null); // { title, message, type }

  async function fetchReports() {
    try {
      setLoading(true);
      const { data } = await api.get('/reports');
      setReports(data);
    } catch (err) {
      console.error('Failed to fetch reports', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchDetails(reportId) {
    try {
      setLoadingDetails(true);
      const { data } = await api.get(`/reports/${reportId}/details`);
      const combined = [
        ...(data.transactions || []).map(t => ({ ...t, kind: 'transaction' })),
        ...(data.loans || []).map(l => ({ ...l, kind: 'loan' }))
      ]
      .filter(item => dayjs(item.date).isSame(dayjs(details.report.date), 'day'))
      .sort((a, b) => dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf());

      setDetails({ ...data, combined });
    } catch (err) {
      setStatusMessage({
        title: 'Load Error',
        message: 'Failed to load document details from the server.',
        type: 'danger'
      });
    } finally {
      setLoadingDetails(false);
    }
  }

  useEffect(() => {
    fetchReports();
  }, []);

  function handleRowClick(report) {
    setSelectedReport(report);
    fetchDetails(report._id);
  }

  function closeDocument() {
    setSelectedReport(null);
    setDetails(null);
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="relative min-h-screen bg-[#f4faff] text-[#001f2a] [font-family:Inter,ui-sans-serif,system-ui]">
      <style>{`
        @media print {
          /* Hide the main app layout completely */
          #root > .no-print, 
          #root > div:not(.portal-root),
          .no-print { 
            display: none !important; 
            height: 0 !important;
            overflow: hidden !important;
          }
          
          /* Reset body for printing */
          body { 
            background: white !important; 
            margin: 0 !important; 
            padding: 0 !important;
            overflow: visible !important;
          }

          /* Force the portal/modal to be visible and standard layout */
          .print-container {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: auto !important;
            display: block !important;
            background: white !important;
            z-index: 99999 !important;
          }

          .document-container {
            box-shadow: none !important;
            border: none !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>

      <div className="mx-auto flex max-w-[1700px] gap-5 px-4 py-5 md:px-6 no-print">
        <AppSidebar />

        <main className="min-w-0 flex-1 space-y-4">
          <header className="rounded-lg bg-white p-6 shadow-[0_12px_40px_rgba(0,31,42,0.06)]">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="[font-family:Manrope,ui-sans-serif,system-ui] text-3xl font-bold tracking-tight text-[#001f2a]">
                  Reports Archive
                </h1>
                <p className="mt-1 text-sm font-medium text-slate-500 uppercase tracking-widest">Historical Daily Closures</p>
              </div>
              <UserSessionBadge compact />
            </div>
          </header>

          <div className="rounded-lg bg-white shadow-[0_12px_40px_rgba(0,31,42,0.06)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">Date</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500 text-right">Opening</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-emerald-600 text-right">Income</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-red-600 text-right">Expenses</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-[#001f2a] text-right">Closing Cash</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-blue-600 text-right">Loans Bal.</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500 text-center">Entries</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-slate-400 font-medium">Loading archive...</td>
                    </tr>
                  ) : reports.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-slate-400 font-medium whitespace-pre-line">
                        No closures archived yet.{"\n"}Close the day from the Dashboard to see records here.
                      </td>
                    </tr>
                  ) : (
                    reports.map((report) => (
                      <tr 
                        key={report._id} 
                        className="hover:bg-slate-50 transition-colors cursor-pointer group"
                        onClick={() => handleRowClick(report)}
                      >
                        <td className="px-6 py-4">
                           <div className="font-bold text-[#001f2a]">{dayjs(report.date).format('DD MMM YYYY')}</div>
                           <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{dayjs(report.date).format('dddd')}</div>
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-slate-600 text-right text-mono">৳{formatBDT(report.openingBalance)}</td>
                        <td className="px-6 py-4 text-sm font-bold text-emerald-700 text-right text-mono">+{formatBDT(report.totalIncome)}</td>
                        <td className="px-6 py-4 text-sm font-bold text-red-700 text-right text-mono">-{formatBDT(report.totalOutgoing)}</td>
                        <td className="px-6 py-4 text-right">
                           <div className="text-base font-black text-[#001f2a] text-mono">৳{formatBDT(report.closingBalance)}</div>
                        </td>
                        <td className="px-6 py-4 text-right">
                           <div className="text-sm font-bold text-blue-700 text-mono whitespace-nowrap">৳{Number(report.totalLoanOutstanding || 0).toLocaleString()}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                           <div className="inline-flex items-center justify-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                             {report.transactionCount}
                           </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {selectedReport && createPortal(
        <div className="fixed inset-0 z-[500] flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm print-container print:relative print:z-0 print:bg-white print:p-0 print:overflow-visible">
          <div className="relative w-full max-w-4xl rounded-lg bg-white shadow-2xl document-container my-10 min-h-[90vh] flex flex-col print:my-0 print:min-h-0 print:shadow-none print:w-full">
            
            {/* Document Header Controls */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-8 py-4 rounded-t-xl no-print">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-lg bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Document View</span>
              </div>
              <div className="flex items-center gap-3">
                <button 
                   onClick={handlePrint}
                  className="flex items-center gap-2 rounded-lg bg-[#001f2a] px-4 py-2 text-xs font-bold text-white transition hover:opacity-90"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print / Save PDF
                </button>
                <button 
                  onClick={closeDocument}
                  className="h-9 w-9 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-red-500 transition"
                >
                   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                   </svg>
                </button>
              </div>
            </div>

            {/* THE DOCUMENT AREA (Clean, Paper-like) */}
            <div className="p-12 flex-1 bg-white print:p-0">
               {loadingDetails ? (
                 <div className="flex h-64 items-center justify-center text-slate-400 font-bold uppercase tracking-widest py-20 text-sm">
                   Generating Statement...
                 </div>
               ) : details ? (
                 <div className="max-w-3xl mx-auto text-[#000] [font-family:'Courier New',Courier,monospace]">
                    <div className="text-center border-b-2 border-black pb-8 mb-8">
                       <h2 className="text-2xl font-black uppercase tracking-[0.2em] mb-1">M/S KAMRUL TRADERS</h2>
                       <p className="text-sm font-bold">Daily Financial Statement</p>
                       <p className="text-sm mt-2">{dayjs(details.report.date).format('dddd, DD MMMM YYYY')}</p>
                    </div>

                    <div className="flex justify-between items-end mb-8 bg-slate-50 p-4 border border-slate-200 print:bg-white print:border-black">
                       <div>
                          <p className="text-[10px] font-bold uppercase text-slate-500 print:text-black">Statement ID</p>
                          <p className="text-xs font-bold">KT-REP-{details.report._id.slice(-6).toUpperCase()}</p>
                       </div>
                       <div className="text-right">
                          <p className="text-[10px] font-bold uppercase text-slate-500 print:text-black">Opening Balance</p>
                          <p className="text-xl font-black">৳ {formatBDT(details.report.openingBalance)}</p>
                       </div>
                    </div>

                    <table className="w-full border-collapse border border-black mb-8">
                       <thead>
                          <tr className="bg-slate-100 print:bg-white border-b border-black">
                             <th className="border-r border-black p-2 text-[10px] text-left uppercase">Time/Ref</th>
                             <th className="border-r border-black p-2 text-[10px] text-left uppercase">Ledger / Description</th>
                             <th className="border-r border-black p-2 text-[10px] text-right uppercase">In</th>
                             <th className="p-2 text-[10px] text-right uppercase">Out</th>
                          </tr>
                       </thead>
                       <tbody className="text-[11px]">
                           {details.combined?.map((item) => (
                             <tr key={item._id} className="border-b border-black/10 print:border-black">
                                <td className="border-r border-black/10 print:border-black p-2 whitespace-nowrap">{dayjs(item.createdAt).format('hh:mm A')}</td>
                                <td className="border-r border-black/10 print:border-black p-2 font-bold">
                                   {item.kind === 'loan' ? (
                                     <>
                                       <span className="text-blue-800">[LOAN] {item.borrowerName}</span>
                                       {item.description && <div className="text-[9px] font-normal italic mt-0.5 text-slate-600 print:text-black">Note: {item.description}</div>}
                                     </>
                                   ) : (
                                     <>
                                       {item.ledgerId?.name || 'N/A'}
                                       {item.description && <div className="text-[9px] font-normal italic mt-0.5 text-slate-600 print:text-black">Note: {item.description}</div>}
                                     </>
                                   )}
                                </td>
                                <td className="border-r border-black/10 print:border-black p-2 text-right">
                                   {item.kind === 'transaction' && item.type === 'income' ? formatBDT(item.amount) : '-'}
                                </td>
                                <td className="p-2 text-right">
                                   {item.kind === 'loan' ? formatBDT(item.totalAmount) : (item.kind === 'transaction' && item.type === 'outgoing' ? formatBDT(item.amount) : '-')}
                                </td>
                             </tr>
                           ))}
                           {(!details.combined || details.combined.length === 0) && (
                             <tr><td colSpan="4" className="p-8 text-center text-slate-400">No activity recorded for this day.</td></tr>
                           )}
                        </tbody>
                    </table>

                    <div className="grid grid-cols-2 gap-8 mb-12">
                       <div className="border border-black p-4">
                          <p className="text-[10px] uppercase font-bold text-slate-500 print:text-black mb-1 text-center border-b border-slate-100 print:border-black pb-1">Activity Summary</p>
                          <div className="flex justify-between text-xs mt-2">
                             <span>Total Receipts:</span>
                             <span className="font-bold">+{formatBDT(details.report.totalIncome)}</span>
                          </div>
                          <div className="flex justify-between text-xs mt-1">
                             <span>Total Payments:</span>
                             <span className="font-bold">-{formatBDT(details.report.totalOutgoing)}</span>
                          </div>
                          <div className="flex justify-between text-xs mt-1">
                             <span>Entry Count:</span>
                             <span className="font-bold">{details.report.transactionCount}</span>
                          </div>
                          <div className="flex justify-between text-xs mt-3 pt-2 border-t border-slate-200 print:border-black">
                             <span className="font-bold">Outstanding Loans:</span>
                             <span className="font-bold">৳ {Number(details.report.totalLoanOutstanding || 0).toLocaleString()}</span>
                          </div>
                       </div>
                        <div className="border-2 border-black bg-slate-50 p-4 print:bg-white space-y-3">
                           <div>
                              <p className="text-[10px] uppercase font-bold text-[#000] mb-1 text-center border-b border-black pb-1">Final Closing Cash</p>
                              <div className="flex justify-center flex-col items-center py-1">
                                 <span className="text-xl font-black">৳ {formatBDT(details.report.closingBalance)}</span>
                              </div>
                           </div>
                           <div className="pt-2 border-t border-black/20 print:border-black">
                              <p className="text-[10px] uppercase font-bold text-[#000] mb-1 text-center border-b border-black pb-1">Total Net Asset Value</p>
                              <div className="flex justify-center flex-col items-center py-1">
                                 <span className="text-2xl font-black">৳ {formatBDT((details.report.closingBalance || 0) + (details.report.totalLoanOutstanding || 0))}</span>
                                 <span className="text-[9px] mt-1 font-bold italic">*** System Validated & Locked ***</span>
                              </div>
                           </div>
                        </div>
                    </div>

                    <div className="flex justify-between mt-20 text-[10px] uppercase font-bold">
                       <div className="text-center w-40">
                          <div className="border-t border-black pt-2">Accountant Signature</div>
                          <div className="mt-1 normal-case font-medium text-slate-400 print:text-black">Ref: {details.report.generatedBy}</div>
                       </div>
                       <div className="text-center w-40">
                          <div className="border-t border-black pt-2">Admin/Owner Approval</div>
                       </div>
                    </div>

                    <div className="mt-16 text-center text-[9px] text-slate-400 print:text-black italic">
                       This is a computer-generated permanent record of Kamrul Traders. Generated on {dayjs().format('DD/MM/YYYY hh:mm A')}
                    </div>
                 </div>
               ) : null}
            </div>
          </div>
        </div>,
        document.body
      )}

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

export default DailyReportsPage;

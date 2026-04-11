import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import api from '../utils/api';
import AppSidebar from '../components/AppSidebar';
import UserSessionBadge from '../components/UserSessionBadge';

function formatBDT(value) {
  return `৳ ${Number(value || 0).toLocaleString()}`;
}

function DailyReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    fetchReports();
  }, []);

  return (
    <div className="relative min-h-screen bg-[#f4faff] text-[#001f2a] [font-family:Inter,ui-sans-serif,system-ui]">
      <div className="mx-auto flex max-w-[1700px] gap-5 px-4 py-5 md:px-6">
        <AppSidebar />

        <main className="min-w-0 flex-1 space-y-4">
          <header className="rounded-3xl bg-white p-6 shadow-[0_12px_40px_rgba(0,31,42,0.06)]">
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

          <div className="rounded-3xl bg-white shadow-[0_12px_40px_rgba(0,31,42,0.06)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">Date</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">Opening</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-emerald-600">Income</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-red-600">Expenses</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-[#001f2a]">Closing Cash</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">Closed By</th>
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
                      <tr key={report._id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4">
                           <div className="font-bold text-[#001f2a]">{dayjs(report.date).format('DD MMM YYYY')}</div>
                           <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{dayjs(report.date).format('dddd')}</div>
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-slate-600">{formatBDT(report.openingBalance)}</td>
                        <td className="px-6 py-4 text-sm font-bold text-emerald-700">+{formatBDT(report.totalIncome)}</td>
                        <td className="px-6 py-4 text-sm font-bold text-red-700">-{formatBDT(report.totalOutgoing)}</td>
                        <td className="px-6 py-4">
                           <div className="text-base font-black text-[#001f2a]">{formatBDT(report.closingBalance)}</div>
                           <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{report.transactionCount} entries</div>
                        </td>
                        <td className="px-6 py-4">
                           <div className="text-sm font-bold text-slate-700">{report.generatedBy}</div>
                           {report.notes && (
                             <div className="mt-1 text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded-md border border-amber-100 inline-block font-medium">
                               Note: {report.notes}
                             </div>
                           )}
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
    </div>
  );
}

export default DailyReportsPage;

import { Fragment, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import CustomSelect from '../components/CustomSelect';
import UserSessionBadge from '../components/UserSessionBadge';
import { formatDateTime } from '../utils/dateTime';
import AppSidebar from '../components/AppSidebar';
import { useCurrentRole } from '../utils/auth';

const EMPTY_FILTERS = {
  from: '',
  to: '',
  user: '',
  action: '',
  entityType: '',
  status: '',
  search: '',
};

function prettyLabel(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPlainObject(value) {
  return Boolean(value) && Object.prototype.toString.call(value) === '[object Object]';
}

function formatValue(value) {
  if (value == null) return '—';
  if (value === '') return '—';

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value instanceof Date) {
    return formatDateTime(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatValue(item)).join(', ');
  }

  if (isPlainObject(value)) {
    if (value.name && typeof value.name === 'string') {
      return value.name;
    }

    if (value.name && value.type && Object.keys(value).length <= 4) {
      return `${value.name} (${value.type})`;
    }

    if (value._id && typeof value._id === 'string') {
      return value._id;
    }

    return JSON.stringify(value);
  }

  return String(value);
}

const ENTITY_FIELD_MAP = {
  transaction: ['type', 'amount', 'date', 'description'],
  ledger: ['name', 'type', 'description'],
  user: ['username', 'displayName', 'role', 'active'],
  auth: ['status', 'description'],
  export: ['status', 'description'],
  report: ['date', 'closingBalance', 'transactionCount', 'notes'],
};

function getEntityFields(entry) {
  return ENTITY_FIELD_MAP[String(entry?.entityType || '').toLowerCase()] || ['description'];
}

function getChangeRows(entry) {
  const before = entry.before || {};
  const after = entry.after || {};
  const fields = getEntityFields(entry);

  return fields
    .map((field) => ({
      field,
      before: before[field],
      after: after[field],
    }))
    .filter((item) => formatValue(item.before) !== formatValue(item.after));
}

function AuditLogsPage() {
  const role = useCurrentRole();
  const [logs, setLogs] = useState([]);
  const [userOptions, setUserOptions] = useState([{ value: '', label: 'All Users' }]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  async function loadLogs(nextPage = page) {
    setLoading(true);
    try {
      const { data } = await api.get('/audit-logs', {
        params: {
          page: nextPage,
          limit: 25,
          ...filters,
          from: filters.from || undefined,
          to: filters.to || undefined,
          user: filters.user || undefined,
          action: filters.action || undefined,
          entityType: filters.entityType || undefined,
          status: filters.status || undefined,
          search: filters.search || undefined,
        },
      });

      setLogs(data.items || []);
      setTotal(data.total || 0);
      setPage(data.page || 1);
      setTotalPages(data.totalPages || 1);
      setSelectedLog(null);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs(1);
  }, [filters]);

  useEffect(() => {
    let active = true;

    async function loadUserOptions() {
      try {
        const { data } = await api.get('/users');
        if (!active) return;

        const options = (Array.isArray(data) ? data : [])
          .map((user) => {
            const username = String(user?.username || '').trim();
            if (!username) return null;

            const displayName = String(user?.displayName || '').trim();
            return {
              value: username,
              label: displayName ? `${displayName} (${username})` : username,
            };
          })
          .filter(Boolean)
          .sort((a, b) => a.label.localeCompare(b.label));

        setUserOptions([{ value: '', label: 'All Users' }, ...options]);
      } catch (error) {
        console.error('Failed to load users for audit filter', error);
      }
    }

    loadUserOptions();

    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    return logs.reduce(
      (acc, log) => {
        acc.total += 1;
        if (log.status === 'SUCCESS') acc.success += 1;
        if (log.status === 'FAILED') acc.failed += 1;
        if (String(log.action || '').startsWith('DELETE')) acc.deleted += 1;
        return acc;
      },
      { total: 0, success: 0, failed: 0, deleted: 0 }
    );
  }, [logs]);

  const suspiciousIds = useMemo(() => {
    const flagged = new Set();
    // Logic for suspicious flagging...
    return flagged;
  }, [logs]);

  function exportCsv() {
    api
      .get('/audit-logs/export.csv', {
        params: { ...filters },
        responseType: 'blob',
      })
      .then(({ data, headers }) => {
        const blob = new Blob([data], { type: headers['content-type'] || 'text/csv;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `audit-logs-${dayjs().format('YYYYMMDD-HHmmss')}.csv`;
        link.click();
        window.URL.revokeObjectURL(url);
      });
  }

  function transactionTone(entry) {
    const snapshot = entry.after || entry.before || {};
    if (snapshot.type === 'income') return 'bg-emerald-100 text-emerald-700';
    if (snapshot.type === 'outgoing') return 'bg-red-100 text-red-700';
    return 'bg-slate-100 text-slate-700';
  }

  function getActionBadge(action) {
    const normalized = String(action || '').toUpperCase();
    if (normalized.includes('CREATE')) return { label: 'Created', tone: 'bg-emerald-100 text-emerald-700' };
    if (normalized.includes('UPDATE')) return { label: 'Updated', tone: 'bg-amber-100 text-amber-800' };
    if (normalized.includes('DELETE')) return { label: 'Deleted', tone: 'bg-red-100 text-red-700' };
    return { label: prettyLabel(action), tone: 'bg-slate-100 text-slate-700' };
  }

  function getRecordLabel(entry) {
    const snapshot = entry.after || entry.before || {};
    const entityType = String(entry.entityType || '').toLowerCase();
    if (entityType === 'ledger') return snapshot.name || 'Ledger';
    if (entityType === 'user') return snapshot.displayName || snapshot.username || 'User';
    if (entityType === 'report') return snapshot.date ? dayjs(snapshot.date).format('DD MMM YYYY') : 'Daily Report';
    return entry.description || prettyLabel(entry.entityType) || 'Record';
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f4faff] px-4 py-6 md:px-8">
      <div className="mx-auto flex max-w-[1700px] gap-5">
        <AppSidebar />
        <main className="min-w-0 flex-1 space-y-5">
          <header className="rounded-xl bg-white p-6 shadow-[0_12px_40px_rgba(0,31,42,0.06)] flex items-center justify-between border border-slate-50">
            <div>
              <h1 className="[font-family:Manrope,ui-sans-serif,system-ui] text-3xl font-black tracking-tight text-[#001f2a]">Audit Logs</h1>
              <p className="mt-1 text-sm font-medium text-slate-500 uppercase tracking-widest">System Activity Monitoring</p>
            </div>
            <div className="flex items-center gap-4">
              <UserSessionBadge compact />
              <Link to="/" className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-white">Back to Dashboard</Link>
            </div>
          </header>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             {[
               { label: 'Total', value: stats.total, color: 'text-[#001f2a]' },
               { label: 'Success', value: stats.success, color: 'text-emerald-600' },
               { label: 'Failed', value: stats.failed, color: 'text-red-600' },
               { label: 'Deletes', value: stats.deleted, color: 'text-slate-800' }
             ].map(s => (
               <div key={s.label} className="rounded-xl bg-white p-4 shadow-sm border border-slate-50 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{s.label}: <span className={`text-xs ml-1 ${s.color}`}>{s.value}</span></span>
               </div>
             ))}
          </div>

          <section className="rounded-xl bg-white p-5 shadow-sm border border-slate-50 space-y-6">
            <div className="flex items-center justify-between">
               <h3 className="text-xl font-black text-[#001f2a] tracking-tight">Filters</h3>
               {role === 'admin' && (
                 <button onClick={exportCsv} className="rounded-lg bg-[#00694b] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#004d37]">Export CSV</button>
               )}
            </div>
            <div className="grid gap-3 md:grid-cols-7">
               <input type="date" className="w-full rounded-lg border border-slate-100 bg-[#f4faff] px-3 py-2 text-xs font-bold text-[#001f2a] outline-none" value={filters.from} onChange={e => setFilters(p => ({...p, from: e.target.value}))} />
               <input type="date" className="w-full rounded-lg border border-slate-100 bg-[#f4faff] px-3 py-2 text-xs font-bold text-[#001f2a] outline-none" value={filters.to} onChange={e => setFilters(p => ({...p, to: e.target.value}))} />
               <CustomSelect value={filters.user} onChange={v => setFilters(p => ({...p, user: v}))} options={userOptions} buttonClassName="!rounded-lg !border-slate-100 !bg-[#f4faff] !text-xs !font-bold" />
               <input type="text" placeholder="Search..." className="w-full rounded-lg border border-slate-100 bg-[#f4faff] px-3 py-2 text-xs font-bold text-[#001f2a] outline-none" value={filters.search} onChange={e => setFilters(p => ({...p, search: e.target.value}))} />
               <CustomSelect value={filters.action} onChange={v => setFilters(p => ({...p, action: v}))} options={[{value: '', label: 'All Actions'}, {value: 'CREATE', label: 'Create'}, {value: 'UPDATE', label: 'Update'}, {value: 'DELETE', label: 'Delete'}]} buttonClassName="!rounded-lg !border-slate-100 !bg-[#f4faff] !text-xs !font-bold" />
               <CustomSelect value={filters.entityType} onChange={v => setFilters(p => ({...p, entityType: v}))} options={[{value: '', label: 'All Entities'}, {value: 'transaction', label: 'Transaction'}, {value: 'ledger', label: 'Ledger'}, {value: 'user', label: 'User'}]} buttonClassName="!rounded-lg !border-slate-100 !bg-[#f4faff] !text-xs !font-bold" />
               <CustomSelect value={filters.status} onChange={v => setFilters(p => ({...p, status: v}))} options={[{value: '', label: 'Any Status'}, {value: 'SUCCESS', label: 'Success'}, {value: 'FAILED', label: 'Failed'}]} buttonClassName="!rounded-lg !border-slate-100 !bg-[#f4faff] !text-xs !font-bold" />
            </div>
          </section>

          <section className="rounded-xl bg-white shadow-sm border border-slate-50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-50">
                    <th className="px-6 py-4">When</th>
                    <th className="px-6 py-4">Who</th>
                    <th className="px-6 py-4">Action</th>
                    <th className="px-6 py-4">Record</th>
                    <th className="px-6 py-4 text-right">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {logs.map((entry) => (
                    <tr key={entry._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-slate-400">{dayjs(entry.timestamp).format('hh:mm A')}</td>
                      <td className="px-6 py-4 font-bold text-[#001f2a]">{entry.userName || entry.actor || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${getActionBadge(entry.action).tone}`}>
                          {getActionBadge(entry.action).label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                         <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${transactionTone(entry)} mr-2`}>{prettyLabel(entry.entityType)}</span>
                         <span className="font-semibold text-slate-600">{getRecordLabel(entry)}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => setSelectedLog(entry)} className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-1.5 text-[10px] font-black uppercase hover:bg-white">Details</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>

      {selectedLog && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
             <div className="bg-slate-50 px-8 py-5 flex items-center justify-between border-b border-slate-100">
                <h3 className="text-xl font-black text-[#001f2a]">Audit Details</h3>
                <button onClick={() => setSelectedLog(null)} className="h-8 w-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-red-500 transition">✕</button>
             </div>
             <div className="p-8 overflow-y-auto space-y-6">
                <div className="grid grid-cols-2 gap-4">
                   <div className="rounded-lg bg-slate-50 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Actor</p>
                      <p className="font-bold text-[#001f2a]">{selectedLog.userName || selectedLog.actor}</p>
                   </div>
                   <div className="rounded-lg bg-slate-50 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Time</p>
                      <p className="font-bold text-[#001f2a]">{dayjs(selectedLog.timestamp).format('DD MMM YYYY, hh:mm A')}</p>
                   </div>
                </div>
                <div className="rounded-lg bg-slate-50 p-4">
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Description</p>
                   <p className="font-bold text-[#001f2a]">{selectedLog.description}</p>
                </div>
                <div>
                   <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1">Change Log</h4>
                   <div className="rounded-lg border border-slate-100 overflow-hidden">
                      <table className="w-full text-xs text-left">
                         <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                            <tr><th className="px-4 py-3">Field</th><th className="px-4 py-3">Before</th><th className="px-4 py-3">After</th></tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100">
                            {getChangeRows(selectedLog).map(row => (
                               <tr key={row.field}><td className="px-4 py-3 font-bold">{row.field}</td><td className="px-4 py-3 text-slate-500">{formatValue(row.before)}</td><td className="px-4 py-3 text-emerald-600 font-bold">{formatValue(row.after)}</td></tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuditLogsPage;
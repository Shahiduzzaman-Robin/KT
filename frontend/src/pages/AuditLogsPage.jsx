import { Fragment, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import CustomSelect from '../components/CustomSelect';
import UserSessionBadge from '../components/UserSessionBadge';
import { formatDateTime } from '../utils/dateTime';
import AppSidebar from '../components/AppSidebar';

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
      alert('Failed to load audit logs');
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
    const grouped = new Map();

    logs.forEach((entry) => {
      const key = entry.userId || entry.userName || entry.actor || 'system';
      const items = grouped.get(key) || [];
      items.push(entry);
      grouped.set(key, items);
    });

    const flagged = new Set();

    grouped.forEach((items) => {
      const sorted = [...items].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      const deleteCount = sorted.filter((item) => String(item.action || '').startsWith('DELETE')).length;

      if (deleteCount >= 3) {
        sorted.forEach((item) => {
          if (String(item.action || '').startsWith('DELETE')) {
            flagged.add(item._id);
          }
        });
      }

      for (let index = 0; index < sorted.length - 1; index += 1) {
        const current = sorted[index];
        const next = sorted[index + 1];
        const currentTime = new Date(current.timestamp).getTime();
        const nextTime = new Date(next.timestamp).getTime();

        if (
          String(current.action || '').startsWith('UPDATE') &&
          String(next.action || '').startsWith('UPDATE') &&
          Math.abs(currentTime - nextTime) < 5 * 60 * 1000
        ) {
          flagged.add(current._id);
          flagged.add(next._id);
        }
      }
    });

    return flagged;
  }, [logs]);

  function exportCsv() {
    api
      .get('/audit-logs/export.csv', {
        params: {
          from: filters.from || undefined,
          to: filters.to || undefined,
          user: filters.user || undefined,
          action: filters.action || undefined,
          entityType: filters.entityType || undefined,
          status: filters.status || undefined,
          search: filters.search || undefined,
        },
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
      })
      .catch((error) => {
        console.error(error);
        alert('Failed to export audit logs');
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
    if (normalized.includes('LOGIN')) return { label: 'Login', tone: 'bg-sky-100 text-sky-700' };
    if (normalized.includes('LOGOUT')) return { label: 'Logout', tone: 'bg-slate-100 text-slate-700' };
    if (normalized.includes('EXPORT')) return { label: 'Export', tone: 'bg-violet-100 text-violet-700' };

    return { label: prettyLabel(action), tone: 'bg-slate-100 text-slate-700' };
  }

  function getRecordLabel(entry) {
    const snapshot = entry.after || entry.before || {};
    const entityType = String(entry.entityType || '').toLowerCase();

    if (entityType === 'ledger') {
      return snapshot.name || entry.description || 'Ledger';
    }

    if (entityType === 'transaction') {
      return '';
    }

    if (entityType === 'user') {
      return snapshot.displayName || snapshot.username || entry.userName || 'User';
    }

    if (entityType === 'auth') {
      return '';
    }

    if (entityType === 'export') {
      return '';
    }

    return entry.description || prettyLabel(entry.entityType) || 'Record';
  }

  function openDetails(entry) {
    setSelectedLog(entry);
  }

  function closeDetails() {
    setSelectedLog(null);
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f4faff] px-4 py-6 md:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-36 right-[-10%] h-96 w-96 rounded-full bg-[#84f8c8]/25 blur-[110px]" />
        <div className="absolute bottom-[-18%] left-[-10%] h-80 w-80 rounded-full bg-[#d9f2ff] blur-[100px]" />
      </div>

      <div className="mx-auto flex max-w-[1700px] gap-5 px-0 md:px-0">
        <AppSidebar />

        <main className="min-w-0 flex-1 space-y-5">
        <header className="relative z-20 overflow-visible rounded-3xl bg-white/90 p-5 shadow-[0_12px_40px_rgba(0,31,42,0.06)] backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="mr-auto [font-family:Manrope,ui-sans-serif,system-ui] text-3xl font-bold tracking-tight text-[#001f2a] md:text-4xl">Audit Logs</h1>
            <UserSessionBadge />
            <Link className="rounded-xl bg-[#e6f6ff] px-4 py-2 text-sm font-semibold text-[#3d4a43] transition hover:bg-[#d9f2ff]" to="/">
              Back to Dashboard
            </Link>
          </div>
          <p className="mt-1 text-[#3d4a43]">Track critical actions, inspect before and after states, and monitor suspicious activity.</p>
        </header>

        <section className="rounded-3xl bg-[#e6f6ff] p-5">
          <div className="grid gap-3 md:grid-cols-4">
            <p className="rounded-2xl bg-white p-3 text-sm text-[#3d4a43]">Total: <span className="font-bold text-[#001f2a]">{stats.total}</span></p>
            <p className="rounded-2xl bg-white p-3 text-sm text-[#3d4a43]">Success: <span className="font-bold text-[#00694b]">{stats.success}</span></p>
            <p className="rounded-2xl bg-white p-3 text-sm text-[#3d4a43]">Failed: <span className="font-bold text-[#ba1a1a]">{stats.failed}</span></p>
            <p className="rounded-2xl bg-white p-3 text-sm text-[#3d4a43]">Deletes: <span className="font-bold text-[#001f2a]">{stats.deleted}</span></p>
          </div>
        </section>

        <section className="rounded-3xl bg-[#e6f6ff] p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="mr-auto [font-family:Manrope,ui-sans-serif,system-ui] text-2xl font-bold text-[#001f2a]">Filters</h2>
            <button
              className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#3d4a43] transition hover:bg-[#d9f2ff]"
              type="button"
              onClick={() => setFilters((prev) => ({ ...prev, from: '', to: '' }))}
            >
              All Time
            </button>
            <button
              className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#3d4a43] transition hover:bg-[#d9f2ff]"
              type="button"
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  from: dayjs().format('YYYY-MM-DD'),
                  to: dayjs().format('YYYY-MM-DD'),
                }))
              }
            >
              Today
            </button>
            <button
              className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#3d4a43] transition hover:bg-[#d9f2ff]"
              type="button"
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  from: dayjs().startOf('week').format('YYYY-MM-DD'),
                  to: dayjs().format('YYYY-MM-DD'),
                }))
              }
            >
              Week
            </button>
            <button
              className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#3d4a43] transition hover:bg-[#d9f2ff]"
              type="button"
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  from: dayjs().startOf('month').format('YYYY-MM-DD'),
                  to: dayjs().format('YYYY-MM-DD'),
                }))
              }
            >
              Month
            </button>
            <button className="rounded-xl bg-gradient-to-br from-[#00694b] to-[#008560] px-4 py-2 text-xs font-semibold text-white transition hover:opacity-95" type="button" onClick={exportCsv}>
              Export CSV
            </button>
          </div>

          <div className="grid gap-2 md:grid-cols-7">
            <input
              className="w-full rounded-xl border border-transparent bg-white px-3 py-2 text-[#001f2a] outline-none transition focus:shadow-[0_0_0_2px_rgba(0,108,77,0.2)]"
              type="date"
              value={filters.from}
              onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))}
            />
            <input
              className="w-full rounded-xl border border-transparent bg-white px-3 py-2 text-[#001f2a] outline-none transition focus:shadow-[0_0_0_2px_rgba(0,108,77,0.2)]"
              type="date"
              value={filters.to}
              onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))}
            />
            <CustomSelect
              value={filters.user}
              onChange={(user) => setFilters((prev) => ({ ...prev, user }))}
              options={userOptions}
              buttonClassName="!rounded-xl !border-transparent !bg-white"
            />
            <input
              className="w-full rounded-xl border border-transparent bg-white px-3 py-2 text-[#001f2a] outline-none transition focus:shadow-[0_0_0_2px_rgba(0,108,77,0.2)]"
              placeholder="Search description"
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            />
            <CustomSelect
              value={filters.action}
              onChange={(action) => setFilters((prev) => ({ ...prev, action }))}
              options={[
                { value: '', label: 'All Actions' },
                { value: 'create', label: 'Create' },
                { value: 'update', label: 'Update' },
                { value: 'delete', label: 'Delete' },
                { value: 'login', label: 'Login' },
                { value: 'logout', label: 'Logout' },
                { value: 'export', label: 'Export' },
              ]}
              buttonClassName="!rounded-xl !border-transparent !bg-white"
            />
            <CustomSelect
              value={filters.entityType}
              onChange={(entityType) => setFilters((prev) => ({ ...prev, entityType }))}
              options={[
                { value: '', label: 'All Entities' },
                { value: 'transaction', label: 'Transaction' },
                { value: 'ledger', label: 'Ledger' },
                { value: 'user', label: 'User' },
                { value: 'auth', label: 'Auth' },
                { value: 'export', label: 'Export' },
              ]}
              buttonClassName="!rounded-xl !border-transparent !bg-white"
            />
            <CustomSelect
              value={filters.status}
              onChange={(status) => setFilters((prev) => ({ ...prev, status }))}
              options={[
                { value: '', label: 'Any Status' },
                { value: 'success', label: 'SUCCESS' },
                { value: 'failed', label: 'FAILED' },
                { value: 'pending', label: 'PENDING' },
              ]}
              buttonClassName="!rounded-xl !border-transparent !bg-white"
            />
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-[0_12px_40px_rgba(0,31,42,0.06)]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="[font-family:Manrope,ui-sans-serif,system-ui] text-2xl font-bold text-[#001f2a]">Activity</h2>
            {loading ? <p className="text-sm text-[#3d4a43]">Loading...</p> : null}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="text-[11px] uppercase tracking-[0.16em] text-[#3d4a43]">
                <tr>
                  <th className="rounded-l-xl bg-[#e6f6ff] px-4 py-3 text-left">When</th>
                  <th className="bg-[#e6f6ff] px-4 py-3 text-left">Who</th>
                  <th className="bg-[#e6f6ff] px-4 py-3 text-left">What</th>
                  <th className="bg-[#e6f6ff] px-4 py-3 text-left">Record</th>
                  <th className="bg-[#e6f6ff] px-4 py-3 text-left">Summary</th>
                  <th className="bg-[#e6f6ff] px-4 py-3 text-left">Status</th>
                  <th className="rounded-r-xl bg-[#e6f6ff] px-4 py-3 text-left">View</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((entry, index) => {
                  const suspicious = suspiciousIds.has(entry._id);
                  const entityTone = entry.entityType === 'transaction' ? transactionTone(entry) : 'bg-slate-100 text-slate-700';
                  const actionBadge = getActionBadge(entry.action);
                  const userLabel = entry.userName || entry.actor || '-';
                  const roleLabel = entry.role ? prettyLabel(entry.role) : '';
                  const recordLabel = getRecordLabel(entry);

                  return (
                    <Fragment key={entry._id}>
                      <tr className={`align-top transition hover:bg-[#eaf7ff] ${suspicious ? 'bg-amber-50/70' : index % 2 ? 'bg-[#f8fcff]' : 'bg-white'}`}>
                        <td className="px-4 py-4 text-[#3d4a43]">{formatDateTime(entry.timestamp)}</td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-[#001f2a]">{userLabel}</p>
                          {roleLabel ? <p className="text-xs text-slate-500">{roleLabel}</p> : null}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${actionBadge.tone}`}>
                              {actionBadge.label}
                            </span>
                            {suspicious ? (
                              <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-800">
                                Suspicious
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${entityTone}`}>
                              {prettyLabel(entry.entityType)}
                            </span>
                            {recordLabel ? <span className="font-medium text-slate-600">{recordLabel}</span> : null}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-[#3d4a43]">{entry.description || '-'}</td>
                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${
                              entry.status === 'SUCCESS'
                                ? 'bg-emerald-100 text-emerald-700'
                                : entry.status === 'FAILED'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {entry.status || 'SUCCESS'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <button className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#001f2a] shadow-[0_4px_14px_rgba(0,31,42,0.08)] transition hover:bg-[#e6f6ff]" type="button" onClick={() => openDetails(entry)}>
                            See Details
                          </button>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}

                {!loading && logs.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-slate-500">
                      No audit logs found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex items-center justify-between">
            <button className="rounded-xl bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#3d4a43] shadow-[0_4px_14px_rgba(0,31,42,0.08)] transition hover:bg-[#e6f6ff] disabled:cursor-not-allowed disabled:opacity-50" type="button" onClick={() => loadLogs(page - 1)} disabled={page <= 1}>
              Previous
            </button>
            <p className="text-sm text-[#3d4a43]">
              Page {page} / {Math.max(totalPages, 1)} | Total: {total}
            </p>
            <button className="rounded-xl bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#3d4a43] shadow-[0_4px_14px_rgba(0,31,42,0.08)] transition hover:bg-[#e6f6ff] disabled:cursor-not-allowed disabled:opacity-50" type="button" onClick={() => loadLogs(page + 1)} disabled={page >= totalPages}>
              Next
            </button>
          </div>
        </section>
        </main>
      </div>

      {selectedLog ? (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md">
          <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 bg-[#e6f6ff] px-6 py-5">
              <div>
                <h3 className="[font-family:Manrope,ui-sans-serif,system-ui] text-2xl font-bold text-[#001f2a]">Audit Details</h3>
                <p className="mt-1 text-sm text-[#3d4a43]">Full audit payload with previous values and who made the change.</p>
              </div>
              <button className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#3d4a43] shadow-[0_4px_14px_rgba(0,31,42,0.08)] transition hover:bg-[#d9f2ff]" type="button" onClick={closeDetails}>
                Close
              </button>
            </div>

            <div className="max-h-[calc(90vh-92px)] overflow-auto px-6 py-5">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl bg-[#f4faff] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">User</p>
                  <p className="mt-1 text-sm font-semibold text-[#001f2a]">{selectedLog.userName || selectedLog.actor || '-'}</p>
                </div>
                <div className="rounded-2xl bg-[#f4faff] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Action</p>
                  <p className="mt-1 text-sm font-semibold text-[#001f2a]">{prettyLabel(selectedLog.action)}</p>
                </div>
                <div className="rounded-2xl bg-[#f4faff] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Role</p>
                  <p className="mt-1 text-sm font-semibold text-[#001f2a]">{selectedLog.role || '-'}</p>
                </div>
                <div className="rounded-2xl bg-[#f4faff] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
                  <p className="mt-1 text-sm font-semibold text-[#001f2a]">{selectedLog.status || 'SUCCESS'}</p>
                </div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-[#f4faff] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Entity</p>
                  <p className="mt-1 text-sm font-semibold text-[#001f2a]">{prettyLabel(selectedLog.entityType)}</p>
                </div>
                <div className="rounded-2xl bg-[#f4faff] p-4 md:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</p>
                  <p className="mt-1 text-sm font-semibold text-[#001f2a]">{selectedLog.description || '-'}</p>
                </div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-[#f4faff] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Time</p>
                  <p className="mt-1 text-sm font-semibold text-[#001f2a]">{formatDateTime(selectedLog.timestamp)}</p>
                </div>
                <div className="rounded-2xl bg-[#f4faff] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">IP Address</p>
                  <p className="mt-1 text-sm font-semibold text-[#001f2a]">{selectedLog.ipAddress || '-'}</p>
                </div>
                <div className="rounded-2xl bg-[#f4faff] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Device</p>
                  <p className="mt-1 text-sm font-semibold text-[#001f2a]">{selectedLog.deviceInfo || '-'}</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-[#f4faff] p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-bold uppercase tracking-wide text-slate-500">Changes</h4>
                  <p className="text-xs text-slate-500">What changed in this event.</p>
                </div>

                {getChangeRows(selectedLog).length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                        <tr>
                          <th className="rounded-l-xl bg-[#e6f6ff] px-3 py-2 text-left">Field</th>
                          <th className="bg-[#e6f6ff] px-3 py-2 text-left">Previous</th>
                          <th className="rounded-r-xl bg-[#e6f6ff] px-3 py-2 text-left">Current</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getChangeRows(selectedLog).map((change) => (
                          <tr key={change.field} className="align-top odd:bg-white even:bg-[#f8fcff]">
                            <td className="px-3 py-3 font-semibold text-[#001f2a]">{change.field}</td>
                            <td className="px-3 py-3 text-[#3d4a43]">{formatValue(change.before)}</td>
                            <td className="px-3 py-3 text-[#001f2a]">{formatValue(change.after)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No field-level changes recorded.</p>
                )}
              </div>

              <details className="mt-4 rounded-2xl bg-[#f4faff] p-4">
                <summary className="cursor-pointer text-sm font-bold uppercase tracking-wide text-slate-500">
                  Advanced Raw Data
                </summary>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-white p-4">
                    <h5 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Before</h5>
                    <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-700">{JSON.stringify(selectedLog.before || {}, null, 2)}</pre>
                  </div>
                  <div className="rounded-2xl bg-white p-4">
                    <h5 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">After</h5>
                    <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-700">{JSON.stringify(selectedLog.after || {}, null, 2)}</pre>
                  </div>
                </div>
                <div className="mt-3 rounded-2xl bg-white p-4">
                  <h5 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Metadata</h5>
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-700">{JSON.stringify(selectedLog.metadata || {}, null, 2)}</pre>
                </div>
              </details>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default AuditLogsPage;
import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Link, useParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import api from '../utils/api';
import AppSidebar from '../components/AppSidebar';
import UserSessionBadge from '../components/UserSessionBadge';
import CustomSelect from '../components/CustomSelect';

const PAGE_SIZE = 100;

function formatBDT(value) {
  return `৳ ${Number(value || 0).toLocaleString()}`;
}

function formatTransactionValue(value) {
  if (value == null || value === '') return '—';

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value instanceof Date) {
    return dayjs(value).format('DD MMM YYYY, hh:mm:ss A');
  }

  if (typeof value === 'object') {
    if (value.name && value.type) return `${value.name} (${value.type})`;
    if (value.name) return value.name;
    return JSON.stringify(value);
  }

  return String(value);
}

function formatTransactionFieldValue(field, value) {
  if (String(field) === 'date' && value) {
    const parsed = dayjs(value);
    if (parsed.isValid()) {
      return parsed.format('DD MMM YYYY');
    }
  }

  return formatTransactionValue(value);
}

function buildTransactionChangeRows(before = {}, after = {}) {
  const fields = ['ledger', 'type', 'amount', 'date', 'description', 'createdBy', 'createdByRole'];

  return fields
    .map((field) => ({
      field,
      before: before[field],
      after: after[field],
    }))
    .filter((item) => formatTransactionValue(item.before) !== formatTransactionValue(item.after));
}

function getTimelineHeading(action, label) {
  const normalized = String(action || '').toUpperCase();
  if (normalized === 'CREATE_TRANSACTION') return 'Record Created';
  if (normalized === 'UPDATE_TRANSACTION') return 'Record Edited';
  if (normalized === 'DELETE_TRANSACTION') return 'Record Deleted';
  return `Record ${String(label || 'Updated')}`;
}

function formatTimelineAgo(value) {
  const date = dayjs(value);
  if (!date.isValid()) return '';

  const now = dayjs();
  const minutes = Math.max(now.diff(date, 'minute'), 0);

  if (minutes < 1) return 'JUST NOW';
  if (minutes < 60) return `${minutes} MINUTE${minutes === 1 ? '' : 'S'} AGO`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} HOUR${hours === 1 ? '' : 'S'} AGO`;

  const days = Math.floor(hours / 24);
  return `${days} DAY${days === 1 ? '' : 'S'} AGO`;
}

function LedgerDetailsPage() {
  const { id } = useParams();

  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    type: '',
    from: '',
    to: '',
    minAmount: '',
    maxAmount: '',
    search: '',
  });
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [transactionDetailsLoading, setTransactionDetailsLoading] = useState(false);
  const [transactionDetailsError, setTransactionDetailsError] = useState('');
  const [transactionDetailsState, setTransactionDetailsState] = useState(null);
  const [childLedgers, setChildLedgers] = useState([]);
  const [childLedgersLoading, setChildLedgersLoading] = useState(false);

  async function loadChildLedgers() {
    if (!id) return;

    setChildLedgersLoading(true);
    try {
      const { data } = await api.get('/ledgers', {
        params: { search: '', limit: 100, parentId: id },
      });
      setChildLedgers(data || []);
    } catch (requestError) {
      console.error('Failed to load child ledgers', requestError);
      setChildLedgers([]);
    } finally {
      setChildLedgersLoading(false);
    }
  }

  async function loadSummary() {
    if (!id) return;

    setSummaryLoading(true);
    try {
      const { data } = await api.get(`/ledgers/${id}/summary`);
      setSummary(data);
    } catch (requestError) {
      console.error(requestError);
      setError(requestError.response?.data?.message || 'Failed to load ledger summary');
    } finally {
      setSummaryLoading(false);
    }
  }

  async function loadTransactions(nextPage = 1) {
    if (!id) return;

    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/ledgers/${id}/transactions`, {
        params: {
          page: nextPage,
          limit: PAGE_SIZE,
          type: filters.type || undefined,
          from: filters.from || undefined,
          to: filters.to || undefined,
          minAmount: filters.minAmount || undefined,
          maxAmount: filters.maxAmount || undefined,
          search: filters.search || undefined,
        },
      });

      setTransactions(data.items || []);
      setPage(data.page || 1);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (requestError) {
      console.error(requestError);
      setError(requestError.response?.data?.message || 'Failed to load ledger transactions');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSummary();
    loadChildLedgers();
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadTransactions(1);
    }, 160);

    return () => clearTimeout(timer);
  }, [id, filters]);

  useEffect(() => {
    if (!selectedTransaction) return undefined;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [selectedTransaction]);

  const stats = useMemo(() => {
    const base = summary || {
      totalIncoming: 0,
      totalOutgoing: 0,
      balance: 0,
      transactionCount: 0,
      lastTransactionAt: null,
      ledger: null,
    };

    return [
      { key: 'incoming', label: 'Total Incoming', value: formatBDT(base.totalIncoming), tone: 'text-[#00694b]', bg: 'bg-[#84f8c8]/40' },
      { key: 'outgoing', label: 'Total Outgoing', value: formatBDT(base.totalOutgoing), tone: 'text-[#93000a]', bg: 'bg-[#ffdad6]' },
      { key: 'balance', label: 'Current Balance', value: formatBDT(base.balance), tone: base.balance >= 0 ? 'text-[#00694b]' : 'text-[#93000a]', bg: base.balance >= 0 ? 'bg-[#d9f8ea]' : 'bg-[#ffdad6]' },
      { key: 'count', label: 'Transactions', value: Number(base.transactionCount || 0).toLocaleString(), tone: 'text-[#001f2a]', bg: 'bg-[#e6f6ff]' },
    ];
  }, [summary]);

  const ledger = summary?.ledger;
  const sortedHistory = [...(transactionDetailsState?.history || [])].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  const isGroupLedger = ledger?.isGroup === true;

  // Calculate running balance for each transaction
  const transactionsWithBalance = useMemo(() => {
    // Use signed balance: positive = Cr, negative = Dr
    let runningBalance = ledger?.closingBalanceNum || 0;
    if (ledger?.closingBalanceType === 'Dr') {
      runningBalance = -runningBalance;
    }

    // Sort transactions chronologically (oldest first)
    const sortedTransactions = [...transactions].sort((a, b) => {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    return sortedTransactions.map((tx) => {
      // Determine debit/credit amount
      const isCredit = tx.type === 'income';
      const debitAmount = tx.type === 'outgoing' ? tx.amount : 0;
      const creditAmount = tx.type === 'income' ? tx.amount : 0;

      // Update running balance
      if (isCredit) {
        runningBalance += creditAmount; // Credit adds to balance
      } else {
        runningBalance -= debitAmount; // Debit subtracts from balance
      }

      // Determine balance type and absolute value
      const balanceType = runningBalance >= 0 ? 'Cr' : 'Dr';
      const balanceValue = Math.abs(runningBalance);

      return {
        ...tx,
        debitAmount,
        creditAmount,
        runningBalance: balanceValue,
        balanceType,
      };
    });
  }, [transactions, ledger]);

  async function openTransactionDetails(transaction) {
    setSelectedTransaction(transaction);
    setTransactionDetailsLoading(true);
    setTransactionDetailsError('');
    setTransactionDetailsState({ transaction, history: [] });

    try {
      const { data } = await api.get(`/transactions/${transaction._id}/history`);
      setTransactionDetailsState({
        transaction: data.transaction || transaction,
        history: data.history || [],
      });
    } catch (requestError) {
      console.error(requestError);
      setTransactionDetailsError(requestError.response?.data?.message || 'Failed to load transaction details');
    } finally {
      setTransactionDetailsLoading(false);
    }
  }

  function closeTransactionDetails() {
    setSelectedTransaction(null);
    setTransactionDetailsLoading(false);
    setTransactionDetailsError('');
    setTransactionDetailsState(null);
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f4faff] px-4 py-6 md:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 right-[-8%] h-96 w-96 rounded-full bg-[#84f8c8]/25 blur-[110px]" />
        <div className="absolute bottom-[-18%] left-[-8%] h-80 w-80 rounded-full bg-[#d9f2ff] blur-[100px]" />
      </div>

      <div className="mx-auto flex max-w-[1700px] gap-5 px-0 md:px-0">
        <AppSidebar />

        <main className="min-w-0 flex-1 space-y-5">
          <header className="relative z-20 overflow-visible rounded-3xl bg-white/92 p-4 shadow-[0_12px_40px_rgba(0,31,42,0.06)] backdrop-blur md:p-5">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#00694b] via-[#008560] to-[#67dbad]" />

            <div className="flex flex-wrap items-start gap-3 pt-1">
              <div className="mr-auto min-w-[220px]">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#00694b]">Ledger Details</p>
                <h1 className="[font-family:Manrope,ui-sans-serif,system-ui] text-3xl font-bold tracking-tight text-[#001f2a] md:text-5xl">
                  {ledger?.name || 'Ledger'}
                </h1>
                <p className="mt-1 text-sm text-[#3d4a43]">
                  {summaryLoading
                    ? 'Loading ledger details...'
                    : `${ledger?.type || 'other'} ledger${ledger?.isActive === false ? ' • archived' : ''}`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Link className="rounded-xl bg-[#e6f6ff] px-4 py-2 text-sm font-semibold text-[#3d4a43] transition hover:bg-[#d9f2ff]" to="/ledgers">
                  Back to Ledgers
                </Link>
                <Link className="rounded-xl bg-[#e6f6ff] px-4 py-2 text-sm font-semibold text-[#3d4a43] transition hover:bg-[#d9f2ff]" to="/">
                  Dashboard
                </Link>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-[#e6f6ff] p-2">
              <UserSessionBadge compact />
            </div>

            {isGroupLedger && (
              <div className="mt-3 rounded-2xl border-2 border-[#0066cc] bg-[#cce5ff] p-3">
                <p className="text-sm font-semibold text-[#0066cc]">📊 This is a group ledger</p>
                <p className="text-xs text-[#003d99]">Transactions can only be added to child posting ledgers. Browse child accounts below.</p>
              </div>
            )}
          </header>

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {stats.map((item) => (
              <div key={item.key} className="rounded-2xl bg-white p-4 shadow-[0_12px_30px_rgba(0,31,42,0.05)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3d4a43]">{item.label}</p>
                <p className={`mt-2 [font-family:Manrope,ui-sans-serif,system-ui] text-3xl font-bold ${item.tone}`}>{item.value}</p>
                <span className={`mt-3 inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#3d4a43] ${item.bg}`}>
                  Ledger Metric
                </span>
              </div>
            ))}
          </section>

          <section className="rounded-3xl bg-[#e6f6ff] p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="mr-auto [font-family:Manrope,ui-sans-serif,system-ui] text-2xl font-bold text-[#001f2a]">Transaction Filters</h2>
              <button
                className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#3d4a43] transition hover:bg-[#d9f2ff]"
                type="button"
                onClick={() => setFilters({ type: '', from: '', to: '', minAmount: '', maxAmount: '', search: '' })}
              >
                Reset
              </button>
            </div>

            <div className="grid gap-2 md:grid-cols-6">
              <CustomSelect
                value={filters.type}
                onChange={(type) => setFilters((prev) => ({ ...prev, type }))}
                options={[
                  { value: '', label: 'All Types' },
                  { value: 'income', label: 'Income' },
                  { value: 'outgoing', label: 'Outgoing' },
                ]}
                buttonClassName="!rounded-xl !border-transparent !bg-white"
              />
              <input className="w-full rounded-xl border border-transparent bg-white px-3 py-2 text-[#001f2a] outline-none transition focus:shadow-[0_0_0_2px_rgba(0,108,77,0.2)]" type="date" value={filters.from} onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))} />
              <input className="w-full rounded-xl border border-transparent bg-white px-3 py-2 text-[#001f2a] outline-none transition focus:shadow-[0_0_0_2px_rgba(0,108,77,0.2)]" type="date" value={filters.to} onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))} />
              <input className="w-full rounded-xl border border-transparent bg-white px-3 py-2 text-[#001f2a] outline-none transition focus:shadow-[0_0_0_2px_rgba(0,108,77,0.2)]" type="number" placeholder="Min amount" value={filters.minAmount} onChange={(event) => setFilters((prev) => ({ ...prev, minAmount: event.target.value }))} />
              <input className="w-full rounded-xl border border-transparent bg-white px-3 py-2 text-[#001f2a] outline-none transition focus:shadow-[0_0_0_2px_rgba(0,108,77,0.2)]" type="number" placeholder="Max amount" value={filters.maxAmount} onChange={(event) => setFilters((prev) => ({ ...prev, maxAmount: event.target.value }))} />
              <input className="w-full rounded-xl border border-transparent bg-white px-3 py-2 text-[#001f2a] outline-none transition focus:shadow-[0_0_0_2px_rgba(0,108,77,0.2)]" type="text" placeholder="Search description" value={filters.search} onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))} />
            </div>
          </section>

          {isGroupLedger ? (
            <section className="rounded-3xl bg-white p-5 shadow-[0_12px_40px_rgba(0,31,42,0.06)]">
              <h2 className="mb-4 [font-family:Manrope,ui-sans-serif,system-ui] text-2xl font-bold text-[#001f2a]">Child Posting Ledgers</h2>
              {childLedgers.length === 0 ? (
                <p className="text-sm text-[#3d4a43]">No child ledgers for this group.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[960px] text-sm text-[#001f2a]">
                    <thead className="text-[11px] uppercase tracking-[0.16em] text-[#3d4a43]">
                      <tr>
                        <th className="rounded-l-xl bg-[#e6f6ff] px-4 py-3 text-left">Name</th>
                        <th className="bg-[#e6f6ff] px-4 py-3 text-left">Type</th>
                        <th className="bg-[#e6f6ff] px-4 py-3 text-left">Total Debit</th>
                        <th className="bg-[#e6f6ff] px-4 py-3 text-left">Total Credit</th>
                        <th className="bg-[#e6f6ff] px-4 py-3 text-left">Balance</th>
                        <th className="rounded-r-xl bg-[#e6f6ff] px-4 py-3 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {childLedgers.map((childLedger, index) => (
                        <tr key={childLedger._id} className={`${index % 2 ? 'bg-[#f8fcff]' : 'bg-white'} transition hover:bg-[#eaf7ff]`}>
                          <td className="px-4 py-4">
                            <Link className="underline decoration-transparent transition hover:decoration-current font-medium text-[#001f2a]" to={`/ledgers/${childLedger._id}`}>
                              {childLedger.name}
                            </Link>
                          </td>
                          <td className="px-4 py-4 uppercase text-[#3d4a43] text-sm">{childLedger.type}</td>
                          <td className="px-4 py-4 text-[#00694b] font-semibold">{formatBDT(childLedger.totalDebit)}</td>
                          <td className="px-4 py-4 text-[#93000a] font-semibold">{formatBDT(childLedger.totalCredit)}</td>
                          <td className="px-4 py-4 font-semibold text-[#001f2a]">
                            {formatBDT(childLedger.totalDebit - childLedger.totalCredit)}
                          </td>
                          <td className="px-4 py-4">
                            <Link className="rounded-xl bg-[#e6f6ff] px-3 py-2 text-xs font-semibold text-[#3d4a43] transition hover:bg-[#d9f2ff] inline-block" to={`/ledgers/${childLedger._id}`}>
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : (
            <section className="rounded-3xl bg-white p-5 shadow-[0_12px_40px_rgba(0,31,42,0.06)]">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <h2 className="mr-auto [font-family:Manrope,ui-sans-serif,system-ui] text-2xl font-bold text-[#001f2a]">Ledger Transactions</h2>
                <p className="rounded-xl bg-[#e6f6ff] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#3d4a43]">Total {total}</p>
              </div>

              {error ? <p className="mb-3 text-sm text-[#93000a]">{error}</p> : null}
              {loading ? <p className="mb-3 text-sm text-[#3d4a43]">Loading transactions...</p> : null}

              <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-sm text-[#001f2a]">
                <thead className="text-[11px] uppercase tracking-[0.16em] text-[#3d4a43]">
                  <tr>
                    <th className="rounded-l-xl bg-[#e6f6ff] px-4 py-3 text-left">Date</th>
                    <th className="bg-[#e6f6ff] px-4 py-3 text-left">Particulars</th>
                    <th className="bg-[#e6f6ff] px-4 py-3 text-right">Debit</th>
                    <th className="bg-[#e6f6ff] px-4 py-3 text-right">Credit</th>
                    <th className="bg-[#e6f6ff] px-4 py-3 text-right">Balance</th>
                    <th className="rounded-r-xl bg-[#e6f6ff] px-4 py-3 text-left">Details</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-none">
                  {transactionsWithBalance.map((transaction, index) => (
                    <tr
                      key={transaction._id}
                      className={`${index % 2 ? 'bg-[#f8fcff]' : 'bg-white'} align-top transition hover:bg-[#eaf7ff] cursor-pointer`}
                      role="button"
                      tabIndex={0}
                      onClick={() => openTransactionDetails(transaction)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openTransactionDetails(transaction);
                        }
                      }}
                    >
                      <td className="px-4 py-4 text-[13px] font-medium text-[#3d4a43]">{dayjs(transaction.date).format('DD MMM YYYY')}</td>
                      <td className="px-4 py-4 text-[13px] text-[#3d4a43]">{transaction.description || '(No particulars)'}</td>
                      <td className="px-4 py-4 text-right">
                        {transaction.debitAmount > 0 ? (
                          <span className="[font-family:Manrope,ui-sans-serif,system-ui] font-bold text-[#93000a]">{formatBDT(transaction.debitAmount)}</span>
                        ) : (
                          <span className="text-[#3d4a43]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        {transaction.creditAmount > 0 ? (
                          <span className="[font-family:Manrope,ui-sans-serif,system-ui] font-bold text-[#00694b]">{formatBDT(transaction.creditAmount)}</span>
                        ) : (
                          <span className="text-[#3d4a43]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className={`[font-family:Manrope,ui-sans-serif,system-ui] font-bold ${transaction.balanceType === 'Dr' ? 'text-[#93000a]' : 'text-[#00694b]'}`}>
                          {formatBDT(transaction.runningBalance)} {transaction.balanceType}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#001f2a] shadow-[0_4px_14px_rgba(0,31,42,0.08)] transition hover:bg-[#e6f6ff]"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openTransactionDetails(transaction);
                          }}
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}

                  {!loading && transactionsWithBalance.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-4 py-8 text-center text-slate-500">No transactions found for this ledger.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <button className="rounded-xl bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#3d4a43] shadow-[0_4px_14px_rgba(0,31,42,0.08)] transition hover:bg-[#e6f6ff] disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={page <= 1} onClick={() => loadTransactions(page - 1)}>
                Previous
              </button>
              <p className="text-sm font-medium text-[#3d4a43]">
                Page {page} / {Math.max(totalPages, 1)} (100 per page)
              </p>
              <button className="rounded-xl bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#3d4a43] shadow-[0_4px_14px_rgba(0,31,42,0.08)] transition hover:bg-[#e6f6ff] disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={page >= totalPages} onClick={() => loadTransactions(page + 1)}>
                Next
              </button>
            </div>
            </section>
          )}
        </main>
      </div>

      {selectedTransaction
        ? createPortal(
            <div className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md">
              <div className="w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-3 bg-[#e6f6ff] px-6 py-5">
                  <div>
                    <h3 className="[font-family:Manrope,ui-sans-serif,system-ui] text-2xl font-bold text-[#001f2a]">Transaction Details</h3>
                    <p className="mt-1 text-sm text-[#3d4a43]">Creator, every edit, edit time, and value changes in one place.</p>
                  </div>
                  <button className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#3d4a43] shadow-[0_4px_14px_rgba(0,31,42,0.08)] transition hover:bg-[#d9f2ff]" type="button" onClick={closeTransactionDetails}>
                    Close
                  </button>
                </div>

                <div className="max-h-[calc(90vh-92px)] overflow-auto px-6 py-5">
                  {transactionDetailsLoading ? (
                    <p className="text-sm text-slate-600">Loading details...</p>
                  ) : transactionDetailsError ? (
                    <p className="text-sm text-red-700">{transactionDetailsError}</p>
                  ) : (
                    <>
                      <div className="grid gap-3 md:grid-cols-4">
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ledger</p>
                          <p className="mt-1 text-sm font-semibold text-slate-800">{transactionDetailsState.transaction.ledgerId?.name || transactionDetailsState.transaction.ledger || 'N/A'}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Type</p>
                          <p className="mt-1 text-sm font-semibold text-slate-800">{formatTransactionValue(transactionDetailsState.transaction.type)}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</p>
                          <p className="mt-1 text-sm font-semibold text-slate-800">{formatBDT(transactionDetailsState.transaction.amount)}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Created By</p>
                          <p className="mt-1 text-sm font-semibold text-slate-800">{transactionDetailsState.transaction.createdBy || '-'}</p>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-1">
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last Edited By</p>
                          <p className="mt-1 text-sm font-semibold text-slate-800">{transactionDetailsState.transaction.updatedBy || '-'}</p>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</p>
                          <p className="mt-1 text-sm font-semibold text-slate-800">{dayjs(transactionDetailsState.transaction.date).format('DD MMM YYYY')}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</p>
                          <p className="mt-1 text-sm font-semibold text-slate-800">{transactionDetailsState.transaction.description || '-'}</p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <h4 className="text-sm font-bold uppercase tracking-wide text-slate-500">Edit Timeline</h4>
                          <p className="text-xs text-slate-500">Latest activity appears first. Created event stays at the bottom.</p>
                        </div>

                        {sortedHistory.length > 0 ? (
                          <div className="space-y-4">
                            {sortedHistory.map((event, index) => {
                              const changeRows = buildTransactionChangeRows(event.before, event.after);
                              const isCreateEvent = String(event.action || '').toUpperCase() === 'CREATE_TRANSACTION';
                              const isLatestEvent = index === 0;
                              const isLastItem = index === sortedHistory.length - 1;
                              const timelineHeading = getTimelineHeading(event.action, event.label);
                              const timelineAgo = formatTimelineAgo(event.timestamp);
                              const dotTone = isLatestEvent ? 'border-emerald-50 bg-emerald-500' : 'border-slate-100 bg-slate-300';

                              return (
                                <div key={event.id} className="relative pl-14">
                                  {!isLastItem ? <span className="absolute left-[20px] top-12 bottom-[-18px] w-px bg-slate-200" /> : null}
                                  <span className={`absolute left-[8px] top-4 h-6 w-6 rounded-full border-4 ${dotTone} shadow-sm`} />

                                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                      <div>
                                        <p className="text-[2rem] font-extrabold tracking-wide text-slate-800">{timelineHeading}</p>
                                        <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                                          BY <span className="font-extrabold text-slate-500">{event.userName || '-'}</span>
                                          {timelineAgo ? ` • ${timelineAgo}` : ''}
                                        </p>
                                      </div>
                                      <div className="text-right text-sm text-slate-500">
                                        <p>{dayjs(event.timestamp).format('DD MMM YYYY, hh:mm:ss A')}</p>
                                        <p className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${event.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                          {event.status}
                                        </p>
                                      </div>
                                    </div>

                                    <p className="mt-3 text-sm text-slate-700">{event.description || '-'}</p>

                                    {changeRows.length > 0 ? (
                                      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                        <table className="w-full min-w-[640px] text-sm">
                                          <thead>
                                            <tr className="border-b border-slate-200 text-left text-slate-500">
                                              <th className="py-2 pr-3">Field</th>
                                              {!isCreateEvent ? <th className="py-2 pr-2 text-right">Previous</th> : null}
                                              {!isCreateEvent ? <th className="w-20 py-2 px-1 text-center"> </th> : null}
                                              <th className="py-2 pl-2 text-left">Updated</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {changeRows.map((change) => (
                                              <tr key={`${event.id}-${change.field}`} className="border-b border-slate-100 align-top last:border-b-0">
                                                <td className="py-2 pr-3 font-semibold text-slate-700">{change.field}</td>
                                                {!isCreateEvent ? <td className="py-2 pr-2 text-right text-slate-700"><span className="inline-block rounded-md bg-rose-50 px-2 py-0.5">{formatTransactionFieldValue(change.field, change.before)}</span></td> : null}
                                                {!isCreateEvent ? (
                                                  <td className="py-2 px-1 text-center text-slate-400">
                                                    <span className="inline-flex items-center justify-center" aria-hidden="true">
                                                      <svg width="68" height="14" viewBox="0 0 68 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M3 7H57" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                                                        <path d="M51 2L64 7L51 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                                      </svg>
                                                    </span>
                                                  </td>
                                                ) : null}
                                                <td className="py-2 pl-2 text-left text-slate-800"><span className="inline-block rounded-md bg-emerald-50 px-2 py-0.5">{formatTransactionFieldValue(change.field, change.after)}</span></td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500">No audit history found for this transaction.</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

export default LedgerDetailsPage;

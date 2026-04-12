import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { io } from 'socket.io-client';
import api from '../utils/api';
import Dashboard from '../components/Dashboard';
import TransactionForm from '../components/TransactionForm';
import TransactionTable from '../components/TransactionTable';
import CustomSelect from '../components/CustomSelect';
import UserSessionBadge from '../components/UserSessionBadge';
import { getSocketUrl } from '../utils/socket';
import AppSidebar from '../components/AppSidebar';
import { useCurrentRole } from '../utils/auth';
import ActionModal from '../components/ActionModal';

function HomePage() {
  const role = useCurrentRole();
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [quickSearch, setQuickSearch] = useState('');
  const [activeDatePreset, setActiveDatePreset] = useState('all');
  const [formHighlight, setFormHighlight] = useState(false);

  const [filters, setFilters] = useState({
    type: '',
    from: '',
    to: '',
    minAmount: '',
    maxAmount: '',
  });

  const [statusMessage, setStatusMessage] = useState(null); // { title, message, type }

  const [daily, setDaily] = useState({ income: 0, outgoing: 0, balance: 0 });
  const [monthly, setMonthly] = useState({ income: 0, outgoing: 0, balance: 0 });
  const pageRef = useRef(page);
  const refreshRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const latestSocketPayloadRef = useRef(null);
  const formSectionRef = useRef(null);

  const loadTransactions = useCallback(async (nextPage = 1) => {
    setLoading(true);
    try {
      const { data } = await api.get('/transactions', {
        params: {
          page: nextPage,
          limit: 50,
          ...filters,
          type: filters.type || undefined,
          minAmount: filters.minAmount || undefined,
          maxAmount: filters.maxAmount || undefined,
        },
      });
      setTransactions(data.items || []);
      setTotal(data.total || 0);
      setPage(data.page || 1);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error(error);
      setStatusMessage({
        title: 'Load Failed',
        message: 'Could not fetch latest transactions from the server.',
        type: 'danger'
      });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadSummary = useCallback(async () => {
    try {
      const [dailyRes, monthlyRes] = await Promise.all([
        api.get('/summary/daily', { params: { date: dayjs().format('YYYY-MM-DD') } }),
        api.get('/summary/monthly', { params: { month: dayjs().format('YYYY-MM') } }),
      ]);

      setDaily(dailyRes.data);
      setMonthly(monthlyRes.data);
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    loadTransactions(1);
    loadSummary();
  }, [filters, loadSummary, loadTransactions]);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    refreshRef.current = async (payload = {}) => {
      const nextPage = payload.action === 'created' ? 1 : pageRef.current;
      await loadTransactions(nextPage);
      await loadSummary();
    };
  }, [loadSummary, loadTransactions]);

  useEffect(() => {
    const socket = io(getSocketUrl(), {
      transports: ['websocket'],
    });

    function handleTransactionsChanged(payload) {
      latestSocketPayloadRef.current = payload || {};

      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }

      refreshTimerRef.current = setTimeout(() => {
        void refreshRef.current?.(latestSocketPayloadRef.current || {});
      }, 250);
    }

    socket.on('transactions:changed', handleTransactionsChanged);

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      socket.off('transactions:changed', handleTransactionsChanged);
      socket.disconnect();
    };
  }, []);

  const visibleTransactions = useMemo(() => {
    const query = quickSearch.trim().toLowerCase();
    if (!query) return transactions;

    return transactions.filter((item) => {
      const fields = [
        item.ledgerId?.name,
        item.type,
        item.description,
        item.createdBy,
      ];

      return fields.some((field) => String(field || '').toLowerCase().includes(query));
    });
  }, [quickSearch, transactions]);

  const searchEnabled = quickSearch.trim().length > 0;
  const tableTotal = searchEnabled ? visibleTransactions.length : total;
  const tableTotalPages = searchEnabled ? 1 : totalPages;

  useEffect(() => {
    if (!formHighlight) return undefined;

    const timer = setTimeout(() => {
      setFormHighlight(false);
    }, 1400);

    return () => clearTimeout(timer);
  }, [formHighlight]);

  function openNewTransactionArea() {
    setFormHighlight(true);
    formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function getDatePresetButtonClass(preset) {
    return activeDatePreset === preset
      ? 'rounded-lg bg-[#00694b] px-4 py-3 text-xs font-black text-white shadow-lg shadow-emerald-900/10 transition-all scale-[1.02]'
      : 'rounded-lg bg-[#eef8ff] px-4 py-3 text-xs font-black text-slate-500 transition-all hover:bg-[#e0f2fe] hover:text-[#001f2a]';
  }

  async function deleteTransaction(id) {
    await api.delete(`/transactions/${id}`);
    await loadTransactions(page);
    await loadSummary();
  }

  async function exportExcel() {
    try {
      const { data, headers } = await api.get('/exports/transactions.xlsx', {
        params: {
          type: filters.type || undefined,
          from: filters.from || undefined,
          to: filters.to || undefined,
          minAmount: filters.minAmount || undefined,
          maxAmount: filters.maxAmount || undefined,
        },
        responseType: 'blob',
      });

      const blob = new Blob([data], { type: headers['content-type'] || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `transactions-${dayjs().format('YYYYMMDD-HHmmss')}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      setStatusMessage({
        title: 'Export Failed',
        message: 'There was a problem generating the Excel report. Please try again.',
        type: 'danger'
      });
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f4faff] text-[#001f2a] [font-family:Inter,ui-sans-serif,system-ui]">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 right-[-10%] h-96 w-96 rounded-lg bg-[#84f8c8]/30 blur-[110px]" />
        <div className="absolute bottom-[-16%] left-[-5%] h-80 w-80 rounded-lg bg-[#d9f2ff] blur-[100px]" />
      </div>

      <div className="mx-auto flex max-w-[1700px] gap-5 px-4 py-5 md:px-6">
        <AppSidebar
          onExport={exportExcel}
          compactFilters={(
            <div className="flex flex-col h-full [font-family:Inter,ui-sans-serif,system-ui]">
              <div className="flex items-center justify-between mb-8 border-b border-slate-200 pb-4 no-print">
                <h3 className="text-xl font-black tracking-tight text-[#001f2a]">Filters</h3>
                <button
                  className="p-2 rounded-lg text-slate-400 hover:bg-white hover:text-[#ba1a1a] transition-all"
                  type="button"
                  title="Reset all filters"
                  onClick={() => {
                    setActiveDatePreset('all');
                    setFilters({ type: '', from: '', to: '', minAmount: '', maxAmount: '' });
                    loadTransactions(1);
                  }}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>

              <div className="space-y-8 flex-1">
                {/* Transaction Type */}
                <div className="space-y-4">
                  <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Transaction Type</label>
                  <CustomSelect
                    value={filters.type}
                    onChange={(nextType) => setFilters((prev) => ({ ...prev, type: nextType }))}
                    options={[
                      { value: '', label: 'All Types' },
                      { value: 'income', label: 'Income Only' },
                      { value: 'outgoing', label: 'Outgoing Only' },
                    ]}
                    buttonClassName="!rounded-lg !border-transparent !bg-[#eef8ff] !py-4 !text-sm !font-bold !text-[#001f2a]"
                  />
                </div>

                {/* Date Range */}
                <div className="space-y-4">
                  <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Date Range</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button className={getDatePresetButtonClass('today')} type="button" onClick={() => {
                      setActiveDatePreset('today');
                      setFilters((prev) => ({ ...prev, from: dayjs().format('YYYY-MM-DD'), to: dayjs().format('YYYY-MM-DD') }));
                    }}>Today</button>
                    <button className={getDatePresetButtonClass('week')} type="button" onClick={() => {
                      setActiveDatePreset('week');
                      setFilters((prev) => ({ ...prev, from: dayjs().subtract(6, 'days').format('YYYY-MM-DD'), to: dayjs().format('YYYY-MM-DD') }));
                    }}>This Week</button>
                    <button className={getDatePresetButtonClass('month')} type="button" onClick={() => {
                      setActiveDatePreset('month');
                      setFilters((prev) => ({ ...prev, from: dayjs().startOf('month').format('YYYY-MM-DD'), to: dayjs().format('YYYY-MM-DD') }));
                    }}>This Month</button>
                    <button className={getDatePresetButtonClass('all')} type="button" onClick={() => {
                      setActiveDatePreset('all');
                      setFilters((prev) => ({ ...prev, from: '', to: '' }));
                    }}>All Time</button>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#00694b]">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <input
                        className="w-full rounded-lg border-none bg-[#eef8ff] py-4 pl-12 pr-4 text-sm font-bold text-[#001f2a] outline-none ring-0 focus:bg-white focus:ring-2 focus:ring-[#00694b]/20"
                        type="date"
                        value={filters.from}
                        onChange={(e) => setFilters(p => ({ ...p, from: e.target.value }))}
                      />
                    </div>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#00694b]">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <input
                        className="w-full rounded-lg border-none bg-[#eef8ff] py-4 pl-12 pr-4 text-sm font-bold text-[#001f2a] outline-none ring-0 focus:bg-white focus:ring-2 focus:ring-[#00694b]/20"
                        type="date"
                        value={filters.to}
                        onChange={(e) => setFilters(p => ({ ...p, to: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Amount Range */}
                <div className="space-y-4 pb-10">
                  <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Amount Range</label>
                  <style>{`
                    input[type=number]::-webkit-inner-spin-button, 
                    input[type=number]::-webkit-outer-spin-button { 
                      -webkit-appearance: none; 
                      margin: 0; 
                    }
                    input[type=number] { -moz-appearance: textfield; }
                  `}</style>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-400 uppercase pointer-events-none">Min</span>
                      <input 
                        className="w-full rounded-lg border-none bg-[#eef8ff] py-4 pl-10 pr-2 text-xs font-bold text-[#001f2a] outline-none ring-0 focus:bg-white focus:ring-2 focus:ring-[#00694b]/20 transition-all" 
                        type="number" 
                        placeholder="0" 
                        value={filters.minAmount} 
                        onChange={(e) => setFilters(p => ({ ...p, minAmount: e.target.value }))} 
                      />
                    </div>
                    <span className="text-slate-300 font-bold text-xs">/</span>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-400 uppercase pointer-events-none">Max</span>
                      <input 
                        className="w-full rounded-lg border-none bg-[#eef8ff] py-4 pl-10 pr-2 text-xs font-bold text-[#001f2a] outline-none ring-0 focus:bg-white focus:ring-2 focus:ring-[#00694b]/20 transition-all" 
                        type="number" 
                        placeholder="Any" 
                        value={filters.maxAmount} 
                        onChange={(e) => setFilters(p => ({ ...p, maxAmount: e.target.value }))} 
                      />
                    </div>
                  </div>
                </div>
              </div>

              <button 
                className="w-full rounded-lg bg-[#00694b] py-5 text-sm font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-emerald-900/20 transition-all hover:scale-[1.02] hover:bg-[#004d37] active:scale-[0.98]" 
                type="button" 
                onClick={() => loadTransactions(1)}
              >
                Apply Filters
              </button>
            </div>
          )}
        />

        <main className="min-w-0 flex-1 space-y-4">
          <header className="sticky top-2 z-30 overflow-visible rounded-lg bg-white/92 p-4 shadow-[0_12px_40px_rgba(0,31,42,0.06)] backdrop-blur md:p-5">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#00694b] via-[#008560] to-[#67dbad]" />

            <div className="flex flex-wrap items-start gap-3 pt-1">
              <div className="mr-auto min-w-[220px]">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#00694b]">Live Cash Operations</p>
                <h1 className="[font-family:Manrope,ui-sans-serif,system-ui] text-3xl font-bold tracking-tight text-[#001f2a] md:text-5xl">
                  M/S Kamrul Traders
                </h1>
              </div>

              <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                <div className="rounded-lg bg-[#e6f6ff] p-2">
                  <UserSessionBadge compact />
                </div>
                <button
                  className="rounded-lg bg-gradient-to-br from-[#00694b] to-[#008560] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/15 transition hover:opacity-95"
                  type="button"
                  onClick={openNewTransactionArea}
                >
                  + New Transaction
                </button>
              </div>
            </div>
          </header>

          <div className="space-y-10 pb-12">
            <Dashboard daily={daily} monthly={monthly} />

            <section className="rounded-lg bg-[#e6f6ff] p-4 md:p-6 xl:hidden">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="mr-auto [font-family:Manrope,ui-sans-serif,system-ui] text-xl font-bold">Filters</h2>
                <button
                  className={getDatePresetButtonClass('all')}
                  type="button"
                  onClick={() => {
                    setActiveDatePreset('all');
                    setFilters((prev) => ({ ...prev, from: '', to: '' }));
                  }}
                >
                  All Time
                </button>
                <button
                  className={getDatePresetButtonClass('today')}
                  type="button"
                  onClick={() => {
                    setActiveDatePreset('today');
                    setFilters((prev) => ({ ...prev, from: dayjs().format('YYYY-MM-DD'), to: dayjs().format('YYYY-MM-DD') }));
                  }}
                >
                  Today
                </button>
                <button
                  className={getDatePresetButtonClass('week')}
                  type="button"
                  onClick={() => {
                    setActiveDatePreset('week');
                    setFilters((prev) => ({ ...prev, from: dayjs().startOf('week').format('YYYY-MM-DD'), to: dayjs().format('YYYY-MM-DD') }));
                  }}
                >
                  Week
                </button>
                <button
                  className={getDatePresetButtonClass('month')}
                  type="button"
                  onClick={() => {
                    setActiveDatePreset('month');
                    setFilters((prev) => ({ ...prev, from: dayjs().startOf('month').format('YYYY-MM-DD'), to: dayjs().format('YYYY-MM-DD') }));
                  }}
                >
                  Month
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-5">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Type</label>
                  <CustomSelect
                    value={filters.type}
                    onChange={(nextType) => setFilters((prev) => ({ ...prev, type: nextType }))}
                    options={[
                      { value: '', label: 'All Types' },
                      { value: 'income', label: 'Income' },
                      { value: 'outgoing', label: 'Outgoing' },
                    ]}
                    buttonClassName="!rounded-lg !border-transparent !bg-white !text-[#001f2a]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">From</label>
                  <input
                    className="w-full rounded-lg border border-transparent bg-white px-3 py-2 text-sm outline-none focus:border-[#006c4d]/20"
                    type="date"
                    value={filters.from}
                    onChange={(event) => {
                      setActiveDatePreset('');
                      setFilters((prev) => ({ ...prev, from: event.target.value }));
                    }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">To</label>
                  <input
                    className="w-full rounded-lg border border-transparent bg-white px-3 py-2 text-sm outline-none focus:border-[#006c4d]/20"
                    type="date"
                    value={filters.to}
                    onChange={(event) => {
                      setActiveDatePreset('');
                      setFilters((prev) => ({ ...prev, to: event.target.value }));
                    }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Min Amount</label>
                  <input className="w-full rounded-lg border border-transparent bg-white px-3 py-2 text-sm outline-none focus:border-[#006c4d]/20" type="number" placeholder="Min" value={filters.minAmount} onChange={(event) => setFilters((prev) => ({ ...prev, minAmount: event.target.value }))} />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Max Amount</label>
                  <input className="w-full rounded-lg border border-transparent bg-white px-3 py-2 text-sm outline-none focus:border-[#006c4d]/20" type="number" placeholder="Max" value={filters.maxAmount} onChange={(event) => setFilters((prev) => ({ ...prev, maxAmount: event.target.value }))} />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button className="rounded-lg bg-white px-4 py-2 text-xs font-bold text-[#001f2a] transition hover:bg-slate-100" type="button" onClick={exportExcel}>
                  Export Excel
                </button>
                <button className="rounded-lg bg-[#00694b] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#008560]" type="button" onClick={() => loadTransactions(1)}>
                  Apply Filters
                </button>
              </div>
            </section>

            <section
              ref={formSectionRef}
              className={`rounded-lg transition ${formHighlight ? 'ring-4 ring-[#84f8c8]/60' : ''}`}
            >
              <TransactionForm
                editingTransaction={editingTransaction}
                onSaved={async () => {
                  setEditingTransaction(null);
                  await loadTransactions(1);
                  await loadSummary();
                }}
              />
            </section>

            <section className="space-y-3">
              {loading ? <p className="px-2 text-sm text-slate-600">Loading transactions...</p> : null}

              <div className="relative">
                <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M21 21L16.65 16.65M18.5 10.5C18.5 14.9183 14.9183 18.5 10.5 18.5C6.08172 18.5 2.5 14.9183 2.5 10.5C2.5 6.08172 6.08172 2.5 10.5 2.5C14.9183 2.5 18.5 6.08172 18.5 10.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                <input
                  className="w-full rounded-lg bg-[#f4faff] py-3 pl-9 pr-4 text-sm text-[#001f2a] outline-none ring-0 placeholder:text-slate-400 focus:bg-white focus:shadow-[0_0_0_2px_rgba(0,108,77,0.2)]"
                  placeholder="Search current page transactions..."
                  value={quickSearch}
                  onChange={(event) => setQuickSearch(event.target.value)}
                />
              </div>

              <TransactionTable
                rows={visibleTransactions}
                total={tableTotal}
                page={searchEnabled ? 1 : page}
                totalPages={tableTotalPages}
                onPageChange={(nextPage) => {
                  if (!searchEnabled) {
                    void loadTransactions(nextPage);
                  }
                }}
                onEdit={(tx) => setEditingTransaction(tx)}
                onDelete={deleteTransaction}
              />

              {searchEnabled ? (
                <p className="px-2 text-xs font-medium text-slate-500">
                  Quick search currently filters only the loaded page. Clear search to use server pagination.
                </p>
              ) : null}
            </section>
          </div>
        </main>
      </div>

      <button
        className="fixed bottom-6 right-6 z-40 hidden h-14 w-14 items-center justify-center rounded-lg bg-[#00694b] text-3xl text-white shadow-2xl shadow-emerald-900/25 transition hover:scale-105 md:flex"
        type="button"
        aria-label="New transaction"
        onClick={openNewTransactionArea}
      >
        +
      </button>

      <ActionModal 
        isOpen={!!statusMessage}
        onClose={() => setStatusMessage(null)}
        onConfirm={() => setStatusMessage(null)}
        title={statusMessage?.title}
        message={statusMessage?.message}
        confirmText="Acknowledged"
        type={statusMessage?.type}
      />
    </div>
  );
}

export default HomePage;

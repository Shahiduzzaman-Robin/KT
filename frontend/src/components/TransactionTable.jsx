import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useCurrentRole } from '../utils/auth';
import { formatDateTime } from '../utils/dateTime';

function formatBDT(value) {
  return `৳ ${Number(value || 0).toLocaleString()}`;
}

function formatTransactionValue(value) {
  if (value == null || value === '') return '—';

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value instanceof Date) {
    return formatDateTime(value);
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

function TransactionTable({
  rows,
  total,
  page,
  totalPages,
  onPageChange,
  onEdit,
  onDelete,
}) {
  const role = useCurrentRole();
  const colSpan = role === 'viewer' ? 6 : 7;
  const [actionModal, setActionModal] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [detailsState, setDetailsState] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const confirmActionButtonRef = useRef(null);

  useEffect(() => {
    if (!actionModal) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    confirmActionButtonRef.current?.focus();

    function onKeyDown(event) {
      if (!actionModal) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        if (!processing) {
          setActionModal(null);
        }
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        if (!processing) {
          confirmAction();
        }
      }
    }

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [actionModal, processing]);

  function askEdit(transaction) {
    setActionModal({ type: 'edit', transaction });
  }

  function askDelete(transaction) {
    setActionModal({ type: 'delete', transaction });
  }

  async function openDetails(transaction) {
    setDetailsState({ transaction, history: [] });
    setDetailsLoading(true);
    setDetailsError('');

    try {
      const { data } = await api.get(`/transactions/${transaction._id}/history`);
      setDetailsState({
        transaction: data.transaction || transaction,
        history: data.history || [],
      });
    } catch (error) {
      console.error(error);
      setDetailsError('Failed to load transaction details');
    } finally {
      setDetailsLoading(false);
    }
  }

  function closeDetails() {
    setDetailsState(null);
    setDetailsError('');
    setDetailsLoading(false);
  }

  async function confirmAction() {
    if (!actionModal) return;

    const { type, transaction } = actionModal;
    setProcessing(true);
    try {
      if (type === 'edit') {
        onEdit(transaction);
      } else {
        await onDelete(transaction._id);
      }
      setActionModal(null);
    } finally {
      setProcessing(false);
    }
  }

  const sortedHistory = [...(detailsState?.history || [])].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <section className="rounded-3xl bg-white p-5 shadow-[0_12px_40px_rgba(0,31,42,0.06)] md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="[font-family:Manrope,ui-sans-serif,system-ui] text-2xl font-bold text-[#001f2a]">Recent Transactions</h2>
        <p className="rounded-xl bg-[#e6f6ff] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#3d4a43]">Total {total}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm text-[#001f2a]">
          <thead className="text-[11px] uppercase tracking-[0.16em] text-[#3d4a43]">
            <tr>
              <th className="rounded-l-xl bg-[#e6f6ff] px-4 py-3 text-left">Date</th>
              <th className="bg-[#e6f6ff] px-4 py-3 text-left">Ledger</th>
              <th className="bg-[#e6f6ff] px-4 py-3 text-left">Type</th>
              <th className="bg-[#e6f6ff] px-4 py-3 text-left">Amount</th>
              <th className="bg-[#e6f6ff] px-4 py-3 text-left">Description</th>
              <th className="bg-[#e6f6ff] px-4 py-3 text-left">Created By</th>
              <th className="bg-[#e6f6ff] px-4 py-3 text-left">Details</th>
              {role === 'admin' ? <th className="rounded-r-xl bg-[#e6f6ff] px-4 py-3 text-left">Actions</th> : null}
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-none">
            {rows.map((transaction, index) => (
              <tr key={transaction._id} className={`${index % 2 ? 'bg-[#f8fcff]' : 'bg-white'} align-top transition hover:bg-[#eaf7ff]`}>
                <td className="px-4 py-4 text-[13px] font-medium text-[#3d4a43]">{dayjs(transaction.date).format('DD MMM YYYY')}</td>
                <td className="px-4 py-4 font-semibold text-[#001f2a]">
                  {transaction.ledgerId?._id ? (
                    <Link className="underline decoration-transparent transition hover:decoration-current" to={`/ledgers/${transaction.ledgerId._id}`}>
                      {transaction.ledgerId?.name || 'N/A'}
                    </Link>
                  ) : (
                    transaction.ledgerId?.name || 'N/A'
                  )}
                </td>
                <td className="px-4 py-4">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${
                      transaction.type === 'income'
                        ? 'bg-[#84f8c8] text-[#005139]'
                        : 'bg-[#ffdad6] text-[#93000a]'
                    }`}
                  >
                    {transaction.type}
                  </span>
                </td>
                <td className={transaction.type === 'income' ? 'px-4 py-4 [font-family:Manrope,ui-sans-serif,system-ui] text-lg font-bold text-[#00694b]' : 'px-4 py-4 [font-family:Manrope,ui-sans-serif,system-ui] text-lg font-bold text-[#ba1a1a]'}>
                  {formatBDT(transaction.amount)}
                </td>
                <td className="max-w-[280px] px-4 py-4 text-[13px] text-[#3d4a43]">{transaction.description || '-'}</td>
                <td className="px-4 py-4 text-[13px] text-[#3d4a43]">{transaction.createdBy || '-'}</td>
                <td className="px-4 py-4">
                  <button className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#001f2a] shadow-[0_4px_14px_rgba(0,31,42,0.08)] transition hover:bg-[#e6f6ff]" type="button" onClick={() => openDetails(transaction)}>
                    See Details
                  </button>
                </td>
                {role === 'admin' ? (
                  <td className="px-4 py-4">
                    <div className="flex gap-2">
                      <button className="rounded-xl bg-[#d9f2ff] px-3 py-2 text-xs font-semibold text-[#005139] transition hover:bg-[#c9e7f7]" type="button" onClick={() => askEdit(transaction)}>
                        Edit
                      </button>
                      <button className="rounded-xl bg-[#ffdad6] px-3 py-2 text-xs font-semibold text-[#93000a] transition hover:brightness-95" type="button" onClick={() => askDelete(transaction)}>
                        Delete
                      </button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan + 1} className="px-4 py-8 text-center text-sm text-slate-500">
                  No transactions found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <button className="rounded-xl bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#3d4a43] shadow-[0_4px_14px_rgba(0,31,42,0.08)] transition hover:bg-[#e6f6ff] disabled:cursor-not-allowed disabled:opacity-50" type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          Previous
        </button>
        <p className="text-sm font-medium text-[#3d4a43]">
          Page {page} / {Math.max(totalPages, 1)}
        </p>
        <button className="rounded-xl bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#3d4a43] shadow-[0_4px_14px_rgba(0,31,42,0.08)] transition hover:bg-[#e6f6ff] disabled:cursor-not-allowed disabled:opacity-50" type="button" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
          Next
        </button>
      </div>

      {actionModal
        ? createPortal(
            <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md">
              <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
                <h3 className="[font-family:Manrope,ui-sans-serif,system-ui] text-2xl font-bold text-[#001f2a]">
                  {actionModal.type === 'edit' ? 'Confirm Edit Transaction' : 'Confirm Delete Transaction'}
                </h3>
                <p className="mt-1 text-sm text-[#3d4a43]">
                  {actionModal.type === 'edit'
                    ? 'This will load the transaction into edit mode.'
                    : 'This action will permanently delete this transaction.'}
                </p>

                <div className="mt-4 space-y-3 rounded-2xl bg-[#e6f6ff] p-4">
                  <p className="text-lg"><span className="font-semibold text-[#3d4a43]">Ledger:</span> <span className="font-extrabold text-[#001f2a]">{actionModal.transaction.ledgerId?.name || 'N/A'}</span></p>
                  <p className="text-lg"><span className="font-semibold text-[#3d4a43]">Type:</span> <span className={`font-extrabold ${actionModal.transaction.type === 'income' ? 'text-[#00694b]' : 'text-[#93000a]'}`}>{actionModal.transaction.type.toUpperCase()}</span></p>
                  <p className="text-lg"><span className="font-semibold text-[#3d4a43]">Amount:</span> <span className="[font-family:Manrope,ui-sans-serif,system-ui] text-2xl font-bold text-[#001f2a]">{formatBDT(actionModal.transaction.amount)}</span></p>
                  <p className="text-lg"><span className="font-semibold text-[#3d4a43]">Date:</span> <span className="font-bold text-[#001f2a]">{dayjs(actionModal.transaction.date).format('YYYY-MM-DD')}</span></p>
                  <p className="text-lg"><span className="font-semibold text-[#3d4a43]">Description:</span> <span className="font-bold text-[#001f2a]">{actionModal.transaction.description || '-'}</span></p>
                </div>

                <div className="mt-5 flex justify-end gap-2">
                  <button className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#3d4a43] shadow-[0_4px_14px_rgba(0,31,42,0.08)] transition hover:bg-[#e6f6ff]" type="button" disabled={processing} onClick={() => setActionModal(null)}>
                    Cancel
                  </button>
                  <button
                    ref={confirmActionButtonRef}
                    className={actionModal.type === 'delete' ? 'rounded-xl bg-[#ffdad6] px-4 py-2 text-sm font-semibold text-[#93000a] transition hover:brightness-95' : 'rounded-xl bg-gradient-to-br from-[#00694b] to-[#008560] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95'}
                    type="button"
                    disabled={processing}
                    onClick={confirmAction}
                  >
                    {processing
                      ? 'Processing...'
                      : actionModal.type === 'edit'
                        ? 'Confirm Edit'
                        : 'Confirm Delete'}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {detailsState
        ? createPortal(
            <div className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md">
              <div className="w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-3 bg-[#e6f6ff] px-6 py-5">
                  <div>
                    <h3 className="[font-family:Manrope,ui-sans-serif,system-ui] text-2xl font-bold text-[#001f2a]">Transaction Details</h3>
                    <p className="mt-1 text-sm text-[#3d4a43]">Creator, every edit, edit time, and value changes in one place.</p>
                  </div>
                  <button className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#3d4a43] shadow-[0_4px_14px_rgba(0,31,42,0.08)] transition hover:bg-[#d9f2ff]" type="button" onClick={closeDetails}>
                    Close
                  </button>
                </div>

                <div className="max-h-[calc(90vh-92px)] overflow-auto px-6 py-5">
                  {detailsLoading ? (
                    <p className="text-sm text-slate-600">Loading details...</p>
                  ) : detailsError ? (
                    <p className="text-sm text-red-700">{detailsError}</p>
                  ) : (
                    <>
                      <div className="grid gap-3 md:grid-cols-4">
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ledger</p>
                          <p className="mt-1 text-sm font-semibold text-slate-800">{detailsState.transaction.ledgerId?.name || detailsState.transaction.ledger || 'N/A'}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Type</p>
                          <p className="mt-1 text-sm font-semibold text-slate-800">{formatTransactionValue(detailsState.transaction.type)}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</p>
                          <p className="mt-1 text-sm font-semibold text-slate-800">{formatBDT(detailsState.transaction.amount)}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Created By</p>
                          <p className="mt-1 text-sm font-semibold text-slate-800">{detailsState.transaction.createdBy || '-'}</p>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-1">
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last Edited By</p>
                          <p className="mt-1 text-sm font-semibold text-slate-800">{detailsState.transaction.updatedBy || '-'}</p>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</p>
                          <p className="mt-1 text-sm font-semibold text-slate-800">{dayjs(detailsState.transaction.date).format('DD MMM YYYY')}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</p>
                          <p className="mt-1 text-sm font-semibold text-slate-800">{detailsState.transaction.description || '-'}</p>
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
                              const dotTone = isLatestEvent
                                ? 'border-emerald-50 bg-emerald-500'
                                : 'border-slate-100 bg-slate-300';
                              return (
                                <div key={event.id} className="relative pl-14">
                                  {!isLastItem ? <span className="absolute left-[20px] top-12 bottom-[-18px] w-px bg-slate-200" /> : null}
                                  <span className={`absolute left-[8px] top-4 h-6 w-6 rounded-full border-4 ${dotTone} shadow-sm`} />

                                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                      <div>
                                        <p className="text-3 font-extrabold tracking-wide text-slate-800 md:text-[2rem]">{timelineHeading}</p>
                                        <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                                          BY <span className="font-extrabold text-slate-500">{event.userName || '-'}</span>
                                          {timelineAgo ? ` • ${timelineAgo}` : ''}
                                        </p>
                                      </div>
                                      <div className="text-right text-sm text-slate-500">
                                        <p>{formatDateTime(event.timestamp)}</p>
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
    </section>
  );
}

export default TransactionTable;

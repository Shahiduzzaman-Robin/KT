import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dayjs from 'dayjs';
import api from '../utils/api';
import LedgerAutocomplete from './LedgerAutocomplete';
import { useCurrentRole } from '../utils/auth';
import CustomSelect from './CustomSelect';

const EMPTY = {
  ledgerInput: '',
  ledgerId: '',
  type: 'income',
  amount: '',
  date: dayjs().format('YYYY-MM-DD'),
  description: '',
};

function TransactionForm({ editingTransaction, onSaved }) {
  const role = useCurrentRole();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);
  const confirmButtonRef = useRef(null);
  const [showLedgerConfirm, setShowLedgerConfirm] = useState(false);
  const [pendingLedgerPayload, setPendingLedgerPayload] = useState(null);
  const ledgerConfirmButtonRef = useRef(null);
  const [showNewLedger, setShowNewLedger] = useState(false);
  const [newLedger, setNewLedger] = useState({ name: '', type: 'other', contact: '', address: '', notes: '' });

  useEffect(() => {
    if (!editingTransaction) {
      setForm(EMPTY);
      return;
    }

    setForm({
      ledgerInput: editingTransaction.ledgerId?.name || '',
      ledgerId: editingTransaction.ledgerId?._id || '',
      type: editingTransaction.type,
      amount: String(editingTransaction.amount),
      date: dayjs(editingTransaction.date).format('YYYY-MM-DD'),
      description: editingTransaction.description || '',
    });
  }, [editingTransaction]);

  useEffect(() => {
    if (role !== 'admin' && editingTransaction) {
      setForm(EMPTY);
    }
  }, [role, editingTransaction]);

  // Lock date to today for non-admin users
  useEffect(() => {
    if (role !== 'admin') {
      const todayDate = dayjs().format('YYYY-MM-DD');
      setForm((prev) => ({
        ...prev,
        date: todayDate,
      }));
    }
  }, [role]);

  useEffect(() => {
    if (!showConfirm) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    confirmButtonRef.current?.focus();

    function onModalKeyDown(event) {
      if (!showConfirm) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        if (!loading) {
          setShowConfirm(false);
          setPendingPayload(null);
        }
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        if (!loading && pendingPayload) {
          saveTransaction(pendingPayload);
        }
      }
    }

    window.addEventListener('keydown', onModalKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', onModalKeyDown);
    };
  }, [showConfirm, loading, pendingPayload]);

  useEffect(() => {
    if (!showLedgerConfirm) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    ledgerConfirmButtonRef.current?.focus();

    function onLedgerModalKeyDown(event) {
      if (!showLedgerConfirm) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        if (!loading) {
          setShowLedgerConfirm(false);
          setPendingLedgerPayload(null);
        }
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        if (!loading && pendingLedgerPayload) {
          saveNewLedger(pendingLedgerPayload);
        }
      }
    }

    window.addEventListener('keydown', onLedgerModalKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', onLedgerModalKeyDown);
    };
  }, [showLedgerConfirm, loading, pendingLedgerPayload]);

  function validate() {
    const nextErrors = {};
    if (!form.ledgerId) nextErrors.ledger = 'Please select a ledger from suggestions';
    if (!form.amount || Number(form.amount) <= 0) nextErrors.amount = 'Amount must be greater than 0';
    if (!form.date) nextErrors.date = 'Date is required';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function submit(event) {
    event.preventDefault();
    if (!validate()) return;

    const payload = {
      ledgerId: form.ledgerId,
      type: form.type,
      amount: Number(form.amount),
      date: form.date,
      description: form.description,
    };

    if (editingTransaction?._id) {
      await saveTransaction(payload);
      return;
    }

    setPendingPayload(payload);
    setShowConfirm(true);
  }

  async function saveTransaction(payload) {
    setLoading(true);
    try {
      if (editingTransaction?._id) {
        await api.put(`/transactions/${editingTransaction._id}`, payload);
      } else {
        await api.post('/transactions', payload);
      }

      setForm(EMPTY);
      setShowConfirm(false);
      setPendingPayload(null);
      onSaved();
    } catch (requestError) {
      const errorMsg = requestError.response?.data?.details ||  requestError.response?.data?.message || requestError.message || 'Failed to save transaction';
      alert(`Error: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  }

  async function createLedger() {
    if (!newLedger.name.trim()) {
      alert('Ledger name is required');
      return;
    }

    const payload = {
      name: newLedger.name.trim(),
      type: newLedger.type,
      contact: newLedger.contact,
      address: newLedger.address,
      notes: newLedger.notes,
    };

    setPendingLedgerPayload(payload);
    setShowLedgerConfirm(true);
  }

  async function saveNewLedger(payload) {
    setLoading(true);

    try {
      const { data } = await api.post('/ledgers', payload);
      setForm((prev) => ({ ...prev, ledgerInput: data.name, ledgerId: data._id }));
      setNewLedger({ name: '', type: 'other', contact: '', address: '', notes: '' });
      setShowNewLedger(false);
      setShowLedgerConfirm(false);
      setPendingLedgerPayload(null);
    } catch (requestError) {
      alert(requestError.response?.data?.message || 'Failed to create ledger');
    } finally {
      setLoading(false);
    }
  }

  const isOutgoingConfirm = form.type === 'outgoing';
  const confirmCardTone = isOutgoingConfirm
    ? 'bg-red-50'
    : 'bg-emerald-50';
  const confirmBorderTone = isOutgoingConfirm ? 'border-red-400' : 'border-emerald-400';
  const confirmBackdropTone = isOutgoingConfirm ? 'bg-red-950/55' : 'bg-emerald-950/55';
  const confirmTitleTone = isOutgoingConfirm ? 'text-red-800' : 'text-emerald-800';
  const confirmChipTone = isOutgoingConfirm
    ? 'bg-red-100 text-red-700'
    : 'bg-emerald-100 text-emerald-700';
  const confirmPrimaryTone = isOutgoingConfirm
    ? 'bg-red-700 hover:bg-red-600 text-white'
    : 'bg-emerald-700 hover:bg-emerald-600 text-white';

  return (
    <section className="rounded-xl bg-white p-4 shadow-[0_12px_40px_rgba(0,31,42,0.06)] md:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="[font-family:Manrope,ui-sans-serif,system-ui] text-2xl font-bold text-[#001f2a]">{editingTransaction ? 'Edit transaction' : 'New transaction'}</h2>
        {role !== 'viewer' ? (
          <button className="rounded-lg bg-[#e6f6ff] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3d4a43] transition hover:bg-[#d9f2ff]" type="button" onClick={() => setShowNewLedger((prev) => !prev)}>
            {showNewLedger ? 'Close quick ledger' : '+ Quick add ledger'}
          </button>
        ) : null}
      </div>

      {role === 'viewer' ? (
        <div className="rounded-lg bg-[#e6f6ff] p-4 text-sm text-[#3d4a43]">
          Viewer mode is read-only. Switch to Admin or Data Entry to add or edit transactions.
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-4">
        <div className="md:col-span-4">
          <LedgerAutocomplete
            value={form.ledgerInput}
            selectedLedgerId={form.ledgerId}
            onChange={(ledgerInput) => setForm((prev) => ({ ...prev, ledgerInput }))}
            onSelect={(ledger) => setForm((prev) => ({ ...prev, ledgerId: ledger?._id || '' }))}
            error={errors.ledger}
            excludeGroups={true}
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Type</label>
          <div
            className="grid grid-cols-2 gap-2 rounded-lg bg-[#e6f6ff] p-1"
            role="radiogroup"
            aria-label="Transaction type"
          >
            <button
              type="button"
              role="radio"
              aria-checked={form.type === 'income'}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                form.type === 'income'
                  ? 'bg-[#00694b] text-white shadow-[0_8px_24px_rgba(0,105,75,0.2)]'
                  : 'bg-white text-[#3d4a43] hover:bg-[#d9f2ff]'
              }`}
              onClick={() => setForm((prev) => ({ ...prev, type: 'income' }))}
            >
              Income
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={form.type === 'outgoing'}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                form.type === 'outgoing'
                  ? 'bg-[#ba1a1a] text-white shadow-[0_8px_24px_rgba(186,26,26,0.2)]'
                  : 'bg-white text-[#3d4a43] hover:bg-[#ffe8e5]'
              }`}
              onClick={() => setForm((prev) => ({ ...prev, type: 'outgoing' }))}
            >
              Outgoing
            </button>
          </div>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Selected:{' '}
            <span className={form.type === 'income' ? 'text-emerald-700' : 'text-red-700'}>
              {form.type === 'income' ? 'Income' : 'Outgoing'}
            </span>
          </p>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Amount (BDT)</label>
          <input
            className={`w-full rounded-lg border border-transparent bg-[#f4faff] px-3 py-2 text-[#001f2a] outline-none transition focus:bg-white focus:shadow-[0_0_0_2px_rgba(0,108,77,0.2)] ${errors.amount ? 'focus:shadow-[0_0_0_2px_rgba(186,26,26,0.25)]' : ''}`}
            type="number"
            min="0"
            value={form.amount}
            onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
          />
          {errors.amount ? <p className="error-text">{errors.amount}</p> : null}
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Date</label>
          <input
            className={`w-full rounded-lg border border-transparent bg-[#f4faff] px-3 py-2 text-[#001f2a] outline-none transition focus:bg-white focus:shadow-[0_0_0_2px_rgba(0,108,77,0.2)] disabled:cursor-not-allowed disabled:opacity-60 ${errors.date ? 'focus:shadow-[0_0_0_2px_rgba(186,26,26,0.25)]' : ''}`}
            type="date"
            value={form.date}
            onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
            disabled={role !== 'admin'}
          />
          {role !== 'admin' && <p className="mt-1 text-xs text-slate-500">🔒 Date is locked to today for {role === 'data-entry' ? 'data entry users' : 'viewers'}</p>}
          {errors.date ? <p className="error-text">{errors.date}</p> : null}
        </div>

        <div className="md:col-span-4">
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Description</label>
          <input
            className="w-full rounded-lg border border-transparent bg-[#f4faff] px-3 py-2 text-[#001f2a] outline-none transition focus:bg-white focus:shadow-[0_0_0_2px_rgba(0,108,77,0.2)]"
            value={form.description}
            placeholder="Notes..."
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
          />
        </div>

        <div className="md:col-span-4">
          <button className="rounded-lg bg-gradient-to-br from-[#00694b] to-[#008560] px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_24px_rgba(0,105,75,0.2)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50" disabled={loading} type="submit">
            {loading ? 'Saving...' : editingTransaction ? 'Update transaction' : 'Add transaction'}
          </button>
        </div>
        </form>
      )}

      {role !== 'viewer' && showNewLedger ? (
        <div className="mt-5 rounded-lg bg-[#e6f6ff] p-4">
          <h3 className="mb-3 [font-family:Manrope,ui-sans-serif,system-ui] text-xl font-bold text-[#001f2a]">Quick Ledger Create</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="w-full rounded-lg border border-transparent bg-white px-3 py-2 text-[#001f2a] outline-none transition focus:shadow-[0_0_0_2px_rgba(0,108,77,0.2)]"
              placeholder="Ledger name"
              value={newLedger.name}
              onChange={(event) => setNewLedger((prev) => ({ ...prev, name: event.target.value }))}
            />
            <CustomSelect
              value={newLedger.type}
              onChange={(nextType) => setNewLedger((prev) => ({ ...prev, type: nextType }))}
              options={[
                { value: 'customer', label: 'Customer' },
                { value: 'supplier', label: 'Supplier' },
                { value: 'employee', label: 'Employee' },
                { value: 'other', label: 'Other' },
              ]}
              buttonClassName="!rounded-lg !border-transparent !bg-white"
            />
            <input
              className="w-full rounded-lg border border-transparent bg-white px-3 py-2 text-[#001f2a] outline-none transition focus:shadow-[0_0_0_2px_rgba(0,108,77,0.2)]"
              placeholder="Contact"
              value={newLedger.contact}
              onChange={(event) => setNewLedger((prev) => ({ ...prev, contact: event.target.value }))}
            />
            <input
              className="w-full rounded-lg border border-transparent bg-white px-3 py-2 text-[#001f2a] outline-none transition focus:shadow-[0_0_0_2px_rgba(0,108,77,0.2)]"
              placeholder="Address"
              value={newLedger.address}
              onChange={(event) => setNewLedger((prev) => ({ ...prev, address: event.target.value }))}
            />
            <textarea
              className="w-full rounded-lg border border-transparent bg-white px-3 py-2 text-[#001f2a] outline-none transition focus:shadow-[0_0_0_2px_rgba(0,108,77,0.2)] md:col-span-2"
              rows="2"
              placeholder="Notes"
              value={newLedger.notes}
              onChange={(event) => setNewLedger((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </div>
          <button className="mt-3 rounded-lg bg-[#001f2a] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white transition hover:opacity-90" type="button" onClick={createLedger}>
            Save ledger
          </button>
        </div>
      ) : null}

      {showConfirm
        ? createPortal(
            <div className={`fixed inset-0 z-[300] flex items-center justify-center p-4 backdrop-blur-md ${confirmBackdropTone}`}>
              <div className={`w-full max-w-xl rounded-xl border-[6px] bg-white p-5 shadow-2xl ${confirmCardTone} ${confirmBorderTone}`}>
                <h3 className={`[font-family:Manrope,ui-sans-serif,system-ui] text-2xl font-bold ${confirmTitleTone}`}>Confirm New Transaction</h3>
                <p className="mt-1 text-sm text-[#3d4a43]">Please review details before saving.</p>

                <div className="mt-4 space-y-3 rounded-lg bg-[#f4faff] p-4">
                  <p className="text-lg"><span className="font-semibold text-[#3d4a43]">Ledger:</span> <span className="font-extrabold text-[#001f2a]">{form.ledgerInput}</span></p>
                  <p className="text-lg">
                    <span className="font-semibold text-[#3d4a43]">Type:</span>{' '}
                    <span className={`rounded-lg px-2 py-0.5 text-sm font-extrabold ${confirmChipTone}`}>
                      {form.type.toUpperCase()}
                    </span>
                  </p>
                  <p className="text-lg"><span className="font-semibold text-[#3d4a43]">Amount:</span> <span className="[font-family:Manrope,ui-sans-serif,system-ui] text-2xl font-bold text-[#001f2a]">৳ {Number(form.amount || 0).toLocaleString()}</span></p>
                  <p className="text-lg"><span className="font-semibold text-[#3d4a43]">Date:</span> <span className="font-bold text-[#001f2a]">{form.date}</span></p>
                  <p className="text-lg"><span className="font-semibold text-[#3d4a43]">Description:</span> <span className="font-bold text-[#001f2a]">{form.description || '-'}</span></p>
                </div>

                <div className="mt-5 flex justify-end gap-2">
                  <button
                    className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#3d4a43] shadow-[0_4px_14px_rgba(0,31,42,0.08)] transition hover:bg-[#e6f6ff]"
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setShowConfirm(false);
                      setPendingPayload(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    ref={confirmButtonRef}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${confirmPrimaryTone}`}
                    type="button"
                    disabled={loading || !pendingPayload}
                    onClick={() => saveTransaction(pendingPayload)}
                  >
                    {loading ? 'Saving...' : 'Confirm & Save'}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {showLedgerConfirm
        ? createPortal(
            <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md">
              <div className="w-full max-w-xl rounded-xl bg-white p-5 shadow-2xl">
                <h3 className="[font-family:Manrope,ui-sans-serif,system-ui] text-2xl font-bold text-[#001f2a]">Confirm New Ledger</h3>
                <p className="mt-1 text-sm text-[#3d4a43]">Please review ledger details before saving.</p>

                <div className="mt-4 space-y-3 rounded-lg bg-[#e6f6ff] p-4">
                  <p className="text-lg"><span className="font-semibold text-[#3d4a43]">Name:</span> <span className="font-extrabold text-[#001f2a]">{pendingLedgerPayload?.name || '-'}</span></p>
                  <p className="text-lg"><span className="font-semibold text-[#3d4a43]">Type:</span> <span className="font-extrabold uppercase text-[#001f2a]">{pendingLedgerPayload?.type || '-'}</span></p>
                  <p className="text-lg"><span className="font-semibold text-[#3d4a43]">Phone:</span> <span className="font-bold text-[#001f2a]">{pendingLedgerPayload?.contact || '-'}</span></p>
                  <p className="text-lg"><span className="font-semibold text-[#3d4a43]">Address:</span> <span className="font-bold text-[#001f2a]">{pendingLedgerPayload?.address || '-'}</span></p>
                  <p className="text-lg"><span className="font-semibold text-[#3d4a43]">Notes:</span> <span className="font-bold text-[#001f2a]">{pendingLedgerPayload?.notes || '-'}</span></p>
                </div>

                <div className="mt-5 flex justify-end gap-2">
                  <button
                    className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#3d4a43] shadow-[0_4px_14px_rgba(0,31,42,0.08)] transition hover:bg-[#e6f6ff]"
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setShowLedgerConfirm(false);
                      setPendingLedgerPayload(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    ref={ledgerConfirmButtonRef}
                    className="rounded-lg bg-gradient-to-br from-[#00694b] to-[#008560] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95"
                    type="button"
                    disabled={loading || !pendingLedgerPayload}
                    onClick={() => saveNewLedger(pendingLedgerPayload)}
                  >
                    {loading ? 'Saving...' : 'Confirm & Save'}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </section>
  );
}

export default TransactionForm;

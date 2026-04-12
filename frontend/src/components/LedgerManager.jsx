import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useCurrentRole } from '../utils/auth';
import CustomSelect from './CustomSelect';
import ActionModal from './ActionModal';

const blank = { name: '', type: 'other', contact: '', address: '', notes: '' };

function LedgerManager() {
  const role = useCurrentRole();
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState('');
  const [saving, setSaving] = useState(false);
  const [showConfirmCreate, setShowConfirmCreate] = useState(false);
  const [pendingCreatePayload, setPendingCreatePayload] = useState(null);
  const confirmCreateButtonRef = useRef(null);
  const [actionModal, setActionModal] = useState(null);
  const [actionProcessing, setActionProcessing] = useState(false);
  const confirmActionButtonRef = useRef(null);
  const [statusMessage, setStatusMessage] = useState(null); // { title, message, type }

  async function loadLedgers(search = '') {
    const { data } = await api.get('/ledgers', { params: { search, limit: 40, includeArchived: true } });
    setRows(data);
  }

  useEffect(() => {
    loadLedgers().catch((error) => console.error(error));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadLedgers(query).catch((error) => console.error(error));
    }, 180);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!showConfirmCreate) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    confirmCreateButtonRef.current?.focus();

    function onKeyDown(event) {
      if (!showConfirmCreate) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        if (!saving) {
          setShowConfirmCreate(false);
          setPendingCreatePayload(null);
        }
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        if (!saving && pendingCreatePayload) {
          confirmCreateLedger(pendingCreatePayload);
        }
      }
    }

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [showConfirmCreate, saving, pendingCreatePayload]);

  useEffect(() => {
    if (!actionModal) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    confirmActionButtonRef.current?.focus();

    function onActionKeyDown(event) {
      if (!actionModal) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        if (!actionProcessing) {
          setActionModal(null);
        }
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        if (!actionProcessing) {
          confirmLedgerAction();
        }
      }
    }

    window.addEventListener('keydown', onActionKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', onActionKeyDown);
    };
  }, [actionModal, actionProcessing]);

  async function saveLedger(event) {
    event.preventDefault();
    if (!form.name.trim()) return;

    if (editingId) {
      await api.put(`/ledgers/${editingId}`, form);
      setForm(blank);
      setEditingId('');
      await loadLedgers(query);
      return;
    } else {
      setPendingCreatePayload({
        name: form.name.trim(),
        type: form.type,
        contact: form.contact,
        address: form.address,
        notes: form.notes,
      });
      setShowConfirmCreate(true);
      return;
    }
  }

  async function confirmCreateLedger(payload) {
    setSaving(true);
    try {
      await api.post('/ledgers', payload);
      setForm(blank);
      setEditingId('');
      setShowConfirmCreate(false);
      setPendingCreatePayload(null);
      await loadLedgers(query);
    } catch (error) {
      setStatusMessage({
        title: 'Creation Failed',
        message: error.response?.data?.message || 'Failed to create ledger',
        type: 'danger'
      });
    } finally {
      setSaving(false);
    }
  }

  function askEditLedger(ledger) {
    setActionModal({ type: 'edit', ledger });
  }

  function askDeleteLedger(ledger) {
    setActionModal({ type: 'delete', ledger });
  }

  async function confirmLedgerAction() {
    if (!actionModal) return;

    const { type, ledger } = actionModal;
    setActionProcessing(true);
    try {
      if (type === 'edit') {
        setEditingId(ledger._id);
        setForm({
          name: ledger.name,
          type: ledger.type,
          contact: ledger.contact || '',
          address: ledger.address || '',
          notes: ledger.notes || '',
        });
      } else {
        const { data } = await api.delete(`/ledgers/${ledger._id}`);
        await loadLedgers(query);
        if (data?.message) {
          setStatusMessage({
            title: 'Action Successful',
            message: data.message,
            type: 'success'
          });
        }
      }
      setActionModal(null);
    } catch (error) {
      setStatusMessage({
        title: 'Action Error',
        message: error.response?.data?.message || 'Action failed',
        type: 'danger'
      });
    } finally {
      setActionProcessing(false);
    }
  }

  return (
    <section className="rounded-xl bg-white p-5 shadow-[0_12px_40px_rgba(0,31,42,0.06)]">
      <h2 className="[font-family:Manrope,ui-sans-serif,system-ui] text-2xl font-bold text-[#001f2a]">Ledger Management</h2>

      <input
        className="mb-3 mt-3 w-full rounded-lg border border-transparent bg-[#f4faff] px-3 py-2 text-[#001f2a] outline-none transition focus:bg-white focus:shadow-[0_0_0_2px_rgba(0,108,77,0.2)]"
        placeholder="Search ledger..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {role === 'viewer' ? (
        <p className="mt-3 rounded-lg bg-[#e6f6ff] p-4 text-sm text-[#3d4a43]">
          Viewer mode is read-only. Ledger create, edit, and delete controls are hidden.
        </p>
      ) : (
        <>
          <form onSubmit={saveLedger} className="grid gap-2 md:grid-cols-2">
            <input className="w-full rounded-lg border border-transparent bg-[#f4faff] px-3 py-2 text-[#001f2a] outline-none transition focus:bg-white focus:shadow-[0_0_0_2px_rgba(0,108,77,0.2)]" placeholder="Name" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            <CustomSelect
              value={form.type}
              onChange={(nextType) => setForm((prev) => ({ ...prev, type: nextType }))}
              options={[
                { value: 'customer', label: 'Customer' },
                { value: 'supplier', label: 'Supplier' },
                { value: 'employee', label: 'Employee' },
                { value: 'other', label: 'Other' },
              ]}
              buttonClassName="!rounded-lg !border-transparent !bg-[#f4faff]"
            />
            <input className="w-full rounded-lg border border-transparent bg-[#f4faff] px-3 py-2 text-[#001f2a] outline-none transition focus:bg-white focus:shadow-[0_0_0_2px_rgba(0,108,77,0.2)]" placeholder="Contact" value={form.contact} onChange={(event) => setForm((prev) => ({ ...prev, contact: event.target.value }))} />
            <input className="w-full rounded-lg border border-transparent bg-[#f4faff] px-3 py-2 text-[#001f2a] outline-none transition focus:bg-white focus:shadow-[0_0_0_2px_rgba(0,108,77,0.2)]" placeholder="Address" value={form.address} onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))} />
            <textarea className="w-full rounded-lg border border-transparent bg-[#f4faff] px-3 py-2 text-[#001f2a] outline-none transition focus:bg-white focus:shadow-[0_0_0_2px_rgba(0,108,77,0.2)] md:col-span-2" rows="2" placeholder="Notes" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
            <div className="md:col-span-2 flex gap-2">
              <button className="rounded-lg bg-gradient-to-br from-[#00694b] to-[#008560] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95" type="submit">{editingId ? 'Update Ledger' : 'Add Ledger'}</button>
              {editingId ? (
                <button className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#3d4a43] shadow-[0_4px_14px_rgba(0,31,42,0.08)] transition hover:bg-[#e6f6ff]" type="button" onClick={() => { setForm(blank); setEditingId(''); }}>
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </>
      )}

      <div className="mt-4 max-h-64 overflow-y-auto rounded-lg bg-[#f4faff] p-2">
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-[0.14em] text-[#3d4a43]">
            <tr>
              <th className="rounded-l-xl bg-[#e6f6ff] px-3 py-3 text-left">Name</th>
              <th className="bg-[#e6f6ff] px-3 py-3 text-left">Type</th>
              <th className="bg-[#e6f6ff] px-3 py-3 text-left">Status</th>
              {role !== 'viewer' ? <th className="rounded-r-xl bg-[#e6f6ff] px-3 py-3 text-left">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((ledger, index) => (
              <tr key={ledger._id} className={`${index % 2 ? 'bg-[#f8fcff]' : 'bg-white'} transition hover:bg-[#eaf7ff]`}>
                <td className="px-3 py-3 text-[#001f2a]"><Link className="underline decoration-transparent transition hover:decoration-current" to={`/ledgers/${ledger._id}`}>{ledger.isGroup ? '📊 ' : ''}{ledger.name}</Link></td>
                <td className="px-3 py-3 text-[#3d4a43] uppercase">{ledger.isGroup ? 'Group' : ledger.type}</td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    <span className={`rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${ledger.isActive === false ? 'bg-[#ffdad6] text-[#93000a]' : 'bg-[#84f8c8] text-[#005139]'}`}>
                      {ledger.isActive === false ? 'Archived' : 'Active'}
                    </span>
                    {ledger.isGroup && <span className="rounded-lg bg-[#cce5ff] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#0066cc]">Group</span>}
                    {ledger.parentLedgerId && <span className="rounded-lg bg-[#e8d5ff] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b21a8]">Child</span>}
                  </div>
                </td>
                {role !== 'viewer' ? (
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      <button
                        className="rounded-lg bg-[#d9f2ff] px-3 py-1.5 text-xs font-semibold text-[#005139] transition hover:bg-[#c9e7f7]"
                        type="button"
                        onClick={() => askEditLedger(ledger)}
                      >
                        Edit
                      </button>
                      <button className="rounded-lg bg-[#ffdad6] px-3 py-1.5 text-xs font-semibold text-[#93000a] transition hover:brightness-95" type="button" onClick={() => askDeleteLedger(ledger)}>
                        {ledger.isActive === false ? 'Delete' : 'Archive'}
                      </button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showConfirmCreate
        ? createPortal(
            <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md">
              <div className="w-full max-w-xl rounded-xl bg-white p-5 shadow-2xl">
                <h3 className="[font-family:Manrope,ui-sans-serif,system-ui] text-2xl font-bold text-[#001f2a]">Confirm New Ledger</h3>
                <p className="mt-1 text-sm text-[#3d4a43]">Please review ledger details before saving.</p>

                <div className="mt-4 space-y-3 rounded-lg bg-[#e6f6ff] p-4">
                  <p className="text-lg"><span className="font-semibold text-[#3d4a43]">Name:</span> <span className="font-extrabold text-[#001f2a]">{pendingCreatePayload?.name || '-'}</span></p>
                  <p className="text-lg"><span className="font-semibold text-[#3d4a43]">Type:</span> <span className="font-extrabold uppercase text-[#001f2a]">{pendingCreatePayload?.type || '-'}</span></p>
                  <p className="text-lg"><span className="font-semibold text-[#3d4a43]">Phone:</span> <span className="font-bold text-[#001f2a]">{pendingCreatePayload?.contact || '-'}</span></p>
                  <p className="text-lg"><span className="font-semibold text-[#3d4a43]">Address:</span> <span className="font-bold text-[#001f2a]">{pendingCreatePayload?.address || '-'}</span></p>
                  <p className="text-lg"><span className="font-semibold text-[#3d4a43]">Notes:</span> <span className="font-bold text-[#001f2a]">{pendingCreatePayload?.notes || '-'}</span></p>
                </div>

                <div className="mt-5 flex justify-end gap-2">
                  <button
                    className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#3d4a43] shadow-[0_4px_14px_rgba(0,31,42,0.08)] transition hover:bg-[#e6f6ff]"
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setShowConfirmCreate(false);
                      setPendingCreatePayload(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    ref={confirmCreateButtonRef}
                    className="rounded-lg bg-gradient-to-br from-[#00694b] to-[#008560] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95"
                    type="button"
                    disabled={saving || !pendingCreatePayload}
                    onClick={() => confirmCreateLedger(pendingCreatePayload)}
                  >
                    {saving ? 'Saving...' : 'Confirm & Save'}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {actionModal
        ? createPortal(
            <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md">
              <div className="w-full max-w-xl rounded-xl bg-white p-5 shadow-2xl">
                <h3 className="[font-family:Manrope,ui-sans-serif,system-ui] text-2xl font-bold text-[#001f2a]">
                  {actionModal.type === 'edit' ? 'Confirm Edit Ledger' : actionModal.ledger.isActive === false ? 'Confirm Delete Ledger' : 'Confirm Archive Ledger'}
                </h3>
                <p className="mt-1 text-sm text-[#3d4a43]">
                  {actionModal.type === 'edit'
                    ? 'This will load the ledger into edit mode.'
                    : actionModal.ledger.isActive === false
                      ? 'This action will permanently delete this ledger.'
                      : 'If this ledger has transactions, it will be archived to preserve history.'}
                </p>

                <div className="mt-4 space-y-3 rounded-lg bg-[#e6f6ff] p-4">
                  <p className="text-lg"><span className="font-semibold text-[#3d4a43]">Name:</span> <span className="font-extrabold text-[#001f2a]">{actionModal.ledger.name}</span></p>
                  <p className="text-lg"><span className="font-semibold text-[#3d4a43]">Type:</span> <span className="font-extrabold uppercase text-[#001f2a]">{actionModal.ledger.type}</span></p>
                  <p className="text-lg"><span className="font-semibold text-[#3d4a43]">Phone:</span> <span className="font-bold text-[#001f2a]">{actionModal.ledger.contact || '-'}</span></p>
                  <p className="text-lg"><span className="font-semibold text-[#3d4a43]">Address:</span> <span className="font-bold text-[#001f2a]">{actionModal.ledger.address || '-'}</span></p>
                </div>

                <div className="mt-5 flex justify-end gap-2">
                  <button className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#3d4a43] shadow-[0_4px_14px_rgba(0,31,42,0.08)] transition hover:bg-[#e6f6ff]" type="button" disabled={actionProcessing} onClick={() => setActionModal(null)}>
                    Cancel
                  </button>
                  <button
                    ref={confirmActionButtonRef}
                    className={actionModal.type === 'delete' ? 'rounded-lg bg-[#ffdad6] px-4 py-2 text-sm font-semibold text-[#93000a] transition hover:brightness-95' : 'rounded-lg bg-gradient-to-br from-[#00694b] to-[#008560] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95'}
                    type="button"
                    disabled={actionProcessing}
                    onClick={confirmLedgerAction}
                  >
                    {actionProcessing
                      ? 'Processing...'
                      : actionModal.type === 'edit'
                        ? 'Confirm Edit'
                        : actionModal.ledger.isActive === false
                          ? 'Confirm Delete'
                          : 'Confirm Archive'}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      <ActionModal 
        isOpen={!!statusMessage}
        onClose={() => setStatusMessage(null)}
        onConfirm={() => setStatusMessage(null)}
        title={statusMessage?.title}
        message={statusMessage?.message}
        confirmText="OK"
        type={statusMessage?.type}
      />
    </section>
  );
}

export default LedgerManager;

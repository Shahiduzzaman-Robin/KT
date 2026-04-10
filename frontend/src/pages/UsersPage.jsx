import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import CustomSelect from '../components/CustomSelect';
import UserSessionBadge from '../components/UserSessionBadge';
import { getAuthSession } from '../utils/auth';
import AppSidebar from '../components/AppSidebar';

const EMPTY_CREATE = {
  username: '',
  displayName: '',
  password: '',
  confirmPassword: '',
  role: 'data-entry',
};

function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [createError, setCreateError] = useState('');
  const [rowEdits, setRowEdits] = useState({});
  const [activeModal, setActiveModal] = useState(null);
  const [passwordForm, setPasswordForm] = useState({ password: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState('');

  async function loadUsers() {
    setLoading(true);
    try {
      const { data } = await api.get('/users');
      setUsers(data || []);
      setRowEdits(
        (data || []).reduce((acc, item) => {
          acc[item._id] = {
            displayName: item.displayName || '',
            role: item.role || 'viewer',
            active: Boolean(item.active),
          };
          return acc;
        }, {})
      );
    } catch (error) {
      console.error(error);
      alert('Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  const stats = useMemo(() => {
    return users.reduce(
      (acc, user) => {
        acc.total += 1;
        if (user.active) acc.active += 1;
        acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
      },
      { total: 0, active: 0, admin: 0, 'data-entry': 0, viewer: 0 }
    );
  }, [users]);

  function openEdit(user) {
    setActiveModal({ type: 'edit', user });
    setCreateError('');
    setPasswordError('');
  }

  function openPasswordReset(user) {
    setActiveModal({ type: 'password', user });
    setPasswordForm({ password: '', confirmPassword: '' });
    setPasswordError('');
  }

  function closeModal() {
    setActiveModal(null);
    setPasswordError('');
  }

  async function createUser(event) {
    event.preventDefault();
    setCreateError('');

    if (!createForm.username || !createForm.displayName || !createForm.password || !createForm.confirmPassword) {
      setCreateError('Please fill every field');
      return;
    }

    if (createForm.password !== createForm.confirmPassword) {
      setCreateError('Passwords do not match');
      return;
    }

    setSaving(true);
    try {
      await api.post('/users', {
        username: createForm.username,
        displayName: createForm.displayName,
        password: createForm.password,
        role: createForm.role,
      });
      setCreateForm(EMPTY_CREATE);
      await loadUsers();
    } catch (error) {
      setCreateError(error.response?.data?.message || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!activeModal?.user) return;

    const edit = rowEdits[activeModal.user._id];
    setSaving(true);
    try {
      await api.put(`/users/${activeModal.user._id}`, {
        displayName: edit.displayName,
        role: edit.role,
        active: edit.active,
      });
      closeModal();
      await loadUsers();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update user');
    } finally {
      setSaving(false);
    }
  }

  async function savePasswordReset() {
    if (!activeModal?.user) return;

    if (!passwordForm.password || !passwordForm.confirmPassword) {
      setPasswordError('Please fill both password fields');
      return;
    }

    if (passwordForm.password !== passwordForm.confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setSaving(true);
    try {
      await api.patch(`/users/${activeModal.user._id}/password`, {
        password: passwordForm.password,
        confirmPassword: passwordForm.confirmPassword,
      });
      closeModal();
    } catch (error) {
      setPasswordError(error.response?.data?.message || 'Failed to reset password');
    } finally {
      setSaving(false);
    }
  }

  const currentUserId = getAuthSession()?.user?.id;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f4faff] px-4 py-6 md:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-36 right-[-10%] h-96 w-96 rounded-full bg-[#84f8c8]/25 blur-[110px]" />
        <div className="absolute bottom-[-18%] left-[-10%] h-80 w-80 rounded-full bg-[#d9f2ff] blur-[100px]" />
      </div>

      <div className="mx-auto flex max-w-[1700px] gap-5 px-0 md:px-0">
        <AppSidebar />

        <main className="min-w-0 flex-1 space-y-5">
        <header className="relative z-20 overflow-visible rounded-3xl bg-white/92 p-4 shadow-[0_12px_40px_rgba(0,31,42,0.06)] backdrop-blur md:p-5">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#00694b] via-[#008560] to-[#67dbad]" />

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <div className="mr-auto min-w-[220px]">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#00694b]">Administration</p>
              <h1 className="[font-family:Manrope,ui-sans-serif,system-ui] text-3xl font-bold tracking-tight text-[#001f2a] md:text-5xl">User Management</h1>
              <p className="mt-1 text-sm text-[#3d4a43]">Create users, update roles, disable access, and reset passwords.</p>
            </div>
            <Link className="rounded-xl bg-[#e6f6ff] px-4 py-2 text-sm font-semibold text-[#3d4a43] transition hover:bg-[#d9f2ff]" to="/">
              Back to Dashboard
            </Link>
          </div>

          <div className="mt-4 rounded-2xl bg-[#e6f6ff] p-2">
            <UserSessionBadge compact />
          </div>
        </header>

        <section className="rounded-3xl bg-[#e6f6ff] p-5">
          <div className="grid gap-3 md:grid-cols-4">
            <p className="rounded-2xl bg-white p-3 text-sm text-[#3d4a43]">Total: <span className="font-bold text-[#001f2a]">{stats.total}</span></p>
            <p className="rounded-2xl bg-white p-3 text-sm text-[#3d4a43]">Active: <span className="font-bold text-[#00694b]">{stats.active}</span></p>
            <p className="rounded-2xl bg-white p-3 text-sm text-[#3d4a43]">Admins: <span className="font-bold text-[#001f2a]">{stats.admin}</span></p>
            <p className="rounded-2xl bg-white p-3 text-sm text-[#3d4a43]">Data Entry: <span className="font-bold text-[#001f2a]">{stats['data-entry']}</span></p>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-[0_12px_40px_rgba(0,31,42,0.06)]">
          <h2 className="mb-4 [font-family:Manrope,ui-sans-serif,system-ui] text-2xl font-bold text-[#001f2a]">Create New User</h2>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={createUser}>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Username</label>
              <input
                className="w-full rounded-xl border border-transparent bg-[#f4faff] px-3 py-2 text-[#001f2a] outline-none transition focus:bg-white focus:shadow-[0_0_0_2px_rgba(0,108,77,0.2)]"
                value={createForm.username}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, username: event.target.value }))}
                placeholder="newuser"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Display Name</label>
              <input
                className="w-full rounded-xl border border-transparent bg-[#f4faff] px-3 py-2 text-[#001f2a] outline-none transition focus:bg-white focus:shadow-[0_0_0_2px_rgba(0,108,77,0.2)]"
                value={createForm.displayName}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, displayName: event.target.value }))}
                placeholder="New User"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Role</label>
              <CustomSelect
                value={createForm.role}
                onChange={(role) => setCreateForm((prev) => ({ ...prev, role }))}
                options={[
                  { value: 'admin', label: 'Admin' },
                  { value: 'data-entry', label: 'Data Entry' },
                  { value: 'viewer', label: 'Viewer' },
                ]}
                buttonClassName="!rounded-xl !border-transparent !bg-[#f4faff]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Password</label>
              <input
                className="w-full rounded-xl border border-transparent bg-[#f4faff] px-3 py-2 text-[#001f2a] outline-none transition focus:bg-white focus:shadow-[0_0_0_2px_rgba(0,108,77,0.2)]"
                type="password"
                value={createForm.password}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, password: event.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Confirm Password</label>
              <input
                className="w-full rounded-xl border border-transparent bg-[#f4faff] px-3 py-2 text-[#001f2a] outline-none transition focus:bg-white focus:shadow-[0_0_0_2px_rgba(0,108,77,0.2)]"
                type="password"
                value={createForm.confirmPassword}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
              />
            </div>
            <div className="md:col-span-2 flex items-center gap-3">
              <button className="rounded-xl bg-gradient-to-br from-[#00694b] to-[#008560] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-60" type="submit" disabled={saving}>
                {saving ? 'Creating...' : 'Create User'}
              </button>
              {createError ? <p className="error-text text-sm">{createError}</p> : null}
            </div>
          </form>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-[0_12px_40px_rgba(0,31,42,0.06)]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="[font-family:Manrope,ui-sans-serif,system-ui] text-2xl font-bold text-[#001f2a]">Users</h2>
            {loading ? <p className="text-sm text-[#3d4a43]">Loading...</p> : null}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="text-[11px] uppercase tracking-[0.16em] text-[#3d4a43]">
                <tr>
                  <th className="rounded-l-xl bg-[#e6f6ff] px-3 py-3 text-left">Username</th>
                  <th className="bg-[#e6f6ff] px-3 py-3 text-left">Display Name</th>
                  <th className="bg-[#e6f6ff] px-3 py-3 text-left">Role</th>
                  <th className="bg-[#e6f6ff] px-3 py-3 text-left">Active</th>
                  <th className="bg-[#e6f6ff] px-3 py-3 text-left">Created</th>
                  <th className="rounded-r-xl bg-[#e6f6ff] px-3 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const draft = rowEdits[user._id] || { displayName: user.displayName, role: user.role, active: user.active };
                  const isSelf = String(user._id) === String(currentUserId);

                  return (
                    <tr key={user._id} className="align-top odd:bg-white even:bg-[#f8fcff] transition hover:bg-[#eaf7ff]">
                      <td className="px-3 py-3 font-semibold text-[#001f2a]">{user.username}</td>
                      <td className="px-3 py-3">
                        <input
                          className="w-full rounded-xl border border-transparent bg-white px-3 py-1.5 text-[#001f2a] outline-none transition focus:shadow-[0_0_0_2px_rgba(0,108,77,0.2)]"
                          value={draft.displayName}
                          onChange={(event) =>
                            setRowEdits((prev) => ({
                              ...prev,
                              [user._id]: { ...draft, displayName: event.target.value },
                            }))
                          }
                        />
                      </td>
                      <td className="px-3 py-3">
                        <CustomSelect
                          value={draft.role}
                          onChange={(role) =>
                            setRowEdits((prev) => ({
                              ...prev,
                              [user._id]: { ...draft, role },
                            }))
                          }
                          options={[
                            { value: 'admin', label: 'Admin' },
                            { value: 'data-entry', label: 'Data Entry' },
                            { value: 'viewer', label: 'Viewer' },
                          ]}
                          disabled={isSelf}
                          buttonClassName="!rounded-xl !border-transparent !bg-white"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <button
                          className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${draft.active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}
                          type="button"
                          disabled={isSelf}
                          onClick={() =>
                            setRowEdits((prev) => ({
                              ...prev,
                              [user._id]: { ...draft, active: !draft.active },
                            }))
                          }
                        >
                          {draft.active ? 'Active' : 'Inactive'}
                        </button>
                        {isSelf ? <p className="mt-1 text-xs text-slate-500">Current user</p> : null}
                      </td>
                      <td className="px-3 py-3 text-[#3d4a43]">{dayjs(user.createdAt).format('DD MMM YYYY')}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button className="rounded-xl bg-[#d9f2ff] px-3 py-1.5 text-xs font-semibold text-[#005139] transition hover:bg-[#c9e7f7]" type="button" onClick={() => openEdit(user)}>
                            Edit
                          </button>
                          <button className="rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-[#3d4a43] shadow-[0_4px_14px_rgba(0,31,42,0.08)] transition hover:bg-[#e6f6ff]" type="button" onClick={() => openPasswordReset(user)}>
                            Reset Password
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {!loading && users.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-3 py-8 text-center text-slate-500">
                      No users found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        {activeModal?.type === 'edit' ? (
          <div className="fixed inset-0 z-[350] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md">
            <div className="w-full max-w-xl rounded-3xl bg-white p-5 shadow-2xl">
              <h3 className="[font-family:Manrope,ui-sans-serif,system-ui] text-2xl font-bold text-[#001f2a]">Edit User</h3>
              <p className="mt-1 text-sm text-[#3d4a43]">Update role and activation status.</p>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Username</label>
                  <input className="w-full rounded-xl border border-transparent bg-[#f4faff] px-3 py-2 text-[#001f2a]" value={activeModal.user.username} disabled />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Display Name</label>
                  <input
                    className="w-full rounded-xl border border-transparent bg-[#f4faff] px-3 py-2 text-[#001f2a] outline-none transition focus:bg-white focus:shadow-[0_0_0_2px_rgba(0,108,77,0.2)]"
                    value={rowEdits[activeModal.user._id]?.displayName || ''}
                    onChange={(event) =>
                      setRowEdits((prev) => ({
                        ...prev,
                        [activeModal.user._id]: { ...prev[activeModal.user._id], displayName: event.target.value },
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Role</label>
                  <CustomSelect
                    value={rowEdits[activeModal.user._id]?.role || 'viewer'}
                    onChange={(role) =>
                      setRowEdits((prev) => ({
                        ...prev,
                        [activeModal.user._id]: { ...prev[activeModal.user._id], role },
                      }))
                    }
                    options={[
                      { value: 'admin', label: 'Admin' },
                      { value: 'data-entry', label: 'Data Entry' },
                      { value: 'viewer', label: 'Viewer' },
                    ]}
                    disabled={String(activeModal.user._id) === String(currentUserId)}
                    buttonClassName="!rounded-xl !border-transparent !bg-[#f4faff]"
                  />
                  {String(activeModal.user._id) === String(currentUserId) ? (
                    <p className="hint">You can change your display name here, but not your own role or active status.</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className={`rounded-full px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] ${rowEdits[activeModal.user._id]?.active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}
                    type="button"
                    disabled={String(activeModal.user._id) === String(currentUserId)}
                    onClick={() =>
                      setRowEdits((prev) => ({
                        ...prev,
                        [activeModal.user._id]: {
                          ...prev[activeModal.user._id],
                          active: !prev[activeModal.user._id]?.active,
                        },
                      }))
                    }
                  >
                    {rowEdits[activeModal.user._id]?.active ? 'Active' : 'Inactive'}
                  </button>
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#3d4a43] shadow-[0_4px_14px_rgba(0,31,42,0.08)] transition hover:bg-[#e6f6ff]" type="button" disabled={saving} onClick={closeModal}>
                  Cancel
                </button>
                <button className="rounded-xl bg-gradient-to-br from-[#00694b] to-[#008560] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-60" type="button" disabled={saving} onClick={saveEdit}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {activeModal?.type === 'password' ? (
          <div className="fixed inset-0 z-[350] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md">
            <div className="w-full max-w-xl rounded-3xl bg-white p-5 shadow-2xl">
              <h3 className="[font-family:Manrope,ui-sans-serif,system-ui] text-2xl font-bold text-[#001f2a]">Reset Password</h3>
              <p className="mt-1 text-sm text-[#3d4a43]">Set a new password for {activeModal.user.username}.</p>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">New Password</label>
                  <input
                    className="w-full rounded-xl border border-transparent bg-[#f4faff] px-3 py-2 text-[#001f2a] outline-none transition focus:bg-white focus:shadow-[0_0_0_2px_rgba(0,108,77,0.2)]"
                    type="password"
                    value={passwordForm.password}
                    onChange={(event) => setPasswordForm((prev) => ({ ...prev, password: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Confirm Password</label>
                  <input
                    className="w-full rounded-xl border border-transparent bg-[#f4faff] px-3 py-2 text-[#001f2a] outline-none transition focus:bg-white focus:shadow-[0_0_0_2px_rgba(0,108,77,0.2)]"
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                  />
                </div>
                {passwordError ? <p className="error-text text-sm">{passwordError}</p> : null}
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#3d4a43] shadow-[0_4px_14px_rgba(0,31,42,0.08)] transition hover:bg-[#e6f6ff]" type="button" disabled={saving} onClick={closeModal}>
                  Cancel
                </button>
                <button className="rounded-xl bg-gradient-to-br from-[#00694b] to-[#008560] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-60" type="button" disabled={saving} onClick={savePasswordReset}>
                  {saving ? 'Saving...' : 'Reset Password'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        </main>
      </div>
    </div>
  );
}

export default UsersPage;
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

  const currentUserId = getAuthSession()?.user?.id;

  async function createUser(event) {
    event.preventDefault();
    if (createForm.password !== createForm.confirmPassword) {
      setCreateError('Passwords do not match');
      return;
    }
    setSaving(true);
    try {
      await api.post('/users', createForm);
      setCreateForm(EMPTY_CREATE);
      loadUsers();
    } catch (error) {
      setCreateError(error.response?.data?.message || 'Error');
    } finally { setSaving(false); }
  }

  return (
    <div className="relative min-h-screen bg-[#f4faff] px-4 py-6 md:px-8">
      <div className="mx-auto flex max-w-[1700px] gap-5">
        <AppSidebar />
        <main className="min-w-0 flex-1 space-y-6">
          <header className="rounded-xl bg-white p-8 shadow-[0_12px_40px_rgba(0,31,42,0.06)] flex items-center justify-between border border-slate-50">
            <div>
              <h1 className="[font-family:Manrope,ui-sans-serif,system-ui] text-4xl font-black tracking-tight text-[#001f2a]">User Gateway</h1>
              <p className="mt-2 text-sm font-medium text-slate-500 uppercase tracking-[0.2em]">Management & Access Control</p>
            </div>
            <div className="flex items-center gap-4">
              <UserSessionBadge compact />
              <Link to="/" className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-white">Exit Administration</Link>
            </div>
          </header>

          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
             {[
               { label: 'Total Accounts', value: stats.total, color: 'text-[#001f2a]' },
               { label: 'Authorized Active', value: stats.active, color: 'text-emerald-700' },
               { label: 'Cloud Admins', value: stats.admin, color: 'text-blue-700' },
               { label: 'Data Personnel', value: stats['data-entry'], color: 'text-slate-600' }
             ].map(s => (
               <div key={s.label} className="rounded-xl bg-white p-4 shadow-sm border border-slate-50">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 block mb-1">{s.label}</span>
                  <span className={`text-2xl font-black ${s.color}`}>{s.value}</span>
               </div>
             ))}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
             <div className="lg:col-span-4">
                <section className="rounded-xl bg-white p-6 shadow-sm border border-slate-50 space-y-6">
                   <h2 className="text-xl font-black text-[#001f2a] tracking-tight">Onboard New User</h2>
                   <form onSubmit={createUser} className="space-y-4">
                      <div>
                         <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Username</label>
                         <input className="w-full rounded-lg border border-slate-100 bg-[#f4faff] px-4 py-2 text-sm font-bold" value={createForm.username} onChange={e => setCreateForm({...createForm, username: e.target.value})} />
                      </div>
                      <div>
                         <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Display Name</label>
                         <input className="w-full rounded-lg border border-slate-100 bg-[#f4faff] px-4 py-2 text-sm font-bold" value={createForm.displayName} onChange={e => setCreateForm({...createForm, displayName: e.target.value})} />
                      </div>
                      <div>
                         <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Permissions</label>
                         <CustomSelect value={createForm.role} onChange={v => setCreateForm({...createForm, role: v})} options={[{value: 'admin', label: 'Admin Access'}, {value: 'data-entry', label: 'Data Entry'}, {value: 'viewer', label: 'Viewer Only'}]} buttonClassName="!rounded-lg !border-slate-100 !bg-[#f4faff] !text-sm !font-bold" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                         <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Password</label>
                            <input type="password" className="w-full rounded-lg border border-slate-100 bg-[#f4faff] px-4 py-2 text-sm font-bold" value={createForm.password} onChange={e => setCreateForm({...createForm, password: e.target.value})} />
                         </div>
                         <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Confirm</label>
                            <input type="password" className="w-full rounded-lg border border-slate-100 bg-[#f4faff] px-4 py-2 text-sm font-bold" value={createForm.confirmPassword} onChange={e => setCreateForm({...createForm, confirmPassword: e.target.value})} />
                         </div>
                      </div>
                      {createError && <p className="text-[10px] font-bold text-red-500 uppercase">{createError}</p>}
                      <button className="w-full rounded-lg bg-[#001f2a] py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-black">Initialize Account</button>
                   </form>
                </section>
             </div>

             <div className="lg:col-span-8">
                <section className="rounded-xl bg-white shadow-sm border border-slate-50 overflow-hidden">
                   <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Authorized Personnel</h3>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{users.length} Registered</span>
                   </div>
                   <table className="w-full text-left text-xs">
                      <thead>
                         <tr className="bg-white/50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-50">
                            <th className="px-6 py-4">Identity</th>
                            <th className="px-6 py-4">Privilege</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                         {users.map(user => (
                            <tr key={user._id} className="hover:bg-slate-50 transition-colors">
                               <td className="px-6 py-4">
                                  <div className="font-bold text-[#001f2a]">{user.displayName}</div>
                                  <div className="text-slate-400 text-[10px]">@{user.username}</div>
                               </td>
                               <td className="px-6 py-4">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${user.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>{user.role}</span>
                               </td>
                               <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                     <div className={`h-1.5 w-1.5 rounded-full ${user.active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                     <span className="font-bold uppercase text-[10px] text-slate-500">{user.active ? 'Verified Active' : 'Suspended'}</span>
                                  </div>
                               </td>
                               <td className="px-6 py-4 text-right">
                                  <button onClick={() => setActiveModal({type: 'password', user})} className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-1.5 text-[10px] font-black uppercase hover:bg-white transition">Reset Key</button>
                               </td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                </section>
             </div>
          </div>
        </main>
      </div>
      {activeModal?.type === 'password' && (
         <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl p-8 space-y-6">
               <div>
                  <h3 className="text-xl font-black text-[#001f2a]">Reset Access Key</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase mt-1">User: {activeModal.user.username}</p>
               </div>
               <div className="space-y-4">
                  <input type="password" placeholder="New Secret Password" className="w-full rounded-lg border border-slate-100 bg-[#f4faff] px-4 py-3 text-sm font-bold" value={passwordForm.password} onChange={e => setPasswordForm({...passwordForm, password: e.target.value})} />
                  <input type="password" placeholder="Verify Secret Password" className="w-full rounded-lg border border-slate-100 bg-[#f4faff] px-4 py-3 text-sm font-bold" value={passwordForm.confirmPassword} onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})} />
               </div>
               <div className="flex gap-3">
                  <button onClick={() => setActiveModal(null)} className="flex-1 rounded-lg border border-slate-200 py-3 text-xs font-black uppercase tracking-widest text-slate-400">Cancel</button>
                  <button className="flex-1 rounded-lg bg-emerald-600 py-3 text-xs font-black uppercase tracking-widest text-white">Update Key</button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}

export default UsersPage;
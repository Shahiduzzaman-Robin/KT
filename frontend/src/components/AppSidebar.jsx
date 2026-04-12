import { Link, useLocation } from 'react-router-dom';
import { useCurrentRole, useCurrentUser } from '../utils/auth';

function AppSidebar({ onExport, compactFilters }) {
  const role = useCurrentRole();
  const user = useCurrentUser();
  const location = useLocation();

  const links = [
    { to: '/', label: 'Dashboard' },
    { to: '/ledgers', label: 'Ledger' },
    ...(role === 'admin'
      ? [
          { to: '/reports', label: 'Reports Archive' },
          { to: '/audit-logs', label: 'Audit Logs' },
          { to: '/users', label: 'Users' },
        ]
      : []),
  ];

  return (
    <aside className="hidden h-fit w-72 shrink-0 flex-col rounded-3xl bg-[#e6f6ff] p-4 xl:flex sticky top-5">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#00694b] text-xl font-bold text-white">
          {String(user?.displayName || user?.username || 'K').slice(0, 1).toUpperCase()}
        </div>
        <div>
          <h2 className="[font-family:Manrope,ui-sans-serif,system-ui] text-sm font-bold text-[#001f2a]">Kamrul Traders</h2>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Financial Admin</p>
        </div>
      </div>

      <nav className="space-y-1">
        {links.map((item) => {
          const active = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`block rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                active
                  ? 'bg-[#d9f8ea] text-[#00694b]'
                  : 'text-slate-600 hover:bg-white/80 hover:text-[#001f2a]'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {compactFilters ? (
        <div className="mt-4 rounded-2xl bg-white/70 p-3">
          {compactFilters}
        </div>
      ) : null}

      <div className="mt-5 space-y-4 px-2">
        {role === 'admin' && typeof onExport === 'function' ? (
          <button
            className="w-full cursor-pointer rounded-xl bg-[#001f2a] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white transition hover:opacity-90 shadow-md"
            type="button"
            onClick={onExport}
          >
            Export All Records
          </button>
        ) : null}

        {role === 'admin' && (
          <Link
            to="/close-day"
            className="flex w-full items-center justify-between overflow-hidden rounded-2xl bg-[#001f2a] p-4 text-white shadow-lg transition active:scale-[0.98] group relative"
          >
             <div className="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/10 transition-colors" />
             <div className="relative">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 group-hover:text-emerald-300 transition-colors">Business Closure</p>
                <p className="mt-1 text-sm font-black tracking-tight">End Day System</p>
             </div>
             <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 group-hover:bg-white/20 transition-all">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
             </div>
          </Link>
        )}
      </div>
    </aside>
  );
}

export default AppSidebar;

import { Link, useLocation } from 'react-router-dom';
import { useCurrentRole, useCurrentUser } from '../utils/auth';

function AppSidebar({ onExport, compactFilters }) {
  const role = useCurrentRole();
  const user = useCurrentUser();
  const location = useLocation();

  const links = [
    { to: '/', label: 'Dashboard' },
    { to: '/ledgers', label: 'Ledger' },
    ...(role === 'admin' ? [{ to: '/audit-logs', label: 'Audit Logs' }, { to: '/users', label: 'Users' }] : []),
  ];

  return (
    <aside className="hidden h-[calc(100vh-2.5rem)] w-64 shrink-0 flex-col overflow-y-auto rounded-3xl bg-[#e6f6ff] p-4 xl:flex">
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

      <div className="mt-5 space-y-2 px-2">
        {typeof onExport === 'function' ? (
          <button
            className="w-full cursor-pointer rounded-xl bg-[#001f2a] px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition hover:opacity-90"
            type="button"
            onClick={onExport}
          >
            Export Reports
          </button>
        ) : null}
      </div>
    </aside>
  );
}

export default AppSidebar;

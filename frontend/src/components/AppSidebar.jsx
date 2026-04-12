import { Link, useLocation } from 'react-router-dom';
import { useCurrentRole, useCurrentUser } from '../utils/auth';

function AppSidebar({ onExport, compactFilters }) {
  const role = useCurrentRole();
  const user = useCurrentUser();
  const location = useLocation();

  const links = [
    { 
      to: '/', 
      label: 'Dashboard', 
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
    { 
      to: '/ledgers', 
      label: 'Ledger', 
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      )
    },
    { 
      to: '/audit-logs', 
      label: 'Audit Logs', 
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      )
    },
    { 
      to: '/reports', 
      label: 'Reports Archive', 
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      )
    },
    { 
      to: '/loans', 
      label: 'Loans & Advances', 
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    },
  ];

  const adminLinks = [
    { 
      to: '/users', 
      label: 'Users', 
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )
    },
  ];

  const allLinks = [...links, ...(role === 'admin' ? adminLinks : [])];

  return (
    <aside className="hidden h-fit w-72 shrink-0 flex-col rounded-xl bg-[#e6f6ff] p-5 xl:flex sticky top-5 shadow-2xl shadow-blue-900/5 border border-white/50 backdrop-blur-sm">
      <div className="mb-10 flex items-center gap-4 px-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#00694b] text-xl font-black text-white shadow-lg shadow-emerald-900/20">
          {String(user?.displayName || user?.username || 'K').slice(0, 1).toUpperCase()}
        </div>
        <div>
          <h2 className="[font-family:Manrope,ui-sans-serif,system-ui] text-base font-black tracking-tight text-[#001f2a]">Kamrul Traders</h2>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#00694b]/60">Financial Control</p>
        </div>
      </div>

      <nav className="space-y-2">
        {allLinks.map((item) => {
          const active = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 rounded-lg px-5 py-3.5 text-sm font-bold transition-all duration-300 ${
                active
                  ? 'bg-white text-[#00694b] shadow-[0_8px_20px_rgba(0,105,75,0.08)] scale-[1.02]'
                  : 'text-slate-500 hover:bg-white/50 hover:text-[#001f2a] hover:translate-x-1'
              }`}
            >
              <div className={`${active ? 'text-[#00694b]' : 'text-slate-400 opacity-70'}`}>
                 {item.icon}
              </div>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {compactFilters ? (
        <div className="mt-4 rounded-lg bg-white/70 p-3">
          {compactFilters}
        </div>
      ) : null}

      <div className="mt-5 space-y-4 px-2">
        {(role === 'admin' || role === 'data-entry') && typeof onExport === 'function' ? (
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
            className="flex w-full items-center justify-between overflow-hidden rounded-lg bg-[#001f2a] p-4 text-white shadow-lg transition active:scale-[0.98] group relative"
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

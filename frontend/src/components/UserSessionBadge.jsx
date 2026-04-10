import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import api from '../utils/api';
import { clearAuthSession, useCurrentUser } from '../utils/auth';
import PasswordChangeModal from './PasswordChangeModal';

function UserSessionBadge({ compact = false }) {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const actionsRef = useRef(null);

  async function logout() {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error(error);
    } finally {
      clearAuthSession();
      navigate('/login', { replace: true });
    }
  }

  useEffect(() => {
    function handleClickOutside(event) {
      if (!actionsRef.current) return;
      if (!actionsRef.current.contains(event.target)) {
        setShowActions(false);
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setShowActions(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  if (!user) return null;

  const shellClass = compact
    ? 'flex flex-wrap items-center gap-2 rounded-2xl bg-[#f4faff] px-3 py-2 text-sm'
    : 'flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm';

  const roleClass = compact
    ? 'rounded-full bg-[#d9f2ff] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#005139]'
    : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-700';

  const actionClass = compact
    ? 'rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-[#3d4a43] transition hover:bg-[#d9f2ff]'
    : 'secondary-btn h-8 px-3 text-xs';

  const gearButtonClass = compact
    ? 'inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[#3d4a43] transition hover:bg-[#d9f2ff]'
    : 'inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-[#3d4a43] shadow-sm transition hover:bg-slate-50';

  const menuClass = compact
    ? 'absolute right-0 top-full z-30 mt-2 w-48 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl'
    : 'absolute right-0 top-full z-30 mt-2 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl';

  return (
    <div className={shellClass}>
      <div className="leading-tight">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Signed in</p>
        <p className="font-semibold text-[#001f2a]">{user.displayName || user.username}</p>
      </div>
      <span className={roleClass}>
        {user.role}
      </span>
      <button className={actionClass} type="button" onClick={logout}>
        Logout
      </button>
      <div ref={actionsRef} className="relative">
        <button
          aria-label="User actions"
          aria-expanded={showActions}
          className={gearButtonClass}
          type="button"
          onClick={() => setShowActions((prev) => !prev)}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
            <path
              d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Zm8.5-3.5c0-.33-.03-.65-.08-.97l2.02-1.57-1.9-3.3-2.45.98a8.11 8.11 0 0 0-1.68-.97l-.37-2.6H9.96l-.37 2.6c-.6.23-1.16.55-1.68.97l-2.45-.98-1.9 3.3 2.02 1.57c-.05.32-.08.64-.08.97s.03.65.08.97L3.56 14.5l1.9 3.3 2.45-.98c.52.42 1.08.74 1.68.97l.37 2.6h6.08l.37-2.6c.6-.23 1.16-.55 1.68-.97l2.45.98 1.9-3.3-2.02-1.57c.05-.32.08-.64.08-.97Z"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {showActions ? (
          <div className={menuClass}>
            <button className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-[#3d4a43] transition hover:bg-[#e6f6ff]" type="button" onClick={() => { setShowPasswordChange(true); setShowActions(false); }}>
              Change Password
            </button>
            {user.role === 'admin' ? (
              <>
                <Link className="block rounded-xl px-3 py-2 text-sm font-semibold text-[#3d4a43] transition hover:bg-[#e6f6ff]" to="/audit-logs" onClick={() => setShowActions(false)}>
                  Audit Logs
                </Link>
                <Link className="block rounded-xl px-3 py-2 text-sm font-semibold text-[#3d4a43] transition hover:bg-[#e6f6ff]" to="/users" onClick={() => setShowActions(false)}>
                  Manage Users
                </Link>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      <PasswordChangeModal open={showPasswordChange} onClose={() => setShowPasswordChange(false)} />
    </div>
  );
}

export default UserSessionBadge;
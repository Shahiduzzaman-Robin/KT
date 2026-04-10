import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { saveAuthSession, useAuthSession } from '../utils/auth';

function LoginPage() {
  const session = useAuthSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const from = location.state?.from?.pathname || '/';

  useEffect(() => {
    if (session?.token) {
      navigate(from, { replace: true });
    }
  }, [session, navigate, from]);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/auth/login', form);
      saveAuthSession(data);
      navigate(from, { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#dff6f0_0%,#f6f8fc_55%,#f8efe7_100%)] px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl lg:grid-cols-[1.1fr_0.9fr]">
        <div className="bg-[linear-gradient(160deg,#0f172a_0%,#1e3a8a_55%,#0f766e_100%)] p-8 text-white lg:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200">M/S Kamrul Traders</p>
          <h1 className="mt-4 max-w-md text-4xl font-black leading-tight lg:text-5xl">
            Sign in to manage ledgers and transactions.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-slate-200">
            Use your account to access transaction entry, editing, ledger management, and export tools with role-based controls.
          </p>

          <div className="mt-8 space-y-3 rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <p className="text-sm font-semibold text-cyan-100">Demo accounts</p>
            <div className="grid gap-3 text-sm text-slate-100 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="font-bold">admin</p>
                <p className="text-slate-200">admin123</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="font-bold">entry</p>
                <p className="text-slate-200">entry123</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="font-bold">viewer</p>
                <p className="text-slate-200">viewer123</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 lg:p-10">
          <div className="mx-auto max-w-md">
            <h2 className="text-3xl font-black text-slate-800">Login</h2>
            <p className="mt-2 text-sm text-slate-600">Enter your credentials to continue.</p>

            <form className="mt-8 space-y-4" onSubmit={submit}>
              <div>
                <label className="label">Username</label>
                <input
                  className="input"
                  value={form.username}
                  onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
                  autoComplete="username"
                  placeholder="admin"
                />
              </div>

              <div>
                <label className="label">Password</label>
                <input
                  className="input"
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
              </div>

              {error ? <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p> : null}

              <button className="primary-btn w-full" type="submit" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
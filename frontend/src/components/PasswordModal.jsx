import { useState } from 'react';

function PasswordModal({ isOpen, onClose, onConfirm, title, message, loading }) {
  const [password, setPassword] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(password);
    setPassword('');
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-md">
      <div className="w-full max-w-md overflow-hidden rounded-[2.5rem] bg-white shadow-2xl animate-in fade-in zoom-in duration-300">
        <div className="bg-[#ba1a1a]/5 px-8 pt-8 pb-6">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ba1a1a]/10 text-[#ba1a1a]">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="[font-family:Manrope,ui-sans-serif,system-ui] text-2xl font-black tracking-tight text-[#001f2a]">{title || 'Confirm Identity'}</h3>
          <p className="mt-2 text-sm font-medium leading-relaxed text-[#3d4a43] opacity-80">
            {message || 'This action requires administrative confirmation. Please enter your password to proceed.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-8 pb-8">
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">Admin Password</label>
              <input
                autoFocus
                type="password"
                required
                className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 py-4 text-lg font-bold text-[#001f2a] transition focus:border-[#00694b] focus:bg-white focus:outline-none"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center rounded-2xl bg-[#001f2a] py-4 text-sm font-black uppercase tracking-widest text-white transition hover:bg-[#00344a] disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Unlock & Confirm'}
              </button>
              <button
                onClick={() => {
                   setPassword('');
                   onClose();
                }}
                type="button"
                className="w-full py-2 text-xs font-bold uppercase tracking-widest text-slate-400 transition hover:text-[#ba1a1a]"
              >
                Cancel Action
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PasswordModal;

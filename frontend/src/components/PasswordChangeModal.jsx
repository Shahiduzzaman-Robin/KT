import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../utils/api';

const EMPTY = {
  currentPassword: '',
  password: '',
  confirmPassword: '',
};

function PasswordChangeModal({ open, onClose }) {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const confirmButtonRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    confirmButtonRef.current?.focus();

    function onKeyDown(event) {
      if (!open) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        if (!loading) onClose();
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        if (!loading) submit();
      }
    }

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, loading, onClose]);

  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setError('');
    }
  }, [open]);

  async function submit() {
    if (!form.currentPassword || !form.password || !form.confirmPassword) {
      setError('Please complete all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.patch('/auth/change-password', form);
      onClose();
      alert('Password changed successfully');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[350] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
        <h3 className="text-2xl font-extrabold text-slate-800">Change Password</h3>
        <p className="mt-1 text-sm text-slate-600">Update your account password securely.</p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="label">Current Password</label>
            <input
              className="input"
              type="password"
              value={form.currentPassword}
              onChange={(event) => setForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
            />
          </div>
          <div>
            <label className="label">New Password</label>
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            />
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <input
              className="input"
              type="password"
              value={form.confirmPassword}
              onChange={(event) => setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
            />
          </div>
          {error ? <p className="error-text text-sm">{error}</p> : null}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button className="secondary-btn" type="button" disabled={loading} onClick={onClose}>
            Cancel
          </button>
          <button ref={confirmButtonRef} className="primary-btn" type="button" disabled={loading} onClick={submit}>
            {loading ? 'Saving...' : 'Change Password'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default PasswordChangeModal;
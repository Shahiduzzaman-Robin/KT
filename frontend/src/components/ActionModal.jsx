function ActionModal({ isOpen, onClose, onConfirm, title, message, confirmText, cancelText, type = 'danger' }) {
  if (!isOpen) return null;

  const typeStyles = {
    danger: {
      bg: 'bg-red-50',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      btn: 'bg-[#ba1a1a] hover:bg-[#8c1d1d]',
      icon: (
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      )
    },
    warning: {
      bg: 'bg-amber-50',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      btn: 'bg-amber-600 hover:bg-amber-700',
      icon: (
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      )
    },
    success: {
      bg: 'bg-emerald-50',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      btn: 'bg-[#00694b] hover:bg-[#004d37]',
      icon: (
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )
    }
  };

  const style = typeStyles[type] || typeStyles.danger;

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-md">
      <div className="w-full max-w-md overflow-hidden rounded-[2.5rem] bg-white shadow-2xl animate-in fade-in zoom-in duration-300">
        <div className={`${style.bg} px-8 pt-8 pb-6`}>
          <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${style.iconBg} ${style.iconColor}`}>
            {style.icon}
          </div>
          <h3 className="[font-family:Manrope,ui-sans-serif,system-ui] text-2xl font-black tracking-tight text-[#001f2a]">{title}</h3>
          <p className="mt-2 text-sm font-medium leading-relaxed text-[#3d4a43] opacity-80">
            {message}
          </p>
        </div>

        <div className="flex flex-col gap-3 p-8">
          <button
            onClick={onConfirm}
            className={`flex w-full items-center justify-center rounded-2xl py-4 text-sm font-black uppercase tracking-widest text-white transition shadow-lg ${style.btn}`}
          >
            {confirmText || 'Confirm'}
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 text-xs font-bold uppercase tracking-widest text-slate-400 transition hover:text-slate-600"
          >
            {cancelText || 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ActionModal;

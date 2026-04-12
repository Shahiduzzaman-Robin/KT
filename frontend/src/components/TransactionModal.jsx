import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import TransactionForm from './TransactionForm';

function TransactionModal({ isOpen, onClose, editingTransaction, onSaved }) {
  useEffect(() => {
    if (!isOpen) return;
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;

    document.body.style.overflow = 'hidden';
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-md animate-in fade-in duration-300">
      <div 
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[2rem] bg-white shadow-2xl animate-in zoom-in duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-6 top-6 z-50 rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-500"
          aria-label="Close modal"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-2 md:p-4">
          <TransactionForm
            isModal={true}
            editingTransaction={editingTransaction}
            onSaved={() => {
              onSaved();
              onClose();
            }}
          />
        </div>
      </div>
      {/* Backdrop click to close */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>,
    document.body
  );
}

export default TransactionModal;

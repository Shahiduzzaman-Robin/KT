import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  className = '',
  buttonClassName = '',
  menuClassName = '',
}) {
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({ top: 0, left: 0, width: 0 });

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value]
  );

  useEffect(() => {
    function updateMenuPosition() {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuStyle({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
      });
    }

    function onDocumentClick(event) {
      if (
        !containerRef.current?.contains(event.target) &&
        !menuRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    function onDocumentKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', onDocumentClick);
    document.addEventListener('keydown', onDocumentKeyDown);
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    if (open) {
      updateMenuPosition();
    }

    return () => {
      document.removeEventListener('mousedown', onDocumentClick);
      document.removeEventListener('keydown', onDocumentKeyDown);
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className={`relative ${open ? 'z-[140]' : 'z-10'} ${className}`}
    >
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        className={`input flex items-center justify-between ${buttonClassName}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="truncate text-left">{selectedOption?.label || placeholder || 'Select'}</span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open
        ? createPortal(
            <div
              ref={menuRef}
              className={`custom-select-menu open ${menuClassName}`}
              style={{
                position: 'fixed',
                top: `${menuStyle.top}px`,
                left: `${menuStyle.left}px`,
                width: `${menuStyle.width}px`,
              }}
              role="listbox"
            >
              {options.map((option) => (
                <button
                  key={option.value || '__empty'}
                  type="button"
                  className={`custom-select-option ${option.value === value ? 'active' : ''}`}
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

export default CustomSelect;

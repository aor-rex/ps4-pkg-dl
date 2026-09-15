import { useEffect } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Alert02Icon } from '@hugeicons/core-free-icons';
import { useAppStore } from '../../store/appStore';
import { useModalTransition } from '../common/useModalTransition';

export default function ConfirmDialog() {
  const {
    confirmDialogOpen,
    setConfirmDialogOpen,
    confirmDialogMessage,
    confirmDialogOnConfirm,
  } = useAppStore();

  const { shouldRender, exiting } = useModalTransition(confirmDialogOpen);

  useEffect(() => {
    if (!confirmDialogOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmDialogOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirmDialogOpen, setConfirmDialogOpen]);

  if (!shouldRender) return null;

  const handleConfirm = () => {
    if (confirmDialogOnConfirm) {
      confirmDialogOnConfirm();
    }
    setConfirmDialogOpen(false);
  };

  return (
    <div
      className={`fixed inset-0 z-[1000] flex items-center justify-center ${exiting ? 'modal-exit' : 'modal-enter'}`}
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={() => setConfirmDialogOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Confirm"
    >
      <div
        style={{
          width: '400px',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '20px 24px 12px',
          }}
        >
          <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} size={24} style={{ color: 'var(--warning)', flexShrink: 0 }} />
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Confirm Action
          </h2>
        </div>

        {/* Message */}
        <p
          style={{
            fontSize: '14px',
            color: 'var(--text-secondary)',
            padding: '0 24px 20px',
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          {confirmDialogMessage}
        </p>

        {/* Buttons */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            padding: '0 24px 20px',
          }}
        >
          <button
            onClick={() => setConfirmDialogOpen(false)}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '14px',
              padding: '8px 20px',
              cursor: 'pointer',
              transition: 'color 0.2s ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color =
                'var(--text-secondary)';
            }}
          >
            No
          </button>
          <button
            onClick={handleConfirm}
            style={{
              backgroundColor: 'var(--error)',
              border: 'none',
              color: 'var(--on-error)',
              fontSize: '14px',
              fontWeight: 600,
              padding: '8px 20px',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'background-color 0.2s ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--error-hover)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                'var(--error)';
            }}
          >
            Yes
          </button>
        </div>
      </div>
    </div>
  );
}

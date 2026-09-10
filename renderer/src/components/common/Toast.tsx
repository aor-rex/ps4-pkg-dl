import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { CheckmarkCircle01Icon, Cancel01Icon, InformationCircleIcon } from '@hugeicons/core-free-icons';
import { useAppStore } from '../../store/appStore';

export default function ToastContainer() {
  const { toasts, removeToast } = useAppStore();
  const [leaving, setLeaving] = useState<string[]>([]);

  if (toasts.length === 0) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <HugeiconsIcon icon={CheckmarkCircle01Icon} strokeWidth={2} className="w-5 h-5" style={{ color: 'var(--success)' }} />;
      case 'error': return <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="w-5 h-5" style={{ color: 'var(--error)' }} />;
      case 'info': return <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} className="w-5 h-5" style={{ color: 'var(--primary-container)' }} />;
      default: return null;
    }
  };

  const accentFor = (type: string) =>
    type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--error)' : 'var(--accent)';

  const dismiss = (id: string) => {
    if (leaving.includes(id)) return;
    setLeaving((prev) => [...prev, id]);
    setTimeout(() => removeToast(id), 200);
  };

  return (
    <div className="fixed bottom-20 right-4 z-[100] space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`border rounded-lg px-4 py-3 flex items-center gap-3 min-w-[320px] shadow-lg ${leaving.includes(toast.id) ? 'toast-exit' : 'toast-enter'}`}
          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', borderLeft: `3px solid ${accentFor(toast.type)}`, opacity: 1, boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}
        >
          {getIcon(toast.type)}
          <span className="flex-1 text-sm" style={{ color: 'var(--text-primary)' }}>{toast.message}</span>
          <button
            onClick={() => dismiss(toast.id)}
            className="p-1 rounded transition-colors"
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-bright)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>
      ))}
    </div>
  );
}

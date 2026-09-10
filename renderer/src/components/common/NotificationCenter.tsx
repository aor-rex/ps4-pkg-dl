import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Notification01Icon, CheckmarkCircle01Icon, Cancel01Icon, InformationCircleIcon } from '@hugeicons/core-free-icons';
import { useAppStore } from '../../store/appStore';

function iconFor(type: string) {
  if (type === 'success') return <HugeiconsIcon icon={CheckmarkCircle01Icon} strokeWidth={2} style={{ width: '16px', height: '16px', color: 'var(--success)', flexShrink: 0 }} />;
  if (type === 'error') return <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} style={{ width: '16px', height: '16px', color: 'var(--error)', flexShrink: 0 }} />;
  return <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} style={{ width: '16px', height: '16px', color: 'var(--accent)', flexShrink: 0 }} />;
}

function timeAgo(at: number): string {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(at).toLocaleDateString();
}

export default function NotificationCenter() {
  const { notificationHistory, unreadNotifications, markNotificationsRead, clearNotificationHistory } = useAppStore();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) markNotificationsRead();
        }}
        className="relative p-2 rounded transition-colors"
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--accent)';
          e.currentTarget.style.backgroundColor = 'rgba(102,192,244,0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text-muted)';
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
        style={{ color: 'var(--text-muted)' }}
        title="Notifications"
      >
        <HugeiconsIcon icon={Notification01Icon} strokeWidth={2} style={{ width: '20px', height: '20px' }} />
        {unreadNotifications > 0 && (
          <span
            className="absolute flex items-center justify-center"
            style={{
              top: '2px',
              right: '2px',
              minWidth: '16px',
              height: '16px',
              padding: '0 4px',
              backgroundColor: 'var(--accent)',
              color: 'var(--text-on-accent)',
              fontSize: '10px',
              fontWeight: 700,
              borderRadius: '8px',
            }}
          >
            {unreadNotifications > 99 ? '99+' : unreadNotifications}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 mt-2 z-50 rounded-lg overflow-hidden modal-enter"
            style={{
              width: '360px',
              maxHeight: '420px',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}
          >
            <div
              className="flex items-center justify-between"
              style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}
            >
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Notifications
              </span>
              {notificationHistory.length > 0 && (
                <button
                  onClick={() => clearNotificationHistory()}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '12px' }}
                >
                  Clear
                </button>
              )}
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {notificationHistory.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
                  No notifications yet.
                </div>
              ) : (
                [...notificationHistory].reverse().map((n) => (
                  <div
                    key={n.id}
                    className="flex items-start"
                    style={{ gap: '10px', padding: '10px 16px', borderBottom: '1px solid var(--border)' }}
                  >
                    {iconFor(n.type)}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.45 }}>{n.message}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{timeAgo(n.at)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

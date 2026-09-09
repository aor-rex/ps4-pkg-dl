import { useState } from 'react';
import { useAppStore } from '../../store/appStore';

const getStatusColor = (reliability: string) => {
  switch (reliability) {
    case 'High':
    case 'Good':
      return 'var(--success)';
    case 'Medium':
      return 'var(--warning)';
    default:
      return 'var(--error)';
  }
};

export default function MirrorModal() {
  const {
    mirrorModalOpen,
    setMirrorModalOpen,
    selectedMirrors,
    selectedGame,
    startDownload,
    setRememberedMirrorHost,
  } = useAppStore();
  const [resolving, setResolving] = useState<string | null>(null);
  const [remember, setRemember] = useState(false);

  if (!mirrorModalOpen || !selectedMirrors.length) return null;

  const handleSelect = async (mirror: any) => {
    setResolving(mirror.host);
    if (remember && mirror.host) setRememberedMirrorHost(mirror.host);
    await startDownload(mirror, selectedGame);
    setResolving(null);
    setRemember(false);
    setMirrorModalOpen(false);
  };

  const fileLabel = selectedGame
    ? `${selectedGame.title} - Base Game (${selectedGame.size})`
    : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-enter"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={() => setMirrorModalOpen(false)}
    >
      <div
        className="w-[520px] max-h-[80vh] overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <div style={{ padding: '20px 24px 16px' }}>
          <h2
            style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}
          >
            Download: {fileLabel}
          </h2>
        </div>

        {/* Subtitle */}
        <p
          style={{
            fontSize: '14px',
            color: 'var(--text-muted)',
            padding: '0 24px 16px',
          }}
        >
          Select mirror:
        </p>

        {/* Mirror List */}
        <div>
          {selectedMirrors.map((mirror, idx) => {
            const isLast = idx === selectedMirrors.length - 1;
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  height: '64px',
                  padding: '12px 24px',
                  backgroundColor: 'transparent',
                  borderBottom: isLast ? 'none' : '1px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.backgroundColor =
                    'rgba(102,192,244,0.05)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.backgroundColor =
                    'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Status Dot */}
                  <div
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: getStatusColor(mirror.reliability),
                      flexShrink: 0,
                    }}
                  />
                  {/* Host Info */}
                  <div style={{ marginLeft: '8px' }}>
                    <div
                      style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' }}
                    >
                      {mirror.host}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Speed: {mirror.speed} | Reliability: {mirror.reliability}
                    </div>
                  </div>
                </div>
                {/* Select Button */}
                <button
                  onClick={() => handleSelect(mirror)}
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid var(--accent)',
                    color: 'var(--accent)',
                    fontSize: '13px',
                    fontWeight: 500,
                    padding: '6px 16px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                      'rgba(102,192,244,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                      'transparent';
                  }}
                >
                  {resolving === mirror.host ? 'Resolving...' : 'Select'}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border)',
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              marginBottom: '8px',
            }}
          >
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              style={{ accentColor: 'var(--accent)', width: '14px', height: '14px' }}
            />
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Remember my choice for this session
            </span>
          </label>
          <button
            onClick={() => setMirrorModalOpen(false)}
            style={{
              display: 'block',
              width: '100%',
              backgroundColor: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '14px',
              padding: '8px',
              cursor: 'pointer',
              transition: 'color 0.2s ease',
              textAlign: 'center',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color =
                'var(--text-muted)';
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

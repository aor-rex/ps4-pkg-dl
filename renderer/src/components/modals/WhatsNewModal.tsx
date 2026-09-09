import { useAppStore } from '../../store/appStore';

export function changelogSection(version: string): string {
  const md: string = typeof __CHANGELOG_MD__ !== 'undefined' ? __CHANGELOG_MD__ : '';
  const lines = md.split('\n');
  const start = lines.findIndex((l) => l.startsWith(`## [v${version}]`));
  if (start === -1) return '';
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## \[/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join('\n').trim();
}

export function appVersion(): string {
  try {
    return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '';
  } catch {
    return '';
  }
}

export default function WhatsNewModal() {
  const { whatsNewOpen, setWhatsNewOpen, setSettingsOpen, setSettingsCategory, updateStatus, updateVersion, updateProgress, downloadUpdate, restartToUpdate } = useAppStore();
  if (!whatsNewOpen) return null;
  const version = appVersion();
  const notes = changelogSection(version);
  const updateReady = updateStatus === 'available' || updateStatus === 'downloading' || updateStatus === 'downloaded';

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center modal-enter"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={() => setWhatsNewOpen(false)}
    >
      <div
        style={{
          width: '520px',
          maxWidth: '90vw',
          maxHeight: '80vh',
          overflowY: 'auto',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          padding: '24px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
          What&apos;s new in v{version || 'this version'}
        </h2>
        <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginTop: '12px' }}>
          {notes || 'No changelog notes for this version yet.'}
        </div>
        {updateReady && updateVersion && (
          <div style={{ marginTop: '16px', padding: '12px 16px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '6px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Update available: v{updateVersion}
            </div>
            {updateStatus === 'available' && (
              <button
                onClick={() => void downloadUpdate()}
                style={{ backgroundColor: 'var(--accent)', border: 'none', color: 'var(--text-on-accent)', fontSize: '13px', fontWeight: 600, padding: '8px 20px', borderRadius: '4px', cursor: 'pointer', marginTop: '8px' }}
              >
                Download update
              </button>
            )}
            {updateStatus === 'downloading' && (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>Downloading… {updateProgress}%</div>
            )}
            {updateStatus === 'downloaded' && (
              <button
                onClick={() => void restartToUpdate()}
                style={{ backgroundColor: 'var(--accent)', border: 'none', color: 'var(--text-on-accent)', fontSize: '13px', fontWeight: 600, padding: '8px 20px', borderRadius: '4px', cursor: 'pointer', marginTop: '8px' }}
              >
                Restart to install
              </button>
            )}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
          <button
            onClick={() => {
              setWhatsNewOpen(false);
              setSettingsCategory('about');
              setSettingsOpen(true);
            }}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              fontSize: '14px',
              padding: '8px 20px',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Open Settings
          </button>
          <button
            onClick={() => setWhatsNewOpen(false)}
            style={{
              backgroundColor: 'var(--accent)',
              border: 'none',
              color: 'var(--text-on-accent)',
              fontSize: '14px',
              fontWeight: 600,
              padding: '8px 20px',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

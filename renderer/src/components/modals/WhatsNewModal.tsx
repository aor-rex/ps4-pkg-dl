import { useAppStore } from '../../store/appStore';
import { formatTransfer } from '../../lib/format';

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

/** Minimal markdown renderer for changelog sections (no new deps). */
export function renderMarkdown(md: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const inline = (text: string, key: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    // [text](url), **bold**, `code`
    const re = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let i = 0;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) parts.push(text.slice(last, m.index));
      if (m[1] !== undefined) {
        parts.push(
          <a key={`${key}-l${i}`} href={m[2]} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
            {m[1]}
          </a>
        );
      } else if (m[3] !== undefined) {
        parts.push(<strong key={`${key}-b${i}`}>{m[3]}</strong>);
      } else if (m[4] !== undefined) {
        parts.push(
          <code key={`${key}-c${i}`} style={{ backgroundColor: 'var(--bg-tertiary)', padding: '1px 5px', borderRadius: '3px', fontSize: '12px' }}>
            {m[4]}
          </code>
        );
      }
      i++;
      last = m.index + m[0].length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts;
  };
  md.split('\n').forEach((line, idx) => {
    const key = `${keyPrefix}-${idx}`;
    const h3 = line.match(/^###\s+(.*)/);
    if (h3) {
      out.push(
        <div key={key} style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginTop: idx === 0 ? 0 : '12px', marginBottom: '6px' }}>
          {inline(h3[1], key)}
        </div>
      );
      return;
    }
    const li = line.match(/^[-*]\s+(.*)/);
    if (li) {
      out.push(
        <div key={key} style={{ display: 'flex', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '4px' }}>
          <span style={{ color: 'var(--accent)', flexShrink: 0 }}>•</span>
          <span>{inline(li[1], key)}</span>
        </div>
      );
      return;
    }
    if (!line.trim()) return;
    out.push(
      <div key={key} style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '6px' }}>
        {inline(line, key)}
      </div>
    );
  });
  return out;
}

export default function WhatsNewModal() {
  const { whatsNewOpen, setWhatsNewOpen, setSettingsOpen, setSettingsCategory, updateStatus, updateVersion, updateProgress, updateTransferred, updateTotal, downloadUpdate, restartToUpdate } = useAppStore();
  if (!whatsNewOpen) return null;
  const version = appVersion();
  const notes = changelogSection(version);
  const updateReady = updateStatus === 'available' || updateStatus === 'downloading' || updateStatus === 'downloaded' || updateStatus === 'stalled';

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
        <div style={{ marginTop: '12px' }}>
          {notes ? renderMarkdown(notes, 'wn') : 'No changelog notes for this version yet.'}
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
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>Downloading… {formatTransfer(updateTransferred, updateTotal, updateProgress)}</div>
            )}
            {updateStatus === 'stalled' && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: '13px', color: 'var(--warning)' }}>Stalled at {formatTransfer(updateTransferred, updateTotal, updateProgress)} — check your connection.</div>
                <button
                  onClick={() => void downloadUpdate()}
                  style={{ backgroundColor: 'transparent', border: '1px solid var(--accent)', color: 'var(--accent)', fontSize: '13px', fontWeight: 600, padding: '8px 20px', borderRadius: '4px', cursor: 'pointer', marginTop: '8px' }}
                >
                  Retry download
                </button>
              </div>
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

import { useAppStore } from '../../store/appStore';
import { formatTransfer } from '../../lib/format';

const primaryBtn = {
  backgroundColor: 'var(--accent)',
  border: 'none',
  color: 'var(--text-on-accent)',
  fontSize: '13px',
  fontWeight: 600,
  padding: '8px 20px',
  borderRadius: '4px',
  cursor: 'pointer',
  marginTop: '8px',
} as const;

const outlineBtn = {
  ...primaryBtn,
  backgroundColor: 'transparent',
  border: '1px solid var(--accent)',
  color: 'var(--accent)',
} as const;

/**
 * Update offer state machine (available → downloading → downloaded,
 * plus stalled/error branches). Shared by Settings → About and the
 * What's-new modal so the two can never drift apart.
 */
export default function UpdateOffer() {
  const { updateStatus, updateVersion, updateProgress, updateTransferred, updateTotal, updateError, downloadUpdate, restartToUpdate } = useAppStore();

  if (!updateVersion && updateStatus !== 'error') return null;

  return (
    <div>
      {updateVersion && (
        <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>
          Update available: v{updateVersion}
        </div>
      )}
      {updateStatus === 'available' && (
        <button onClick={() => void downloadUpdate()} style={primaryBtn}>
          Download update
        </button>
      )}
      {updateStatus === 'downloading' && (
        <div style={{ marginTop: '8px' }}>
          <div style={{ height: '8px', borderRadius: '4px', backgroundColor: 'var(--bg-tertiary)', overflow: 'hidden' }}>
            <div className="progress-fill" style={{ height: '100%', width: `${updateProgress}%`, backgroundColor: 'var(--accent)' }} />
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px' }}>
            Downloading… {formatTransfer(updateTransferred, updateTotal, updateProgress)}
          </div>
        </div>
      )}
      {updateStatus === 'stalled' && (
        <div style={{ marginTop: '8px' }}>
          <div style={{ fontSize: '13px', color: 'var(--warning)' }}>
            Stalled at {formatTransfer(updateTransferred, updateTotal, updateProgress)} — check your connection.
          </div>
          <button onClick={() => void downloadUpdate()} style={outlineBtn}>
            Retry download
          </button>
        </div>
      )}
      {updateStatus === 'downloaded' && (
        <button onClick={() => void restartToUpdate()} style={primaryBtn}>
          Restart to install
        </button>
      )}
      {updateStatus === 'error' && updateError && (
        <div style={{ fontSize: '13px', color: 'var(--error)', marginTop: '8px' }}>{updateError}</div>
      )}
    </div>
  );
}

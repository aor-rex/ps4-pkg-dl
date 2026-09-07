import { Download, ChevronUp, ChevronDown, X, Pause, Play, Trash2, FolderOpen } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { tryLive } from '../../lib/backend';
import type { Download as DownloadType } from '../../types';

export default function BottomDownloadBar() {
  const {
    downloads, downloadManagerOpen, setDownloadManagerOpen, downloadFilter,
    setDownloadFilter, pauseDl, resumeDl, cancelDl, removeDl,
  } = useAppStore();
  const activeDownloads = downloads.filter((d) => d.status === 'active');
  const primaryDownload = activeDownloads[0];
  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'queued', label: 'Queued' },
    { key: 'completed', label: 'Completed' },
    { key: 'failed', label: 'Failed' },
  ];
  const filteredDownloads = downloads.filter((dl) => {
    if (downloadFilter === 'all') return true;
    return dl.status === downloadFilter;
  });

  const getStatusColor = (status: DownloadType['status']) => {
    switch (status) {
      case 'active': return 'var(--accent)';
      case 'queued': return 'var(--warning)';
      case 'completed': return 'var(--success)';
      case 'failed': return 'var(--error)';
      case 'extracting': return 'var(--accent)';
      case 'paused': return 'var(--text-muted)';
      default: return 'var(--text-muted)';
    }
  };

  // UI Spec 9.1: Collapsed bar - 48px, #171d25, 1px border-top
  return (
    <>
      {/* Collapsed Bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center px-4 cursor-pointer transition-transform"
        style={{
          height: '48px',
          backgroundColor: 'var(--bg-download-bar)',
          borderTop: '1px solid var(--border)',
          transform: downloadManagerOpen ? 'translateY(-320px)' : 'translateY(0)',
        }}
        onClick={() => setDownloadManagerOpen(true)}
      >
        <Download style={{ width: '18px', height: '18px', color: 'var(--accent)', marginRight: '8px' }} />
        <span className="text-sm font-medium mr-2" style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 500 }}>Downloads</span>

        {primaryDownload && (
          <>
            <div className="flex items-center ml-4 flex-1">
              <div className="rounded overflow-hidden mr-2" style={{ width: '120px', height: '4px', backgroundColor: 'var(--bg-tertiary)' }}>
                <div className="h-full progress-fill" style={{ width: `${primaryDownload.progress}%`, backgroundColor: 'var(--accent)' }} />
              </div>
              <span className="text-xs mr-2" style={{ color: 'var(--text-muted)' }}>{primaryDownload.progress}%</span>
              <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{primaryDownload.gameTitle}</span>
            </div>
            <div className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
              {primaryDownload.speed} | ETA: {primaryDownload.eta}
            </div>
          </>
        )}

        <button
          className="ml-4 p-1 rounded transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onClick={(e) => { e.stopPropagation(); setDownloadManagerOpen(!downloadManagerOpen); }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          title={downloadManagerOpen ? 'Close downloads' : 'Open downloads'}
        >
          {downloadManagerOpen
            ? <ChevronDown style={{ width: '16px', height: '16px' }} />
            : <ChevronUp style={{ width: '16px', height: '16px' }} />}
        </button>
      </div>

      {/* Expanded Panel - UI Spec 9.2: 320px, slide-up 0.3s */}
      {downloadManagerOpen && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 flex flex-col slide-up"
          style={{
            height: '320px',
            backgroundColor: 'var(--bg-download-bar)',
            borderTop: '1px solid var(--border)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4" style={{ padding: '12px 16px', borderBottom: `1px solid var(--border)` }}>
            <span className="text-base font-semibold" style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 600 }}>
              Downloads ({activeDownloads.length} Active)
            </span>
            <button
              onClick={() => setDownloadManagerOpen(false)}
              className="p-1 rounded transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <ChevronDown style={{ width: '16px', height: '16px' }} />
            </button>
          </div>

          {/* Tabs - UI Spec 9.2 */}
          <div className="flex gap-0 px-4" style={{ borderBottom: `1px solid var(--border)` }}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setDownloadFilter(tab.key)}
                className="px-4 tab-active"
                style={{
                  height: '36px',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: downloadFilter === tab.key ? 'var(--accent)' : 'var(--text-muted)',
                  borderBottom: downloadFilter === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
                }}
                onMouseEnter={(e) => { if (downloadFilter !== tab.key) e.currentTarget.style.color = 'var(--text-secondary)'; }}
                onMouseLeave={(e) => { if (downloadFilter !== tab.key) e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Download List */}
          <div className="flex-1 overflow-y-auto">
            {filteredDownloads.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--text-muted)', padding: '40px 0' }}>
                No downloads in this category
              </div>
            ) : (
              filteredDownloads.map((dl) => (
                <div key={dl.id} className="px-4" style={{ padding: '16px', borderBottom: `1px solid var(--border)` }}>
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600 }}>{dl.gameTitle}</div>
                      <div className="text-xs mt-1" style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Source: {dl.source}</div>
                    </div>
                    <div className="text-sm font-semibold" style={{ color: getStatusColor(dl.status), fontSize: '13px', fontWeight: 600 }}>
                      {dl.status === 'completed' ? '✓ Done' : dl.status === 'extracting' ? `Extracting ${dl.extractProgress ?? dl.progress}%` : `${dl.progress}%`}
                    </div>
                  </div>

                  {/* Progress Bar - UI Spec: 8px height, bg #2a475e, fill #66c0f4 */}
                  <div className="mt-2 rounded overflow-hidden" style={{ height: '8px', backgroundColor: 'var(--bg-tertiary)' }}>
                    <div
                      className="h-full rounded progress-fill"
                      style={{
                        width: `${dl.status === 'extracting' ? (dl.extractProgress ?? dl.progress) : dl.progress}%`,
                        backgroundColor: dl.status === 'completed' ? 'var(--success)' : dl.status === 'failed' ? 'var(--error)' : dl.status === 'extracting' ? 'var(--warning)' : 'var(--accent)',
                      }}
                    />
                  </div>

                  {/* Speed & ETA */}
                  {dl.status === 'active' && (
                    <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                      {dl.speed} | ETA: {dl.eta}
                    </div>
                  )}
                  {dl.status === 'extracting' && (
                    <div className="mt-1 text-xs" style={{ color: 'var(--warning)', fontSize: '12px' }}>Extracting archive...</div>
                  )}
                  {dl.status === 'completed' && (
                    <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Extracted to folder</div>
                  )}

                  {/* Action Buttons */}
                  <div className="mt-2 flex gap-2 justify-end">
                    {dl.status === 'active' && (
                      <>
                        <button
                          onClick={() => pauseDl(dl.id)}
                          className="flex items-center gap-1 px-3 rounded transition-colors"
                          style={{ fontSize: '12px', padding: '4px 12px', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: '4px' }}
                          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                        >
                          <Pause style={{ width: '12px', height: '12px' }} /> Pause
                        </button>
                        <button
                          onClick={() => cancelDl(dl.id)}
                          className="flex items-center gap-1 px-3 rounded transition-colors"
                          style={{ fontSize: '12px', padding: '4px 12px', border: '1px solid var(--error)', color: 'var(--error)', borderRadius: '4px' }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(244,67,54,0.1)')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <X style={{ width: '12px', height: '12px' }} /> Cancel
                        </button>
                      </>
                    )}
                    {dl.status === 'paused' && (
                      <button
                        onClick={() => resumeDl(dl.id)}
                        className="flex items-center gap-1 px-3 rounded transition-colors"
                        style={{ fontSize: '12px', padding: '4px 12px', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: '4px' }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                      >
                        <Play style={{ width: '12px', height: '12px' }} /> Resume
                      </button>
                    )}
                    {dl.status === 'failed' && (
                      <>
                        <button
                          onClick={() => { const { retryDl } = useAppStore.getState(); retryDl(dl.id); }}
                          className="flex items-center gap-1 px-3 rounded transition-colors"
                          style={{ fontSize: '12px', padding: '4px 12px', border: '1px solid var(--warning)', color: 'var(--warning)', borderRadius: '4px' }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(234,179,8,0.1)')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          Retry
                        </button>
                        <button
                          onClick={() => removeDl(dl.id)}
                          className="flex items-center gap-1 px-3 rounded transition-colors"
                          style={{ fontSize: '12px', padding: '4px 12px', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: '4px' }}
                        >
                          <Trash2 style={{ width: '12px', height: '12px' }} /> Remove
                        </button>
                      </>
                    )}
                    {dl.status === 'completed' && (
                      <>
                        <button onClick={() => void tryLive((api) => api.openFolder(dl.path ?? undefined))}
                          className="flex items-center gap-1 px-3 rounded transition-colors"
                          style={{ fontSize: '12px', padding: '4px 12px', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: '4px' }}
                          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                        >
                          <FolderOpen style={{ width: '12px', height: '12px' }} /> Open Folder
                        </button>
                        <button onClick={() => removeDl(dl.id)}
                          className="flex items-center gap-1 px-3 rounded transition-colors"
                          style={{ fontSize: '12px', padding: '4px 12px', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: '4px' }}
                          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                        >
                          <Trash2 style={{ width: '12px', height: '12px' }} /> Remove
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}

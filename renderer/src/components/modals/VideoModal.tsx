import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { useAppStore } from '../../store/appStore';

export default function VideoModal() {
  const { videoModalOpen, setVideoModalOpen, selectedVideo } = useAppStore();

  if (!videoModalOpen || !selectedVideo) return null;

  // YouTube embed vs direct video file (RAWG trailers are mp4).
  // Only http(s) URLs are ever rendered — anything else is rejected outright.
  const rawUrl = String(selectedVideo.url || '');
  const safeUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : '';
  const isDirectVideo = /\.(mp4|webm|ogv)(\?|#|$)/i.test(safeUrl);
  const videoId = (() => {
    if (!safeUrl || isDirectVideo) return '';
    try {
      const u = new URL(safeUrl);
      const host = u.hostname.replace(/^www\./, '');
      if (host === 'youtu.be') {
        const id = u.pathname.split('/').filter(Boolean)[0] || '';
        return /^[\w-]{6,}$/.test(id) ? id : '';
      }
      if (host === 'youtube.com' || host === 'm.youtube.com') {
        if (u.pathname === '/watch') return u.searchParams.get('v') || '';
        const m = u.pathname.match(/^\/(embed|shorts|v)\/([\w-]{6,})/);
        if (m) return m[2];
      }
    } catch (_) {}
    return '';
  })();

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center modal-enter"
      style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
      onClick={() => setVideoModalOpen(false)}
    >
      <div
        style={{ width: '960px', maxWidth: '90vw' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={() => setVideoModalOpen(false)}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            padding: '0',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            color: '#fff',
            transition: 'opacity 0.2s ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.opacity = '0.7';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.opacity = '1';
          }}
        >
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} size={24} />
        </button>

        {/* Video Player */}
        <div
          style={{
            width: '100%',
            maxWidth: '960px',
            aspectRatio: '16 / 9',
            maxHeight: '540px',
            borderRadius: '8px',
            overflow: 'hidden',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          {isDirectVideo ? (
            <video
              src={safeUrl}
              controls
              autoPlay
              style={{ width: '100%', height: '100%', backgroundColor: '#000' }}
            />
          ) : videoId ? (
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
              title={selectedVideo.title}
              style={{ width: '100%', height: '100%', border: 'none' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                color: 'var(--text-muted)',
                fontSize: '14px',
              }}
            >
              <span>No playable preview for this trailer.</span>
              {safeUrl ? (
                <a
                  href={safeUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--accent)', fontSize: '13px' }}
                >
                  Open externally
                </a>
              ) : null}
            </div>
          )}
        </div>

        {/* Title */}
        <h3
          style={{
            fontSize: '16px',
            fontWeight: 500,
            color: 'var(--text-primary)',
            textAlign: 'center',
            marginTop: '12px',
          }}
        >
          {selectedVideo.title}
        </h3>
      </div>
    </div>
  );
}

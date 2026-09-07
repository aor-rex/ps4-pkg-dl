import { X } from 'lucide-react';
import { useAppStore } from '../../store/appStore';

export default function VideoModal() {
  const { videoModalOpen, setVideoModalOpen, selectedVideo } = useAppStore();

  if (!videoModalOpen || !selectedVideo) return null;

  // YouTube embed vs direct video file (RAWG trailers are mp4)
  const isDirectVideo = /\.(mp4|webm|ogv)(\?|#|$)/i.test(selectedVideo.url);
  const videoId =
    !isDirectVideo && selectedVideo.url.includes('v=')
      ? selectedVideo.url.split('v=')[1]?.split('&')[0]
      : '';

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
          <X size={24} />
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
              src={selectedVideo.url}
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
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                fontSize: '14px',
              }}
            >
              Video player placeholder
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

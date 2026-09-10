import { useEffect, useCallback } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { useAppStore } from '../../store/appStore';

export default function Lightbox() {
  const {
    lightboxOpen,
    setLightboxOpen,
    lightboxImages,
    lightboxIndex,
    setLightboxIndex,
  } = useAppStore();

  const nextImage = useCallback(() => {
    if (!lightboxImages.length) return;
    setLightboxIndex((lightboxIndex + 1) % lightboxImages.length);
  }, [lightboxIndex, lightboxImages.length, setLightboxIndex]);

  const prevImage = useCallback(() => {
    if (!lightboxImages.length) return;
    setLightboxIndex((lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length);
  }, [lightboxIndex, lightboxImages.length, setLightboxIndex]);

  // Keyboard handlers
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
      if (e.key === 'ArrowRight') nextImage();
      if (e.key === 'ArrowLeft') prevImage();
    },
    [setLightboxOpen, nextImage, prevImage],
  );

  useEffect(() => {
    if (lightboxOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [lightboxOpen, handleKeyDown]);

  if (!lightboxOpen || !lightboxImages.length) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex flex-col modal-enter"
      style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
      onClick={() => setLightboxOpen(false)}
    >
      {/* Close Button */}
      <button
        onClick={() => setLightboxOpen(false)}
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

      {/* Main Image Area */}
      <div
        className="flex-1 flex items-center justify-center"
        style={{ padding: '64px 80px 0' }}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={lightboxImages[lightboxIndex]}
          alt={`Screenshot ${lightboxIndex + 1}`}
          style={{
            maxWidth: '90vw',
            maxHeight: '80vh',
            objectFit: 'contain',
          }}
        />
      </div>

      {/* Navigation + Counter */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          padding: '16px 0',
        }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); prevImage(); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'none',
            border: 'none',
            color: '#fff',
            fontSize: '14px',
            padding: '8px 16px',
            cursor: 'pointer',
            transition: 'color 0.2s ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = '#fff';
          }}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} size={16} />
          Previous
        </button>
        <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
          {lightboxIndex + 1} / {lightboxImages.length}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); nextImage(); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'none',
            border: 'none',
            color: '#fff',
            fontSize: '14px',
            padding: '8px 16px',
            cursor: 'pointer',
            transition: 'color 0.2s ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = '#fff';
          }}
        >
          Next
          <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} size={16} />
        </button>
      </div>

      {/* Thumbnail Strip */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          justifyContent: 'center',
          paddingBottom: '16px',
          paddingLeft: '32px',
          paddingRight: '32px',
          overflowX: 'auto',
        }}
      >
        {lightboxImages.map((img, idx) => (
          <button
            key={idx}
            onClick={(e) => { e.stopPropagation(); setLightboxIndex(idx); }}
            style={{
              flexShrink: 0,
              width: '60px',
              height: '40px',
              borderRadius: '2px',
              overflow: 'hidden',
              border: idx === lightboxIndex ? '2px solid var(--accent)' : '2px solid transparent',
              opacity: idx === lightboxIndex ? 1 : 0.6,
              cursor: 'pointer',
              transition: 'opacity 0.2s ease, border-color 0.2s ease',
              padding: 0,
            }}
            onMouseEnter={(e) => {
              if (idx !== lightboxIndex) {
                (e.currentTarget as HTMLButtonElement).style.opacity = '1';
              }
            }}
            onMouseLeave={(e) => {
              if (idx !== lightboxIndex) {
                (e.currentTarget as HTMLButtonElement).style.opacity = '0.6';
              }
            }}
          >
            <img
              src={img}
              alt={`Thumb ${idx + 1}`}
              loading="lazy"
              decoding="async"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

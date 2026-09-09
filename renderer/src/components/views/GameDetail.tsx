import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, Download02Icon, PlayIcon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { useAppStore } from '../../store/appStore';
import Spinner from '../common/Spinner';
import { COVER_FALLBACK } from '../../lib/catalog';

export default function GameDetail() {
  const {
    selectedGame,
    setSelectedGame,
    setCurrentView,
    setMirrorModalOpen,
    setSelectedMirrors,
    setLightboxOpen,
    setLightboxImages,
    setLightboxIndex,
    setVideoModalOpen,
    setSelectedVideo,
    detailLoading,
  } = useAppStore();

  const [descExpanded, setDescExpanded] = useState(false);

  if (!selectedGame) {
    return null;
  }

  const handleBackClick = () => {
    setCurrentView('home');
    setSelectedGame(null);
  };

  const handleDownload = (mirrors: any[]) => {
    setSelectedMirrors(mirrors);
    setMirrorModalOpen(true);
  };

  const openLightbox = (images: string[], index: number) => {
    setLightboxImages(images);
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const openVideo = (url: string, title: string) => {
    setSelectedVideo({ url, title });
    setVideoModalOpen(true);
  };

  const hasMultipleParts = selectedGame.downloads.length > 1;

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Loading indicator when live detail fetch in progress */}
        {detailLoading && (
          <div className="flex items-center gap-2 mb-4" style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            <Spinner size={14} /> Loading full details...
          </div>
        )}
        {/* 7.1 Back Button */}
        <button
          onClick={handleBackClick}
          className="flex items-center gap-2 mb-4 transition-opacity hover:opacity-80"
          style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="w-4 h-4" />
          <span style={{ fontSize: '14px', textDecoration: 'none' }}>Back to Browse</span>
        </button>

        {/* 7.2 Hero Section */}
        <section className="flex flex-col md:flex-row gap-8 mb-8">
          {/* Cover Image */}
          <div
            className="shrink-0"
            style={{ width: '300px', height: '420px', borderRadius: '6px', overflow: 'hidden', marginRight: '24px', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.45)' }}
          >
            <img
              src={selectedGame.cover || COVER_FALLBACK}
              alt={selectedGame.title}
              width={300}
              height={420}
              loading="eager"
              referrerPolicy="no-referrer"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = COVER_FALLBACK; }}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Info Block */}
          <div className="flex-1">
            {/* Title */}
            <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
              {selectedGame.title}
            </h1>

            {/* Tags row */}
            <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              PS4
              {selectedGame.genres.length > 0 && (
                <>
                  <span style={{ margin: '0 8px' }}>|</span>
                  {selectedGame.genres.join(', ')}
                </>
              )}
              <span style={{ margin: '0 8px' }}>|</span>
              Region: {selectedGame.region}
            </div>

            {/* Size/Version */}
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Size: {selectedGame.size}
              <span style={{ margin: '0 8px' }}>|</span>
              Version: {selectedGame.version}
            </div>

            {/* Date */}
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Added: {selectedGame.date}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => handleDownload(selectedGame.downloads[0]?.mirrors || [])}
                className="flex items-center gap-2 transition-colors"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--text-on-accent)',
                  fontSize: '14px',
                  fontWeight: 600,
                  padding: '10px 24px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent)')}
              >
                <HugeiconsIcon icon={Download02Icon} strokeWidth={2} className="w-4 h-4" />
                Download
              </button>
              {hasMultipleParts && (
                <button
                  onClick={() => {
                    const allMirrors = selectedGame.downloads.flatMap((d: any) => d.mirrors);
                    handleDownload(allMirrors);
                  }}
                  className="flex items-center gap-2 transition-colors"
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid var(--accent)',
                    color: 'var(--accent)',
                    fontSize: '14px',
                    fontWeight: 600,
                    padding: '10px 24px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(102,192,244,0.1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <HugeiconsIcon icon={Download02Icon} strokeWidth={2} className="w-4 h-4" />
                  Download All Parts
                </button>
              )}
            </div>
          </div>
        </section>

        {/* 7.3 Screenshot Gallery */}
        {selectedGame.gallery && selectedGame.gallery.length > 0 && (
          <section className="mb-8">
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
              Screenshots
            </h2>
            <div className="flex items-center gap-4">
              <button
                className="shrink-0 transition-colors"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                onClick={() => {
                  const container = document.getElementById('screenshot-scroll');
                  if (container) container.scrollLeft -= 200;
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--accent)')}
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="w-6 h-6" style={{ color: 'var(--accent)' }} />
              </button>
              <div
                id="screenshot-scroll"
                className="flex gap-3 overflow-x-auto"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {selectedGame.gallery.map((img: string, index: number) => (
                  <div
                    key={index}
                    className="shrink-0 cursor-pointer transition-opacity"
                    style={{ width: '180px', height: '100px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)' }}
                    onClick={() => openLightbox(selectedGame.gallery, index)}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                  >
                    <img
                      src={img || COVER_FALLBACK}
                      alt={`Screenshot ${index + 1}`}
                      width={180}
                      height={100}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = COVER_FALLBACK; }}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
              <button
                className="shrink-0 transition-colors"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                onClick={() => {
                  const container = document.getElementById('screenshot-scroll');
                  if (container) container.scrollLeft += 200;
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--accent)')}
              >
                <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="w-6 h-6" style={{ color: 'var(--accent)' }} />
              </button>
            </div>
          </section>
        )}

        {/* 7.4 Description Section */}
        {selectedGame.description && (
          <section className="mb-8">
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
              Description
            </h2>
            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                padding: '20px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
              }}
            >
              <p
                style={{
                  fontSize: '14px',
                  fontWeight: 400,
                  color: 'var(--text-secondary)',
                  lineHeight: '1.7',
                  ...(descExpanded
                    ? {}
                    : {
                        display: '-webkit-box',
                        WebkitLineClamp: 6,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }),
                }}
              >
                {selectedGame.description}
              </p>
              {selectedGame.description.length > 300 && (
                <button
                  onClick={() => setDescExpanded(!descExpanded)}
                  style={{
                    fontSize: '14px',
                    color: 'var(--accent)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    marginTop: '8px',
                    padding: 0,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                  onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                >
                  {descExpanded ? 'Read Less' : 'Read More'}
                </button>
              )}
            </div>
          </section>
        )}

        {/* 7.5 Videos Section */}
        {selectedGame.videos && selectedGame.videos.length > 0 && (
          <section className="mb-8">
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
              Videos{selectedGame.videos.length > 1 ? ` (${selectedGame.videos.length})` : ''}
            </h2>
            <div className="space-y-6">
              {selectedGame.videos.map((video: any, index: number) => (
                <div key={index}>
                  <div
                    className="relative cursor-pointer"
                    style={{ width: '640px', maxWidth: '100%', aspectRatio: '16/9', borderRadius: '6px', overflow: 'hidden' }}
                    onClick={() => openVideo(video.url, video.title)}
                  >
                    <img
                      src={video.thumbnail || selectedGame.cover || COVER_FALLBACK}
                      alt={video.title}
                      width={640}
                      height={360}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = COVER_FALLBACK; }}
                      className="w-full h-full object-cover"
                    />
                    {/* Play button overlay */}
                    <div
                      className="absolute inset-0 flex items-center justify-center transition-transform"
                      style={{ backgroundColor: 'transparent' }}
                      onMouseEnter={(e) => {
                        const btn = e.currentTarget.querySelector('.play-btn');
                        if (btn) (btn as HTMLElement).style.transform = 'scale(1.125)';
                      }}
                      onMouseLeave={(e) => {
                        const btn = e.currentTarget.querySelector('.play-btn');
                        if (btn) (btn as HTMLElement).style.transform = 'scale(1)';
                      }}
                    >
                      <div
                        className="play-btn flex items-center justify-center transition-transform"
                        style={{
                          width: '64px',
                          height: '64px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(0,0,0,0.7)',
                        }}
                      >
                        <HugeiconsIcon icon={PlayIcon} strokeWidth={2} className="w-6 h-6 fill-current" style={{ color: 'var(--accent)', marginLeft: '3px' }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {video.title}
                    </span>
                    {video.duration && (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{video.duration}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Download Options Section */}
        {selectedGame.downloads && selectedGame.downloads.length > 0 && (
          <section className="mb-8">
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
              Download Options
            </h2>
            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                padding: '20px',
              }}
            >
              <div className="space-y-6">
                {selectedGame.downloads.map((downloadGroup: any, groupIndex: number) => (
                  <div key={groupIndex}>
                    {selectedGame.downloads.length > 1 && (
                      <h3
                        style={{
                          fontSize: '15px',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          marginBottom: '12px',
                        }}
                      >
                        {downloadGroup.type}
                      </h3>
                    )}
                    <div className="space-y-3">
                      {downloadGroup.mirrors.map((mirror: any, mirrorIndex: number) => (
                        <div
                          key={mirrorIndex}
                          className="flex items-center justify-between"
                          style={{
                            padding: '12px 16px',
                            backgroundColor: 'var(--bg-tertiary)',
                            borderRadius: '4px',
                            border: '1px solid var(--border)',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                        >
                          <div>
                            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {mirror.host}
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {mirror.reliability} reliability &middot; {mirror.speed} speed
                            </div>
                          </div>
                          <button
                            onClick={() => handleDownload([mirror])}
                            className="flex items-center gap-2 transition-colors"
                            style={{
                              backgroundColor: 'var(--accent)',
                              color: 'var(--text-on-accent)',
                              fontSize: '13px',
                              fontWeight: 600,
                              padding: '8px 20px',
                              borderRadius: '4px',
                              border: 'none',
                              cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-hover)')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent)')}
                          >
                            <HugeiconsIcon icon={Download02Icon} strokeWidth={2} className="w-4 h-4" />
                            Download
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
        {/* Attribution */}
        {selectedGame.hasMetadata && (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '24px', textAlign: 'center' }}>
            Metadata, artwork &amp; trailers by <a href="https://rawg.io" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>RAWG</a>
          </div>
        )}
      </div>
    </div>
  );
}

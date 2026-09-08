import { Download } from 'lucide-react';
import type { Game } from '../../types';
import { useAppStore } from '../../store/appStore';
import { COVER_FALLBACK } from '../../lib/catalog';

interface GameCardProps { game: Game; onClick: () => void; compact?: boolean; }

const SIZES = {
  small: { w: 160, h: 224 },
  medium: { w: 220, h: 310 },
  large: { w: 280, h: 392 },
} as const;

export default function GameCard({ game, onClick, compact = false }: GameCardProps) {
  const { settings } = useAppStore();
  const size = SIZES[settings.cardSize] || SIZES.medium;
  const w = compact ? SIZES.small.w : size.w;
  const h = compact ? SIZES.small.h : size.h;
  const showSize = settings.showSizeOnCards;
  const fallback = COVER_FALLBACK;
  return (
    <button
      onClick={onClick}
      className="card-hover text-left"
      style={{
        width: `${w}px`,
        backgroundColor: 'var(--bg-tertiary)',
        borderRadius: '6px',
        overflow: 'hidden',
      }}
    >
      {/* Cover Image - 7:10 ratio */}
      <div className="relative overflow-hidden" style={{ width: `${w}px`, height: `${h}px`, backgroundColor: 'var(--bg-primary)' }}>
        <img
          src={game.cover || fallback}
          alt={game.title}
          width={w}
          height={h}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = fallback; }}
          className="w-full h-full object-cover"
        />
        {/* Hover Overlay */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', opacity: 0, transition: 'opacity 0.2s ease' }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
        >
          <div
            className="flex items-center gap-2 font-bold"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--text-on-accent)', padding: '8px 20px', borderRadius: '4px', fontSize: '13px', fontWeight: 700 }}
          >
            <Download style={{ width: '14px', height: '14px' }} /> Download
          </div>
        </div>
      </div>

      {/* Info Section */}
      <div style={{ padding: compact ? '8px' : '12px' }}>
        <h3
          className="line-clamp-2"
          style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: '1.3', marginBottom: '4px' }}
        >
          {game.title}
        </h3>
        {showSize && (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            PS4 <span style={{ margin: '0 4px' }}>|</span> {game.size}
            {game.metacritic != null && (
              <>
                <span style={{ margin: '0 4px' }}>|</span>
                <span
                  style={{
                    fontWeight: 700,
                    color:
                      game.metacritic >= 75 ? 'var(--success)' : game.metacritic >= 50 ? 'var(--warning)' : 'var(--error)',
                  }}
                >
                  {game.metacritic}
                </span>
              </>
            )}
          </div>
        )}
        {!compact && (
          <div className="flex flex-wrap gap-1 mt-1">
            {game.region && (
              <span
                className="inline-block"
                style={{ fontSize: '10px', padding: '2px 6px', backgroundColor: 'rgba(102,192,244,0.15)', color: 'var(--accent)', borderRadius: '3px' }}
              >
                {game.region}
              </span>
            )}
            {game.genres && game.genres[0] && (
              <span
                className="inline-block"
                style={{ fontSize: '10px', padding: '2px 6px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)', borderRadius: '3px' }}
              >
                {game.genres[0]}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

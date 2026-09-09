import { HugeiconsIcon } from '@hugeicons/react';
import { Download02Icon, InformationCircleIcon } from '@hugeicons/core-free-icons';
import type { Game } from '../../types';
import { useAppStore } from '../../store/appStore';
import { COVER_FALLBACK } from '../../lib/catalog';

interface GameCardListProps { game: Game; onClick: () => void; }

export default function GameCardList({ game, onClick }: GameCardListProps) {
  const { settings } = useAppStore();
  const compact = settings.compactMode;
  const fallback = COVER_FALLBACK;
  return (
    <div
      onClick={onClick}
      className="flex items-center w-full transition-colors cursor-pointer"
      style={{ height: compact ? '56px' : '80px', padding: compact ? '0 12px' : '0 16px', backgroundColor: 'transparent' }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(102,192,244,0.05)')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      <img
        src={game.cover || fallback}
        alt={game.title}
        width={compact ? 40 : 60}
        height={compact ? 56 : 80}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={(e) => { (e.currentTarget as HTMLImageElement).src = fallback; }}
        style={{ width: compact ? '40px' : '60px', height: compact ? '56px' : '80px', objectFit: 'cover', borderRadius: '4px' }}
      />
      <div className="flex-1 ml-4 min-w-0">
        <div style={{ fontSize: compact ? '14px' : '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{game.title}</div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
          PS4{!compact && game.genres[0] && ` | ${game.genres.join(', ')}`}{settings.showSizeOnCards && ` | ${game.size}`}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={(e) => e.stopPropagation()}
          className="font-semibold rounded transition-colors flex items-center gap-2"
          style={{ fontSize: '13px', padding: '8px 16px', backgroundColor: 'var(--accent)', color: 'var(--text-on-accent)', borderRadius: '4px', fontWeight: 600 }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent)')}
        >
          <HugeiconsIcon icon={Download02Icon} strokeWidth={2} style={{ width: '14px', height: '14px' }} /> Download
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          className="rounded transition-colors flex items-center gap-2"
          style={{ fontSize: '13px', padding: '8px 12px', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: '4px' }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
        >
          <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} style={{ width: '14px', height: '14px' }} /> Info
        </button>
      </div>
    </div>
  );
}

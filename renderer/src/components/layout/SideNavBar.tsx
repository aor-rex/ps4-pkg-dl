import { HugeiconsIcon } from '@hugeicons/react';
import {
  Home01Icon, AnalyticsUpIcon, Clock01Icon, Folder01Icon,
  Sword01Icon, Sword02Icon, AdventureIcon, Shield01Icon, Target01Icon, ZapIcon,
  PuzzleIcon, Car01Icon, TrophyIcon, GhostIcon, StrategyIcon, Rocket01Icon,
  Rocket02Icon, DiceFaces01Icon, DiceFaces02Icon, Cards01Icon, GameboyIcon,
  BalloonIcon, Music01Icon, InformationCircleIcon,
} from '@hugeicons/core-free-icons';
import { useRef } from 'react';
import { useAppStore } from '../../store/appStore';

function genreIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes('action')) return Sword01Icon;
  if (n.includes('adventure')) return AdventureIcon;
  if (n.includes('rpg') || n.includes('role-playing') || n.includes('role playing')) return Shield01Icon;
  if (n.includes('shooter')) return Target01Icon;
  if (n.includes('fight')) return ZapIcon;
  if (n.includes('puzzle')) return PuzzleIcon;
  if (n.includes('rac') || n.includes('driv') || n.includes('car')) return Car01Icon;
  if (n.includes('sport')) return TrophyIcon;
  if (n.includes('horror')) return GhostIcon;
  if (n.includes('strateg')) return StrategyIcon;
  if (n.includes('simul')) return Rocket01Icon;
  if (n.includes('platform')) return Rocket02Icon;
  if (n.includes('board')) return DiceFaces02Icon;
  if (n.includes('card')) return Cards01Icon;
  if (n.includes('casual')) return DiceFaces01Icon;
  if (n.includes('arcade')) return GameboyIcon;
  if (n.includes('family')) return BalloonIcon;
  if (n.includes('music')) return Music01Icon;
  if (n.includes('educ')) return InformationCircleIcon;
  if (n.includes('indie')) return Sword02Icon;
  return Folder01Icon;
}

export default function SideNavBar({ width, collapsed, onWidthChange }: { width: number; collapsed: boolean; onWidthChange: (w: number) => void }) {
  const { currentView, setCurrentView, selectedGenre, setSelectedGenre, setSettingsOpen, availableGenres, liveMode } = useAppStore();

  const navItems = [
    { icon: Home01Icon, label: 'Home', view: 'home' },
    { icon: AnalyticsUpIcon, label: 'Library', view: 'library' },
    { icon: Clock01Icon, label: 'New', view: 'new' },
    { icon: Folder01Icon, label: 'All Games', view: 'all' },
  ];

  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startW: width };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      onWidthChange(dragRef.current.startW + (ev.clientX - dragRef.current.startX));
    };
    const onUp = (ev: MouseEvent) => {
      if (dragRef.current) {
        const w = dragRef.current.startW + (ev.clientX - dragRef.current.startX);
        // Snap to the 64px icon rail below the threshold
        onWidthChange(w < 120 ? 64 : w);
      }
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleNavClick = (view: string) => {
    setSettingsOpen(false);
    setCurrentView(view);
  };

  return (
    <aside
      className="fixed left-0 flex flex-col overflow-y-auto overflow-x-hidden z-40"
      style={{
        top: '56px',
        width: `${width}px`,
        height: 'calc(100vh - 56px - 48px)',
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border)',
        paddingTop: '16px',
        paddingBottom: '16px',
      }}
    >
      {/* Drag-to-resize handle (double-click toggles rail) */}
      <div
        onMouseDown={handleDragStart}
        onDoubleClick={() => onWidthChange(collapsed ? 240 : 64)}
        title="Drag to resize — double-click to collapse / expand"
        style={{
          position: 'absolute',
          top: 0,
          right: '-4px',
          width: '9px',
          height: '100%',
          cursor: 'ew-resize',
          zIndex: 50,
        }}
      />
      {/* Navigation Items - UI Spec 4.1.1 */}
      <nav className="px-0 mb-3">
        {navItems.map((item) => {
          const isActive = currentView === item.view;
          return (
            <button
              key={item.view}
              onClick={() => handleNavClick(item.view)}
              title={item.label}
              className="w-full flex items-center transition-all"
              style={{
                height: '40px',
                padding: collapsed ? '0' : '0 16px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                backgroundColor: isActive ? 'rgba(102,192,244,0.15)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'rgba(102,192,244,0.08)';
                  e.currentTarget.style.color = 'var(--accent)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
            >
              <HugeiconsIcon icon={item.icon} strokeWidth={2} style={{ width: '18px', height: '18px', marginRight: collapsed ? '0' : '12px' }} />
              {!collapsed && <span className="text-sm" style={{ fontWeight: 500 }}>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Divider - UI Spec 4.1.2 */}
      <div style={{ height: '1px', backgroundColor: 'var(--border)', margin: '12px 16px' }} />

      {/* Genre Categories - from enriched metadata (API) */}
      <div className="px-0 mb-3">
        {!collapsed && <div className="text-xs uppercase px-4 pb-2" style={{ color: 'var(--text-muted)', letterSpacing: '1px', fontSize: '11px' }}>Genres</div>}
        {liveMode && availableGenres.length > 0 ? (
        <div>
          {availableGenres.map((g) => ({ name: g.name, count: g.count })).map((genre) => (
            <button
              key={genre.name}
              title={genre.name}
              onClick={() => {
                setSettingsOpen(false);
                setSelectedGenre(selectedGenre === genre.name ? null : genre.name);
                setCurrentView('home');
              }}
              className="w-full text-left transition-colors"
              style={{
                height: '32px',
                padding: collapsed ? '0' : '0 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                color: selectedGenre === genre.name ? 'var(--accent)' : 'var(--text-secondary)',
                fontWeight: selectedGenre === genre.name ? 600 : 400,
                fontSize: '14px',
              }}
              onMouseEnter={(e) => {
                if (selectedGenre !== genre.name) {
                  e.currentTarget.style.color = 'var(--accent)';
                  e.currentTarget.style.backgroundColor = 'rgba(102,192,244,0.08)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedGenre !== genre.name) {
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              {collapsed ? (
                <HugeiconsIcon icon={genreIcon(genre.name)} strokeWidth={2} style={{ width: '18px', height: '18px' }} />
              ) : (
                <>
                  <HugeiconsIcon icon={genreIcon(genre.name)} strokeWidth={2} style={{ width: '16px', height: '16px', marginRight: '10px', flexShrink: 0 }} />
                  {genre.name}
                  {genre.count != null && (
                    <span style={{ marginLeft: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>{genre.count}</span>
                  )}
                </>
              )}
            </button>
          ))}
        </div>
        ) : (
          <div style={{ padding: '0 16px', fontSize: '12px', color: 'var(--text-muted)' }}>
            Genres appear after enrichment.
          </div>
        )}
      </div>

    </aside>
  );
}

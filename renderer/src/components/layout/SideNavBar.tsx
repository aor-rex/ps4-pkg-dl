import { HugeiconsIcon } from '@hugeicons/react';
import {
  Home01Icon, AnalyticsUpIcon, Clock01Icon, Folder01Icon,
} from '@hugeicons/core-free-icons';
import { useRef } from 'react';
import { useAppStore } from '../../store/appStore';
import { genreIcon } from '../../lib/genres';

export default function SideNavBar({ width, collapsed, onWidthChange }: { width: number; collapsed: boolean; onWidthChange: (w: number) => void }) {
  const { currentView, setCurrentView, selectedGenre, setSelectedGenre, setSettingsOpen, availableGenres, liveMode } = useAppStore();

  const navItems = [
    { icon: Home01Icon, label: 'Home', view: 'home' },
    { icon: AnalyticsUpIcon, label: 'Library', view: 'library' },
    { icon: Clock01Icon, label: 'New', view: 'new' },
    { icon: Folder01Icon, label: 'All Games', view: 'all' },
  ];

  const dragRef = useRef<{ startX: number; startW: number; raf: number } | null>(null);

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startW: width, raf: 0 };
    const onMove = (ev: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      // One React state commit per frame — mousemove fires far faster
      // than 60fps and each commit reflows the whole content area.
      if (drag.raf) return;
      const target = drag.startW + (ev.clientX - drag.startX);
      drag.raf = requestAnimationFrame(() => {
        if (dragRef.current) dragRef.current.raf = 0;
        onWidthChange(target);
      });
    };
    const onUp = (ev: MouseEvent) => {
      if (dragRef.current) {
        if (dragRef.current.raf) cancelAnimationFrame(dragRef.current.raf);
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
      className="sticky top-0 flex flex-col overflow-y-auto overflow-x-hidden z-40 shrink-0"
      style={{
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
                backgroundColor: isActive ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--accent) 8%, transparent)';
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
                backgroundColor: selectedGenre === genre.name ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'transparent',
                color: selectedGenre === genre.name ? 'var(--accent)' : 'var(--text-secondary)',
                fontWeight: selectedGenre === genre.name ? 600 : 400,
                fontSize: '14px',
                borderLeft: selectedGenre === genre.name ? '3px solid var(--accent)' : '3px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (selectedGenre !== genre.name) {
                  e.currentTarget.style.color = 'var(--accent)';
                  e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--accent) 8%, transparent)';
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

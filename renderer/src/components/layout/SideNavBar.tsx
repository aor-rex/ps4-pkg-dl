import { HugeiconsIcon } from '@hugeicons/react';
import {
  Home01Icon, AnalyticsUpIcon, Clock01Icon, Folder01Icon,
  Sword01Icon, Sword02Icon, AdventureIcon, Shield01Icon, Target01Icon, ZapIcon,
  PuzzleIcon, Car01Icon, TrophyIcon, GhostIcon, StrategyIcon, Rocket01Icon,
  Rocket02Icon, DiceFaces01Icon, DiceFaces02Icon, Cards01Icon, GameboyIcon,
  BalloonIcon, Music01Icon, InformationCircleIcon, ArrowLeft01Icon, ArrowRight01Icon,
} from '@hugeicons/core-free-icons';
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

export default function SideNavBar({ collapsed, onToggleCollapse }: { collapsed: boolean; onToggleCollapse: () => void }) {
  const { currentView, setCurrentView, selectedGenre, setSelectedGenre, downloads, setSettingsOpen, availableGenres, liveMode } = useAppStore();
  const activeDownloads = downloads.filter((d) => d.status === 'active').slice(0, 3);

  const navItems = [
    { icon: Home01Icon, label: 'Home', view: 'home' },
    { icon: AnalyticsUpIcon, label: 'Library', view: 'library' },
    { icon: Clock01Icon, label: 'New', view: 'new' },
    { icon: Folder01Icon, label: 'All Games', view: 'all' },
  ];

  const handleNavClick = (view: string) => {
    setSettingsOpen(false);
    setCurrentView(view);
  };

  return (
    <aside
      className="fixed left-0 flex flex-col overflow-y-auto overflow-x-hidden z-40"
      style={{
        top: '56px',
        width: collapsed ? '64px' : '240px',
        height: 'calc(100vh - 56px - 48px)',
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border)',
        paddingTop: '16px',
        paddingBottom: '16px',
        transition: 'width 0.2s ease',
      }}
    >
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

      {/* Divider */}
      <div style={{ height: '1px', backgroundColor: 'var(--border)', margin: '12px 16px' }} />

      {/* Disclaimer footer */}
      {!collapsed && (
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', marginTop: '8px' }}>
          <p style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            No files hosted — links you provide only.
          </p>
        </div>
      )}

      {/* Active Downloads Quick View - UI Spec 4.1.4 (hidden when collapsed; counter lives in top bar) */}
      {!collapsed && (
      <div className="px-0 mt-auto">
        <div className="text-xs uppercase px-4 pb-2" style={{ color: 'var(--text-muted)', letterSpacing: '1px', fontSize: '11px' }}>Active Downloads</div>
        {activeDownloads.length === 0 ? (
          <div className="text-center py-4" style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No active downloads</div>
        ) : (
          <div>
            {activeDownloads.map((dl) => (
              <button
                key={dl.id}
                className="w-full text-left transition-colors"
                style={{ height: '48px', padding: '0 16px' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(102,192,244,0.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div className="flex justify-between items-center">
                  <span className="truncate block text-sm" style={{ color: 'var(--text-primary)' }}>{dl.gameTitle}</span>
                  <span className="text-xs ml-2 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{dl.progress}%</span>
                </div>
                <div className="mt-1 h-1 rounded overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
                  <div className="h-full progress-fill" style={{ width: `${dl.progress}%`, backgroundColor: 'var(--accent)' }} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Collapse toggle */}
      <div className={collapsed ? '' : 'px-0 mt-auto'} style={collapsed ? { marginTop: 'auto', display: 'flex', justifyContent: 'center', padding: '8px 0' } : undefined}>
        <button
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex items-center justify-center transition-colors"
          style={{
            height: '36px',
            width: collapsed ? '36px' : '100%',
            color: 'var(--text-muted)',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <HugeiconsIcon
            icon={collapsed ? ArrowRight01Icon : ArrowLeft01Icon}
            strokeWidth={2}
            style={{ width: '18px', height: '18px' }}
          />
          {!collapsed && <span style={{ fontSize: '12px', marginLeft: '8px' }}>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}

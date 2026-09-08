import { Home, TrendingUp, Clock, FolderOpen } from 'lucide-react';
import { useAppStore } from '../../store/appStore';

export default function SideNavBar() {
  const { currentView, setCurrentView, selectedGenre, setSelectedGenre, downloads, setSettingsOpen, availableGenres, liveMode } = useAppStore();
  const activeDownloads = downloads.filter((d) => d.status === 'active').slice(0, 3);

  const navItems = [
    { icon: Home, label: 'Home', view: 'home' },
    { icon: TrendingUp, label: 'Library', view: 'library' },
    { icon: Clock, label: 'New', view: 'new' },
    { icon: FolderOpen, label: 'All Games', view: 'all' },
  ];

  const handleNavClick = (view: string) => {
    setSettingsOpen(false);
    setCurrentView(view);
  };

  return (
    <aside
      className="fixed left-0 flex flex-col overflow-y-auto z-40"
      style={{
        top: '56px',
        width: '240px',
        height: 'calc(100vh - 56px - 48px)',
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border)',
        paddingTop: '16px',
        paddingBottom: '16px',
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
              className="w-full flex items-center transition-all"
              style={{
                height: '40px',
                padding: '0 16px',
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
              <item.icon style={{ width: '18px', height: '18px', marginRight: '12px' }} />
              <span className="text-sm" style={{ fontWeight: 500 }}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Divider - UI Spec 4.1.2 */}
      <div style={{ height: '1px', backgroundColor: 'var(--border)', margin: '12px 16px' }} />

      {/* Genre Categories - from enriched metadata (API) */}
      <div className="px-0 mb-3">
        <div className="text-xs uppercase px-4 pb-2" style={{ color: 'var(--text-muted)', letterSpacing: '1px', fontSize: '11px' }}>Genres</div>
        {liveMode && availableGenres.length > 0 ? (
        <div>
          {availableGenres.map((g) => ({ name: g.name, count: g.count })).map((genre) => (
            <button
              key={genre.name}
              onClick={() => {
                setSettingsOpen(false);
                setSelectedGenre(selectedGenre === genre.name ? null : genre.name);
                setCurrentView('home');
              }}
              className="w-full text-left transition-colors"
              style={{
                height: '32px',
                padding: '0 16px',
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
              {genre.name}
              {genre.count != null && (
                <span style={{ marginLeft: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>{genre.count}</span>
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
      <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', marginTop: '8px' }}>
        <p style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
          No files hosted — links you provide only.
        </p>
      </div>

      {/* Active Downloads Quick View - UI Spec 4.1.4 */}
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
    </aside>
  );
}

import { HugeiconsIcon } from '@hugeicons/react';
import { Search01Icon, Settings02Icon, Download02Icon, GameController02Icon, Cancel01Icon } from '@hugeicons/core-free-icons';
import { useAppStore } from '../../store/appStore';
import { useState, useRef, useEffect } from 'react';
import { COVER_FALLBACK } from '../../lib/catalog';

export default function TopNavBar() {
  const { searchQuery, setSearchQuery, setSettingsOpen, setDownloadManagerOpen, downloads, setCurrentView, setSelectedGame, filteredGames: storeFiltered, fetchLiveSearch, openGameDetail } = useAppStore();
  const [searchFocused, setSearchFocused] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dropdown uses the store's filteredGames (live search populates it); slice to 5
  const filteredGames = storeFiltered.slice(0, 5);

  // Live search: debounced server-side call (no-op while offline)
  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    setShowResults(true);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      void fetchLiveSearch(value);
    }, 450);
  };

  useEffect(() => () => { if (searchTimer.current) clearTimeout(searchTimer.current); }, []);

  const activeDownloads = downloads.filter((d) => d.status === 'active');

  const handleLogoClick = () => {
    setSettingsOpen(false);
    setCurrentView('home');
    setSelectedGame(null);
  };

  const handleGameSelect = (game: any) => {
    setSearchQuery('');
    setShowResults(false);
    void openGameDetail(game);
  };

  return (
    <>
      {/* Top Nav - UI Spec Section 3: 56px, #171d25, 1px border-bottom */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4"
        style={{
          height: '56px',
          backgroundColor: 'var(--bg-topnav)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {/* Left: Logo Area - UI Spec 3.2 */}
        <div className="flex items-center" style={{ width: '200px' }}>
          <button
            onClick={handleLogoClick}
            className="flex items-center gap-3 px-4 transition-opacity"
            style={{ opacity: 1 }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            <HugeiconsIcon icon={GameController02Icon} strokeWidth={2} className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            <span className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>PS4 PKG DL</span>
          </button>
        </div>

        {/* Center: Search Bar - UI Spec 3.3 */}
        <div className="flex-1 flex justify-center px-4">
          <div className="relative" style={{ maxWidth: '480px', minWidth: '240px', width: '100%' }}>
            <div
              className="flex items-center rounded transition-all"
              style={{
                height: '36px',
                backgroundColor: 'var(--bg-tertiary)',
                border: `1px solid ${searchFocused ? 'var(--accent)' : 'var(--border)'}`,
                boxShadow: searchFocused ? '0 0 0 2px rgba(102,192,244,0.3)' : 'none',
              }}
            >
              <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="ml-2 mr-1 flex-shrink-0" style={{ width: '16px', height: '16px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                onFocus={() => { setSearchFocused(true); setShowResults(true); }}
                onBlur={() => { setSearchFocused(false); setTimeout(() => setShowResults(false), 200); }}
                placeholder="Search PS4 games..."
                className="flex-1 bg-transparent border-none outline-none text-sm px-2"
                style={{ color: 'var(--text-primary)', paddingLeft: '8px' }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mr-2 p-0.5 rounded transition-colors flex-shrink-0"
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                  style={{ color: 'var(--text-muted)' }}
                >
                  <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} style={{ width: '16px', height: '16px' }} />
                </button>
              )}
            </div>

            {/* Search Results Dropdown - UI Spec 3.3 */}
            {showResults && searchQuery && filteredGames.length > 0 && (
              <div
                className="absolute top-full left-0 right-0 mt-1 rounded overflow-hidden z-50"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                }}
              >
                {filteredGames.map((game) => (
                  <button
                    key={game.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleGameSelect(game);
                    }}
                    className="w-full flex items-center gap-3 transition-colors"
                    style={{ height: '48px', padding: '0 12px' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <img
                      src={game.cover || COVER_FALLBACK}
                      alt=""
                      width={32}
                      height={44}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = COVER_FALLBACK; }}
                      className="rounded"
                      style={{ width: '32px', height: '44px', objectFit: 'cover' }}
                    />
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{game.title}</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{game.size}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions - UI Spec 3.4, 3.5 */}
        <div className="flex items-center" style={{ width: '200px', justifyContent: 'flex-end' }}>
          {/* Downloads Button - UI Spec 3.5 */}
          <button
            onClick={() => setDownloadManagerOpen(!useAppStore.getState().downloadManagerOpen)}
            className="relative p-2 rounded transition-colors"
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--accent)';
              e.currentTarget.style.backgroundColor = 'rgba(102,192,244,0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            style={{ color: 'var(--text-muted)' }}
            title="Downloads"
          >
            <HugeiconsIcon icon={Download02Icon} strokeWidth={2} style={{ width: '20px', height: '20px' }} />
            {activeDownloads.length > 0 && (
              <span
                className="absolute flex items-center justify-center"
                style={{
                  top: '2px',
                  right: '2px',
                  width: '16px',
                  height: '16px',
                  backgroundColor: 'var(--error)',
                  color: '#ffffff',
                  fontSize: '10px',
                  fontWeight: 700,
                  borderRadius: '50%',
                }}
              >
                {activeDownloads.length}
              </span>
            )}
          </button>

          {/* Settings Button - UI Spec 3.4 */}
          <button
            onClick={() => { setCurrentView('settings'); setSettingsOpen(true); }}
            className="p-2 rounded transition-colors"
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--accent)';
              e.currentTarget.style.backgroundColor = 'rgba(102,192,244,0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            style={{ color: 'var(--text-muted)' }}
            title="Settings"
          >
            <HugeiconsIcon icon={Settings02Icon} strokeWidth={2} style={{ width: '20px', height: '20px' }} />
          </button>
        </div>
      </header>
    </>
  );
}

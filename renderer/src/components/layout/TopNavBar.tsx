import { HugeiconsIcon } from '@hugeicons/react';
import { Search01Icon, Settings02Icon, Download02Icon, GameController02Icon, Cancel01Icon } from '@hugeicons/core-free-icons';
import { useAppStore } from '../../store/appStore';
import { useState, useRef, useEffect } from 'react';
import { COVER_FALLBACK } from '../../lib/catalog';
import NotificationCenter from '../common/NotificationCenter';
import type { Game } from '../../types';

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

  const handleGameSelect = (game: Game) => {
    setSearchQuery('');
    setShowResults(false);
    void openGameDetail(game);
  };

  return (
    <>
      {/* Top Nav - UI Spec Section 3: 56px, #171d25, 1px border-bottom */}
      <header
        className="sticky top-0 left-0 right-0 z-50 flex items-center justify-between px-4"
        style={{
          height: '56px',
          backgroundColor: 'var(--bg-topnav)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {/* Left: Logo Area - UI Spec 3.2 */}
        <div className="flex items-center shrink-0">
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
                boxShadow: searchFocused ? '0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent)' : 'none',
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
            {showResults && searchQuery && (
              <div
                className="absolute top-full left-0 right-0 mt-1 rounded overflow-hidden z-50"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                }}
              >
                {filteredGames.length === 0 ? (
                  <div style={{ padding: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>
                    No matches for &ldquo;{searchQuery}&rdquo; —{' '}
                    <button
                      onClick={() => setSearchQuery('')}
                      style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '13px', padding: 0 }}
                    >
                      clear search
                    </button>
                  </div>
                ) : (
                filteredGames.map((game) => (
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
                ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions - UI Spec 3.4, 3.5 */}
        <div className="flex items-center shrink-0" style={{ justifyContent: 'flex-end' }}>
          {/* Downloads Button - UI Spec 3.5 */}
          <button
            onClick={() => setDownloadManagerOpen(!useAppStore.getState().downloadManagerOpen)}
            className="relative p-2 rounded transition-colors"
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--accent)';
              e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--accent) 10%, transparent)';
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
                  color: 'var(--on-error)',
                  fontSize: '10px',
                  fontWeight: 700,
                  borderRadius: '50%',
                }}
              >
                {activeDownloads.length}
              </span>
            )}
          </button>

          {/* Notifications */}
          <NotificationCenter />

          {/* Settings Button - UI Spec 3.4 */}
          <button
            onClick={() => { setCurrentView('settings'); setSettingsOpen(true); }}
            className="p-2 rounded transition-colors"
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--accent)';
              e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--accent) 10%, transparent)';
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

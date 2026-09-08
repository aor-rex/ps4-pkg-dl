import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import GameCard from './GameCard';
import GameCardList from './GameCardList';

export default function GameGrid() {
  const { filteredGames, openGameDetail, setCurrentView, selectedGenre, sortBy, viewMode, currentPage, setCurrentPage, setViewMode, setSortBy, browseLoading, liveMode, searchQuery, setSettingsOpen, setSettingsCategory, settings } = useAppStore();
  const compact = settings.compactMode;
  const showSetupPrompt = liveMode && !searchQuery.trim() && !selectedGenre;

  const sortedGames = useMemo(() => [...filteredGames].sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.date).getTime() - new Date(a.date).getTime();
    if (sortBy === 'oldest') return new Date(a.date).getTime() - new Date(b.date).getTime();
    if (sortBy === 'name-az') return a.title.localeCompare(b.title);
    if (sortBy === 'name-za') return b.title.localeCompare(a.title);
    if (sortBy === 'largest') return b.sizeBytes - a.sizeBytes;
    if (sortBy === 'smallest') return a.sizeBytes - b.sizeBytes;
    return 0;
  }), [filteredGames, sortBy]);

  const gamesPerPage = 24;
  const totalPages = Math.ceil(sortedGames.length / gamesPerPage);
  const startIndex = (currentPage - 1) * gamesPerPage;
  const paginatedGames = useMemo(() => sortedGames.slice(startIndex, startIndex + gamesPerPage), [sortedGames, startIndex, gamesPerPage]);

  const handleGameClick = (game: any) => { void openGameDetail(game); setCurrentView('detail'); };
  const sortOptions = [
    { value: 'newest', label: 'Newest' }, { value: 'oldest', label: 'Oldest' },
    { value: 'name-az', label: 'Name A-Z' }, { value: 'name-za', label: 'Name Z-A' },
    { value: 'largest', label: 'Largest' }, { value: 'smallest', label: 'Smallest' },
  ];

  return (
    <div style={{ padding: '24px', paddingBottom: '32px' }}>
      {/* Header - UI Spec 6.1 */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>Browse PS4 Games</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Showing {startIndex + 1}–{Math.min(startIndex + gamesPerPage, sortedGames.length)} of {sortedGames.length} games{selectedGenre ? ` in ${selectedGenre}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={sortBy} onChange={(e) => setSortBy(e.target.value)}
            className="rounded text-sm"
            style={{ height: '32px', padding: '0 12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: '4px', fontSize: '14px' }}
          >
            {sortOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div className="flex gap-1">
            <button onClick={() => setViewMode('grid')} className="p-2 rounded transition-colors"
              style={{ color: viewMode === 'grid' ? 'var(--accent)' : 'var(--text-muted)', backgroundColor: viewMode === 'grid' ? 'rgba(102,192,244,0.1)' : 'transparent' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><rect x="2" y="2" width="7" height="7" rx="1"/><rect x="11" y="2" width="7" height="7" rx="1"/><rect x="2" y="11" width="7" height="7" rx="1"/><rect x="11" y="11" width="7" height="7" rx="1"/></svg>
            </button>
            <button onClick={() => setViewMode('list')} className="p-2 rounded transition-colors"
              style={{ color: viewMode === 'list' ? 'var(--accent)' : 'var(--text-muted)', backgroundColor: viewMode === 'list' ? 'rgba(102,192,244,0.1)' : 'transparent' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><rect x="2" y="3" width="16" height="2" rx="1"/><rect x="2" y="9" width="16" height="2" rx="1"/><rect x="2" y="15" width="16" height="2" rx="1"/></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Loading Skeletons */}
      {browseLoading ? (
        <div className="flex flex-wrap gap-4 justify-center">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="w-[220px] h-[380px] rounded-lg overflow-hidden skeleton" style={{ backgroundColor: 'var(--bg-tertiary)' }} />
          ))}
        </div>
      ) : paginatedGames.length === 0 ? (
        showSetupPrompt ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Search style={{ width: '64px', height: '64px', color: 'var(--border)', marginBottom: '16px' }} />
            <h3 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>No library loaded</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px', textAlign: 'center', maxWidth: '420px' }}>
              Paste your games.json URL in Settings → Library to load your catalog, then backfill it with metadata.
            </p>
            <button
              onClick={() => { setSettingsCategory('library'); setSettingsOpen(true); setCurrentView('settings'); }}
              style={{ backgroundColor: 'var(--accent)', color: 'var(--text-on-accent)', fontSize: '14px', fontWeight: 600, padding: '10px 24px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
            >
              Open Library setup
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <Search style={{ width: '64px', height: '64px', color: 'var(--border)', marginBottom: '16px' }} />
            <h3 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>No games found</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              {liveMode ? 'Try adjusting your search or filters' : 'Start the API server to browse the live catalog'}
            </p>
          </div>
        )
      ) : viewMode === 'grid' ? (
        <div className={`flex flex-wrap justify-center ${compact ? 'gap-2' : 'gap-4'}`}>
          {paginatedGames.map((game) => <GameCard key={game.id} game={game} compact={compact} onClick={() => handleGameClick(game)} />)}
        </div>
      ) : (
        <div style={{ borderTop: `1px solid var(--border)` }}>
          {paginatedGames.map((game) => <GameCardList key={game.id} game={game} onClick={() => handleGameClick(game)} />)}
        </div>
      )}

      {/* Pagination - UI Spec 6.4 */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2" style={{ marginTop: '32px' }}>
          <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}
            className="rounded transition-colors flex items-center gap-1"
            style={{ padding: '8px 12px', fontSize: '14px', color: currentPage === 1 ? 'var(--border)' : 'var(--text-muted)', borderRadius: '4px' }}
            onMouseEnter={(e) => { if (currentPage !== 1) e.currentTarget.style.backgroundColor = 'rgba(102,192,244,0.15)'; }}
            onMouseLeave={(e) => { if (currentPage !== 1) e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <ChevronLeft style={{ width: '14px', height: '14px' }} /> Previous
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let page: number;
            if (totalPages <= 5) page = i + 1;
            else if (currentPage <= 3) page = i + 1;
            else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
            else page = currentPage - 2 + i;
            return (
              <button key={page} onClick={() => setCurrentPage(page)}
                className="rounded transition-colors"
                style={{
                  width: '40px', height: '36px', fontSize: '14px', borderRadius: '4px',
                  backgroundColor: currentPage === page ? 'var(--accent)' : 'transparent',
                  color: currentPage === page ? 'var(--bg-primary)' : 'var(--text-secondary)',
                  fontWeight: currentPage === page ? 600 : 400,
                }}
                onMouseEnter={(e) => { if (currentPage !== page) e.currentTarget.style.backgroundColor = 'rgba(102,192,244,0.15)'; }}
                onMouseLeave={(e) => { if (currentPage !== page) e.currentTarget.style.backgroundColor = 'transparent'; }}
              >{page}</button>
            );
          })}
          <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}
            className="rounded transition-colors flex items-center gap-1"
            style={{ padding: '8px 12px', fontSize: '14px', color: currentPage === totalPages ? 'var(--border)' : 'var(--text-muted)', borderRadius: '4px' }}
            onMouseEnter={(e) => { if (currentPage !== totalPages) e.currentTarget.style.backgroundColor = 'rgba(102,192,244,0.15)'; }}
            onMouseLeave={(e) => { if (currentPage !== totalPages) e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            Next <ChevronRight style={{ width: '14px', height: '14px' }} />
          </button>
        </div>
      )}
    </div>
  );
}

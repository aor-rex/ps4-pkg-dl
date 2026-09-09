import { useEffect, useState } from 'react';
import { useAppStore } from './store/appStore';
import TopNavBar from './components/layout/TopNavBar';
import SideNavBar from './components/layout/SideNavBar';
import BottomDownloadBar from './components/layout/BottomDownloadBar';
import GameGrid from './components/views/GameGrid';
import GameDetail from './components/views/GameDetail';
import Settings from './components/views/Settings';
import MirrorModal from './components/modals/MirrorModal';
import Lightbox from './components/modals/Lightbox';
import VideoModal from './components/modals/VideoModal';
import ConfirmDialog from './components/modals/ConfirmDialog';
import ToastContainer from './components/common/Toast';
import ErrorBoundary from './components/common/ErrorBoundary';

export default function App() {
  const { currentView, settingsOpen, settings, initLive, loadBrowse, setCurrentView, setSelectedGame } = useAppStore();
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      const saved = parseInt(localStorage.getItem('sidebar-width') || '240', 10);
      return Number.isFinite(saved) ? Math.min(400, Math.max(64, saved)) : 240;
    } catch {
      return 240;
    }
  });
  const sidebarCollapsed = sidebarWidth < 120;
  const handleSidebarWidth = (w: number) => {
    const clamped = Math.min(400, Math.max(64, w));
    setSidebarWidth(clamped);
    try {
      localStorage.setItem('sidebar-width', String(clamped));
    } catch {
      /* ignore */
    }
  };

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme || 'kinetic-vault');
  }, [settings.theme]);

  // Boot backend bridge (Electron IPC or HTTP API — offline shows empty states).
  // The initial browse load happens inside initLive after mode detection,
  // so the grid never renders stale-empty on refresh.
  useEffect(() => {
    initLive();
  }, [initLive]);

  // "New" view = recently added to your library (first-seen tracking)
  useEffect(() => {
    if (currentView === 'new') void loadBrowse(1, 'added', 'desc');
    else if (currentView === 'home' || currentView === 'all') void loadBrowse(1);
  }, [currentView, loadBrowse]);

  const renderView = () => {
    if (settingsOpen || currentView === 'settings') {
      return <Settings />;
    }

    switch (currentView) {
      case 'detail':
        return <GameDetail />;
      case 'home':
      case 'trending':
      case 'library':
      case 'new':
      case 'all':
      default:
        return <GameGrid />;
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* Top Navigation Bar - Fixed 56px */}
      <TopNavBar />

      <div className="flex flex-1 overflow-hidden" style={{ marginTop: '56px' }}>
        {/* Sidebar - drag-resizable, snaps to 64px icon rail */}
        <SideNavBar width={sidebarWidth} collapsed={sidebarCollapsed} onWidthChange={handleSidebarWidth} />

        {/* Main Content Area - fills remaining space, scrollable */}
        <main
          className="flex-1 overflow-y-auto"
          style={{
            marginLeft: `${sidebarWidth}px`,
            height: 'calc(100vh - 56px - 48px)',
            backgroundColor: 'var(--bg-primary)',
          }}
        >
          <ErrorBoundary
            key={currentView}
            onReset={() => {
              setSelectedGame(null);
              setCurrentView('home');
            }}
          >
            {renderView()}
          </ErrorBoundary>
        </main>
      </div>

      {/* Bottom Download Bar - Fixed 48px */}
      <BottomDownloadBar />

      {/* Modals */}
      <MirrorModal />
      <Lightbox />
      <VideoModal />
      <ConfirmDialog />

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  );
}

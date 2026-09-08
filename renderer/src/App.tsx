import { useEffect } from 'react';
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

export default function App() {
  const { currentView, settingsOpen, settings, initLive, loadBrowse } = useAppStore();

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
        {/* Sidebar - Fixed 240px */}
        <SideNavBar />

        {/* Main Content Area - fills remaining space, scrollable */}
        <main
          className="flex-1 overflow-y-auto"
          style={{
            marginLeft: '240px',
            height: 'calc(100vh - 56px - 48px)',
            backgroundColor: 'var(--bg-primary)',
          }}
        >
          {renderView()}
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

import { useState, useEffect } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Folder01Icon, Download02Icon, Package02Icon, GlobalIcon, Notification01Icon, PaintBoardIcon, InformationCircleIcon, Database02Icon } from '@hugeicons/core-free-icons';
import { useAppStore, defaultSettings } from '../../store/appStore';
import { backend, tryLive } from '../../lib/backend';
import { appVersion } from '../modals/WhatsNewModal';
import { formatTransfer } from '../../lib/format';
import { Toggle, SettingRow } from './settings/controls';
import { LibrarySettings } from './settings/LibrarySettings';

const categories = [
  { icon: Database02Icon, key: 'library', label: 'Library' },
  { icon: Folder01Icon, key: 'general', label: 'General' },
  { icon: Download02Icon, key: 'downloads', label: 'Downloads' },
  { icon: Package02Icon, key: 'extract', label: 'Extract' },
  { icon: GlobalIcon, key: 'network', label: 'Network' },
  { icon: Notification01Icon, key: 'notifications', label: 'Notifications' },
  { icon: PaintBoardIcon, key: 'appearance', label: 'Appearance' },
  { icon: InformationCircleIcon, key: 'about', label: 'About' },
];
export default function Settings() {
  const { settings, setSettings, settingsCategory, setSettingsCategory, addToast, setWhatsNewOpen, updateStatus, updateVersion, updateProgress, updateTransferred, updateTotal, updateError, checkForUpdates, downloadUpdate, restartToUpdate } = useAppStore();
  const [dirty, setDirty] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Hydrate from backend on mount (live mode)
  useEffect(() => {
    if (!backend) return;
    void tryLive(async (api) => {
      const remote = await api.getSettings();
      if (remote) setSettings(remote as Partial<typeof settings>);
    });
  }, [setSettings]);

  const handleChange = (key: string, value: unknown) => {
    setSettings({ [key]: value });
    setDirty(true);
  };

  const handleToggle = (key: string) => {
    handleChange(key, !settings[key as keyof typeof settings]);
  };

  const handleSave = async () => {
    if (backend) {
      const saved = await tryLive((api) => api.updateSettings(settings as unknown as Record<string, unknown>));
      if (saved) setSettings(saved as Partial<typeof settings>);
    }
    addToast('success', 'Settings saved successfully');
    setDirty(false);
  };

  const handleReset = async () => {
    setSettings(defaultSettings);
    if (backend) await tryLive((api) => api.updateSettings(defaultSettings as unknown as Record<string, unknown>));
    setDirty(true);
  };

  const handleBrowse = async () => {
    if (!backend) { addToast('info', 'Directory picker only available in desktop app'); return; }
    const dir = await tryLive((api) => api.chooseDirectory());
    if (dir) handleChange('downloadDir', dir);
  };

  const handleVerify = async () => {
    if (!backend) { addToast('info', 'Verification only in desktop app'); return; }
    setVerifying(true);
    const res = await tryLive((api) => api.systemCheck());
    setVerifying(false);
    if (res?.ytdlp?.available) addToast('success', `yt-dlp OK: ${res.ytdlp.version || 'available'}`);
    else addToast('error', `yt-dlp not found: ${res?.ytdlp?.error || 'missing'}`);
  };

  const renderGeneral = () => (
    <div>
      <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '20px' }}>General</h2>
      <SettingRow label="Download Location">
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={settings.downloadDir || ''}
            onChange={(e) => handleChange('downloadDir', e.target.value)}
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontSize: '14px',
              padding: '8px 12px',
              borderRadius: '4px',
              width: '280px',
              outline: 'none',
            }}
          />
          <button
            onClick={handleBrowse}
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'background-color 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--border)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
          >
            Browse
          </button>
          <button
            onClick={() => {
              void (async () => {
                const opened = await tryLive((api) => api.openFolder());
                if (!opened) addToast('info', 'Open folder is available in the desktop app');
              })();
            }}
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'background-color 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--border)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
          >
            Open Folder
          </button>
        </div>
      </SettingRow>
      <SettingRow label="Create game subfolder">
        <Toggle checked={settings.createSubfolder} onChange={() => handleToggle('createSubfolder')} />
      </SettingRow>
      <SettingRow label="Check for updates on launch">
        <Toggle checked={settings.autoCheckUpdates !== false} onChange={() => handleToggle('autoCheckUpdates')} />
      </SettingRow>
      <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '20px', marginTop: '28px' }}>Updates</h2>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'left', marginBottom: '12px' }}>
        Release channel
        <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
          {([
            { value: 'prerelease' as const, label: 'Pre-release' },
            { value: 'stable' as const, label: 'Stable' },
          ]).map((option) => (
            <label key={option.value} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <input
                type="radio"
                name="update-channel"
                checked={(settings.updateChannel || 'prerelease') === option.value}
                onChange={() => {
                  handleChange('updateChannel', option.value);
                  // Persist immediately so the next check honors the new channel
                  void tryLive((api) => api.updateSettings({ updateChannel: option.value }));
                  void checkForUpdates(false);
                }}
                style={{ accentColor: 'var(--accent)', width: '14px', height: '14px', cursor: 'pointer' }}
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>
      {settings.updateChannel === 'stable' && updateStatus === 'idle' && (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'left', marginBottom: '12px' }}>
          On a newer pre-release? Stable offers nothing newer — switch back to Pre-release to keep updating.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '220px', marginBottom: '12px' }}>
        <button
          onClick={() => void checkForUpdates(true)}
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            fontSize: '14px',
            padding: '10px 20px',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'background-color 0.2s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--border)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
        >
          Check for Updates
        </button>
      </div>
      {(updateStatus === 'available' || updateStatus === 'downloading' || updateStatus === 'downloaded' || updateStatus === 'stalled') && updateVersion && (
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'left', marginBottom: '12px' }}>
          Update available: v{updateVersion}
          {updateStatus === 'available' && (
            <button
              onClick={() => void downloadUpdate()}
              style={{ display: 'block', width: '220px', marginTop: '8px', backgroundColor: 'var(--accent)', border: 'none', color: 'var(--text-on-accent)', fontSize: '14px', fontWeight: 600, padding: '10px 20px', borderRadius: '4px', cursor: 'pointer' }}
            >
              Download update
            </button>
          )}
          {updateStatus === 'downloading' && <div style={{ marginTop: '8px' }}>Downloading… {formatTransfer(updateTransferred, updateTotal, updateProgress)}</div>}
          {updateStatus === 'stalled' && (
            <div style={{ marginTop: '8px' }}>
              <div style={{ color: 'var(--warning)' }}>Stalled at {formatTransfer(updateTransferred, updateTotal, updateProgress)} — check your connection.</div>
              <button
                onClick={() => void downloadUpdate()}
                style={{ display: 'block', width: '220px', marginTop: '8px', backgroundColor: 'transparent', border: '1px solid var(--accent)', color: 'var(--accent)', fontSize: '14px', fontWeight: 600, padding: '10px 20px', borderRadius: '4px', cursor: 'pointer' }}
              >
                Retry download
              </button>
            </div>
          )}
          {updateStatus === 'downloaded' && (
            <button
              onClick={() => void restartToUpdate()}
              style={{ display: 'block', width: '220px', marginTop: '8px', backgroundColor: 'var(--accent)', border: 'none', color: 'var(--text-on-accent)', fontSize: '14px', fontWeight: 600, padding: '10px 20px', borderRadius: '4px', cursor: 'pointer' }}
            >
              Restart to install
            </button>
          )}
        </div>
      )}
      {updateStatus === 'error' && updateError && (
        <div style={{ fontSize: '13px', color: 'var(--warning)', textAlign: 'left', marginBottom: '12px', maxWidth: '420px' }}>
          {updateError}
        </div>
      )}
    </div>
  );

  const renderDownloads = () => (
    <div>
      <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '20px' }}>Downloads</h2>
      <SettingRow label="Max concurrent downloads">
        <input
          type="number"
          min="1"
          max="5"
          value={settings.maxConcurrentDownloads}
          onChange={(e) => handleChange('maxConcurrentDownloads', Math.max(1, Math.min(5, parseInt(e.target.value) || 1)))}
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontSize: '14px',
            padding: '8px 12px',
            borderRadius: '4px',
            width: '60px',
            textAlign: 'center',
            outline: 'none',
          }}
        />
      </SettingRow>
      <SettingRow label="Speed limit">
        <select
          value={settings.speedLimit}
          onChange={(e) => handleChange('speedLimit', e.target.value)}
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontSize: '14px',
            padding: '8px 12px',
            borderRadius: '4px',
            width: '160px',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="None">None</option>
          <option value="5 MB/s">5 MB/s</option>
          <option value="10 MB/s">10 MB/s</option>
          <option value="20 MB/s">20 MB/s</option>
          <option value="50 MB/s">50 MB/s</option>
        </select>
      </SettingRow>
      <SettingRow label="Retry failed downloads">
        <input
          type="number"
          min="0"
          max="10"
          value={settings.retryCount}
          onChange={(e) => handleChange('retryCount', Math.max(0, Math.min(10, parseInt(e.target.value) || 0)))}
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontSize: '14px',
            padding: '8px 12px',
            borderRadius: '4px',
            width: '60px',
            textAlign: 'center',
            outline: 'none',
          }}
        />
      </SettingRow>
      <SettingRow label="Retry delay (seconds)">
        <input
          type="number"
          min="0"
          value={settings.retryDelay}
          onChange={(e) => handleChange('retryDelay', Math.max(0, parseInt(e.target.value) || 0))}
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontSize: '14px',
            padding: '8px 12px',
            borderRadius: '4px',
            width: '60px',
            textAlign: 'center',
            outline: 'none',
          }}
        />
      </SettingRow>
      <SettingRow label="yt-dlp executable path">
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={settings.ytdlpPath || ''}
            onChange={(e) => handleChange('ytdlpPath', e.target.value)}
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontSize: '14px',
              padding: '8px 12px',
              borderRadius: '4px',
              width: '280px',
              outline: 'none',
            }}
          />
          <button
            onClick={handleVerify}
            disabled={verifying}
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: verifying ? 'wait' : 'pointer',
              transition: 'background-color 0.2s ease',
              opacity: verifying ? 0.6 : 1,
            }}
            onMouseEnter={(e) => { if (!verifying) e.currentTarget.style.backgroundColor = 'var(--border)'; }}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
          >
            {verifying ? 'Checking...' : 'Verify'}
          </button>
        </div>
      </SettingRow>
      <SettingRow label="Use proxy">
        <Toggle checked={settings.useProxy} onChange={() => handleToggle('useProxy')} />
      </SettingRow>
      <SettingRow label="Proxy URL" last>
        <input
          type="text"
          disabled={!settings.useProxy}
          placeholder="http://proxy:port"
          value={settings.proxyUrl || ''}
          onChange={(e) => handleChange('proxyUrl', e.target.value)}
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontSize: '14px',
            padding: '8px 12px',
            borderRadius: '4px',
            width: '280px',
            outline: 'none',
            opacity: !settings.useProxy ? 0.5 : 1,
            cursor: !settings.useProxy ? 'not-allowed' : 'text',
          }}
        />
      </SettingRow>
    </div>
  );

  const renderExtract = () => {
    const extractFormats = settings.extractFormats || ['.zip', '.rar', '.7z'];
    const toggleFormat = (fmt: string) => {
      const current = settings.extractFormats || [];
      const updated = current.includes(fmt) ? current.filter((f: string) => f !== fmt) : [...current, fmt];
      handleChange('extractFormats', updated);
    };

    return (
      <div>
        <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '20px' }}>Extract</h2>
        <SettingRow label="Auto-extract archives">
          <Toggle checked={settings.autoExtract} onChange={() => handleToggle('autoExtract')} />
        </SettingRow>
        <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
            Supported formats
          </span>
          <div style={{ display: 'flex', gap: '16px' }}>
            {['.zip', '.rar', '.7z'].map((fmt) => (
              <label key={fmt} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={extractFormats.includes(fmt)}
                  onChange={() => toggleFormat(fmt)}
                  style={{ accentColor: 'var(--accent)', width: '16px', height: '16px', cursor: 'pointer' }}
                />
                {fmt}
              </label>
            ))}
          </div>
        </div>
        <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
            Extract to
          </span>
          <div style={{ display: 'flex', gap: '16px' }}>
            {([
              { value: 'subfolder' as const, label: 'Subfolder' },
              { value: 'same' as const, label: 'Same directory' },
              { value: 'custom' as const, label: 'Custom' },
            ]).map((option) => (
              <label key={option.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: 'var(--text-secondary)' }}>
                <input
                  type="radio"
                  name="extractTo"
                  checked={settings.extractTo === option.value}
                  onChange={() => handleChange('extractTo', option.value)}
                  style={{ accentColor: 'var(--accent)', width: '16px', height: '16px', cursor: 'pointer' }}
                />
                {option.label}
              </label>
            ))}
          </div>
          {settings.extractTo === 'custom' && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <input
                type="text"
                placeholder="~/Downloads/PS4-PKGs/Extracted"
                value={settings.customExtractDir || ''}
                onChange={(e) => handleChange('customExtractDir', e.target.value)}
                style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '14px', padding: '8px 12px', borderRadius: '4px', flex: 1, outline: 'none' }}
              />
              <button
                onClick={async () => {
                  if (!backend) return;
                  const dir = await tryLive((api) => api.chooseDirectory());
                  if (dir) handleChange('customExtractDir', dir);
                }}
                style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '13px', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}
              >
                Browse
              </button>
            </div>
          )}
        </div>
        <SettingRow label="Delete archive after extract" last>
          <Toggle checked={settings.deleteArchiveAfterExtract} onChange={() => handleToggle('deleteArchiveAfterExtract')} />
        </SettingRow>
      </div>
    );
  };

  const renderNetwork = () => (
    <div>
      <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '20px' }}>Network</h2>
      <SettingRow label="Download timeout (seconds)">
        <input
          type="number"
          min="0"
          value={settings.downloadTimeout}
          onChange={(e) => handleChange('downloadTimeout', Math.max(0, parseInt(e.target.value) || 300))}
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontSize: '14px',
            padding: '8px 12px',
            borderRadius: '4px',
            width: '60px',
            textAlign: 'center',
            outline: 'none',
          }}
        />
      </SettingRow>
      <SettingRow label="Connection timeout (seconds)">
        <input
          type="number"
          min="0"
          value={settings.connectionTimeout}
          onChange={(e) => handleChange('connectionTimeout', Math.max(0, parseInt(e.target.value) || 30))}
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontSize: '14px',
            padding: '8px 12px',
            borderRadius: '4px',
            width: '60px',
            textAlign: 'center',
            outline: 'none',
          }}
        />
      </SettingRow>
      <SettingRow label="Use system proxy">
        <Toggle checked={settings.useProxy} onChange={() => handleToggle('useProxy')} />
      </SettingRow>
      <SettingRow label="Custom proxy URL">
        <input
          type="text"
          placeholder="http://proxy:port"
          value={settings.proxyUrl || ''}
          onChange={(e) => handleChange('proxyUrl', e.target.value)}
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontSize: '14px',
            padding: '8px 12px',
            borderRadius: '4px',
            width: '280px',
            outline: 'none',
          }}
        />
      </SettingRow>
      <SettingRow label="Metadata key (RAWG)" last>
        <div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Managed in <strong>Library</strong> setup — keeps all credentials in one place.
          </div>
        </div>
      </SettingRow>
    </div>
  );

  const renderNotifications = () => (
    <div>
      <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '20px' }}>Notifications</h2>
      <SettingRow label="Download complete">
        <Toggle checked={settings.notifyOnComplete} onChange={() => handleToggle('notifyOnComplete')} />
      </SettingRow>
      <SettingRow label="Download failed">
        <Toggle checked={settings.notifyOnFailed} onChange={() => handleToggle('notifyOnFailed')} />
      </SettingRow>
      <SettingRow label="Extraction complete">
        <Toggle checked={settings.notifyOnExtractComplete} onChange={() => handleToggle('notifyOnExtractComplete')} />
      </SettingRow>
      <SettingRow label="Sound alert">
        <Toggle checked={settings.soundAlert} onChange={() => handleToggle('soundAlert')} />
      </SettingRow>
      <SettingRow label="Desktop notification" last>
        <Toggle checked={settings.desktopNotification} onChange={() => handleToggle('desktopNotification')} />
      </SettingRow>
      <div style={{ marginTop: '16px' }}>
        <button
          onClick={() => addToast('success', 'Test notification — notifications are working')}
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            fontSize: '14px',
            padding: '10px 20px',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'border-color 0.2s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
        >
          Send test notification
        </button>
      </div>
    </div>
  );

  const renderAppearance = () => (
    <div>
      <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '20px' }}>Appearance</h2>
      <SettingRow label="Theme">
        <div style={{ display: 'flex', gap: '16px' }}>
          {([
            { value: 'amoled' as const, label: 'AMOLED' },
            { value: 'kinetic-vault' as const, label: 'Kinetic Vault' },
            { value: 'light' as const, label: 'Light' },
          ]).map((option) => (
            <label key={option.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: 'var(--text-secondary)' }}>
              <input
                type="radio"
                name="theme"
                checked={settings.theme === option.value}
                onChange={() => handleChange('theme', option.value)}
                style={{ accentColor: 'var(--accent)', width: '16px', height: '16px', cursor: 'pointer' }}
              />
              {option.label}
            </label>
          ))}
        </div>
      </SettingRow>
      <SettingRow label="Card size">
        <select
          value={settings.cardSize}
          onChange={(e) => handleChange('cardSize', e.target.value)}
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontSize: '14px',
            padding: '8px 12px',
            borderRadius: '4px',
            width: '160px',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </SettingRow>
      <SettingRow label="Show game size on cards">
        <Toggle checked={settings.showSizeOnCards} onChange={() => handleToggle('showSizeOnCards')} />
      </SettingRow>
      <SettingRow label="Compact mode" last>
        <Toggle checked={settings.compactMode} onChange={() => handleToggle('compactMode')} />
      </SettingRow>
    </div>
  );

  const renderAbout = () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>PS4 PKG Downloader</h2>
      <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px' }}>v{appVersion()}</p>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '24px', maxWidth: '320px', textAlign: 'center' }}>
        Game metadata, artwork and trailers by <a href="https://rawg.io" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>RAWG</a> ·
        PKG catalog supplied by you
      </p>
      <div style={{ maxWidth: '520px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '6px', padding: '16px 20px', marginBottom: '24px', textAlign: 'center' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', textAlign: 'center' }}>Disclaimer</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.7' }}>
          This app <strong>hosts no files</strong>. All download links come from a catalog file you supply —
          the app only reads, matches, and downloads from URLs you provide. Game content belongs to its
          respective publishers; use this tool for personal, educational, and preservation purposes in
          accordance with the laws of your country. Not affiliated with Sony/PlayStation, the Internet
          Archive, or RAWG.
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '220px' }}>
        <button
          onClick={() => setWhatsNewOpen(true)}
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            fontSize: '14px',
            padding: '10px 20px',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'background-color 0.2s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--border)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
        >
          What&apos;s new
        </button>
        <button
          onClick={async () => {
            if (!backend) { addToast('info', 'Config folder is available in the desktop app'); return; }
            await tryLive((api) => api.openConfigFolder());
            addToast('info', 'Opening config folder');
          }}
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            fontSize: '14px',
            padding: '10px 20px',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'background-color 0.2s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--border)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
        >
          Open Config Folder
        </button>
        <button
          onClick={async () => {
            if (!backend) { addToast('info', 'Cache only in desktop app'); return; }
            const ok = await tryLive((api) => api.clearCache());
            addToast(ok ? 'success' : 'error', ok ? 'Cache cleared' : 'Clear failed');
          }}
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            fontSize: '14px',
            padding: '10px 20px',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'background-color 0.2s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--border)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
        >
          Clear Cache
        </button>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (settingsCategory) {
      case 'library': return <LibrarySettings />;
      case 'general': return renderGeneral();
      case 'downloads': return renderDownloads();
      case 'extract': return renderExtract();
      case 'network': return renderNetwork();
      case 'notifications': return renderNotifications();
      case 'appearance': return renderAppearance();
      case 'about': return renderAbout();
      default: return renderGeneral();
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ width: '100%', backgroundColor: 'var(--bg-primary)' }}>
      {/* Settings top tab bar */}
      <div
        className="flex items-center gap-1 shrink-0 overflow-x-auto"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border)',
          padding: '0 16px',
        }}
      >
        {categories.map((cat) => {
          const isActive = settingsCategory === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => setSettingsCategory(cat.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: '1 0 auto',
                gap: '8px',
                height: '48px',
                padding: '0 14px',
                border: 'none',
                backgroundColor: 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: '14px',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = 'var(--accent)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <HugeiconsIcon icon={cat.icon} strokeWidth={2} style={{ width: '16px', height: '16px', flexShrink: 0 }} />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Settings Content */}
      <div
        className="flex-1"
        style={{
          padding: '24px',
          backgroundColor: 'var(--bg-primary)',
          overflowY: 'auto',
        }}
      >
        <div style={{ maxWidth: '100%' }}>
          {renderContent()}

          {/* Action Buttons */}
          {settingsCategory !== 'about' && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={handleReset}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                  fontSize: '14px',
                  padding: '10px 20px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--text-muted)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                Reset Defaults
              </button>
              {dirty && (
                <button
                  onClick={handleSave}
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--text-on-accent)',
                    fontSize: '14px',
                    fontWeight: 600,
                    padding: '10px 24px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease',
                    border: 'none',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent)')}
                >
                  Save
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

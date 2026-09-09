import { useState, useEffect, useRef } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Folder01Icon, Download02Icon, Package02Icon, GlobalIcon, Notification01Icon, PaintBoardIcon, InformationCircleIcon, Database02Icon } from '@hugeicons/core-free-icons';
import { useAppStore, defaultSettings } from '../../store/appStore';
import { backend, tryLive } from '../../lib/backend';

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

function Toggle({ checked, onChange }: { checked: boolean; onChange: (val: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: '40px',
        height: '20px',
        borderRadius: '10px',
        backgroundColor: checked ? 'var(--accent)' : 'var(--border)',
        position: 'relative',
        transition: 'background-color 0.2s ease',
        flexShrink: 0,
        cursor: 'pointer',
        border: 'none',
        padding: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '2px',
          left: checked ? '22px' : '2px',
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          backgroundColor: checked ? '#ffffff' : 'var(--text-muted)',
          transition: 'left 0.2s ease, background-color 0.2s ease',
        }}
      />
    </button>
  );
}

function SettingRow({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 0',
        borderBottom: last ? 'none' : '1px solid var(--border)',
      }}
    >
      <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</span>
      {children}
    </div>
  );
}

function LibrarySettings() {
  const {
    settings, setSettings,
    catalogStatus, refreshCatalogStatus,
    addCatalogSource, removeCatalogSource, toggleCatalogSource, refreshCatalogSource, uploadCatalogFile,
    backfill, backfillScope, setBackfillScope, startBackfill, cancelBackfill, retryMiss,
    candidates, fetchCandidates, pinMatch, ignoreMiss, ignored, loadIgnored, unignoreMiss,
    addToast, setConfirmDialogOpen, setConfirmDialogMessage, setConfirmDialogOnConfirm,
  } = useAppStore();
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [manualText, setManualText] = useState('');
  const [pinning, setPinning] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void refreshCatalogStatus();
    void loadIgnored();
  }, [refreshCatalogStatus, loadIgnored]);

  const handleAddUrl = async () => {
    const clean = url.trim();
    if (!clean) return;
    setAdding(true);
    const ok = await addCatalogSource('url', clean);
    if (ok) setUrl('');
    setAdding(false);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(file);
      });
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      await uploadCatalogFile(file.name, base64);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Could not read file');
    }
    setUploading(false);
  };

  const withBusy = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    try {
      await fn();
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = (id: string, label: string) => {
    setConfirmDialogMessage(`Remove catalog source "${label}"? Its games leave the library (metadata already saved stays).`);
    setConfirmDialogOnConfirm(() => () => void withBusy(id, () => removeCatalogSource(id)));
    setConfirmDialogOpen(true);
  };

  const running = backfill?.status === 'running';
  const pct = backfill && backfill.total ? Math.round((backfill.done / backfill.total) * 100) : 0;
  const rawgSet =
    (settings as unknown as Record<string, string>).rawgApiKey === '***set***' ||
    !!((settings as unknown as Record<string, string>).rawgApiKey || '').trim();

  const inputStyle = {
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    padding: '8px 12px',
    borderRadius: '4px',
    width: '100%',
    outline: 'none',
  } as const;

  const btnStyle = (primary: boolean) => ({
    backgroundColor: primary ? 'var(--accent)' : 'transparent',
    border: primary ? 'none' : '1px solid var(--accent)',
    color: primary ? 'var(--text-on-accent)' : 'var(--accent)',
    fontSize: '13px',
    fontWeight: 600 as const,
    padding: '8px 20px',
    borderRadius: '4px',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  });

  return (
    <div>
      <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '20px' }}>Library</h2>

      {/* 1. Catalog sources */}
      <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>1. Game catalogs</h3>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px', maxWidth: '100%' }}>
        Add one or more catalog URLs or local <code>games.json</code> files. Enabled sources merge into one library, deduplicated by PKG URL.
      </p>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', maxWidth: '100%' }}>
        <input
          type="url"
          placeholder="https://…/GAMES.json"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleAddUrl(); }}
          style={inputStyle}
        />
        <button onClick={() => void handleAddUrl()} disabled={adding || !url.trim()} style={btnStyle(true)}>
          {adding ? 'Adding…' : 'Add'}
        </button>
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px', maxWidth: '100%' }}>
        <button onClick={() => fileRef.current?.click()} disabled={uploading} style={btnStyle(false)}>
          {uploading ? 'Reading…' : 'Add local file…'}
        </button>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => void handleFile(e)} />
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>your own games.json, FPKGi format</span>
      </div>
      {(catalogStatus?.sources?.length ?? 0) > 0 ? (
        <div style={{ marginBottom: '8px', maxWidth: '100%' }}>
          {(catalogStatus?.sources ?? []).map((s) => (
            <div
              key={s.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                marginBottom: '6px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                opacity: s.enabled ? 1 : 0.6,
              }}
            >
              <Toggle checked={s.enabled} onChange={(v) => void withBusy(s.id, () => toggleCatalogSource(s.id, v))} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {s.label}
                  <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: 400, color: 'var(--text-muted)' }}>
                    {s.type === 'file' ? 'file' : 'url'}
                    {typeof s.count === 'number' ? ` · ${s.count} games` : ''}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.location}
                </div>
                {s.error ? (
                  <div style={{ fontSize: '11px', color: 'var(--error)' }}>{s.error}</div>
                ) : null}
              </div>
              <button
                onClick={() => void withBusy(s.id, () => refreshCatalogSource(s.id))}
                disabled={busyId === s.id || !s.enabled}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '12px' }}
              >
                {busyId === s.id ? '…' : 'Refresh'}
              </button>
              <button
                onClick={() => handleRemove(s.id, s.label)}
                disabled={busyId === s.id}
                style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '12px' }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
          No catalogs yet — add one above.
        </div>
      )}
      <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
        {catalogStatus?.configured ? (
          <>Loaded: <strong style={{ color: 'var(--text-secondary)' }}>{catalogStatus.count} games</strong>
          {catalogStatus.fetchedAt && <> · fetched {new Date(catalogStatus.fetchedAt).toLocaleDateString()}</>}</>
        ) : (
          <>No catalog loaded yet.</>
        )}
      </div>

      {/* 2. Metadata key */}
      <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>2. Metadata key (RAWG)</h3>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px', maxWidth: '100%' }}>
        Free key from <a href="https://rawg.io/apidocs" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>rawg.io/apidocs</a> —
        needed to fetch descriptions, genres and trailers during backfill. {rawgSet ? 'Key is set.' : 'No key set.'}
      </p>
      <div style={{ marginBottom: '24px', maxWidth: '100%' }}>
        <input
          type="password"
          placeholder={rawgSet ? '(hidden — type to replace, blank to clear)' : 'paste RAWG API key'}
          value={(settings as unknown as Record<string, string>).rawgApiKey === '***set***' ? '' : ((settings as unknown as Record<string, string>).rawgApiKey || '')}
          onChange={(e) => {
            setSettings({ rawgApiKey: e.target.value } as Partial<typeof settings>);
            addToast('info', e.target.value ? 'RAWG key saved' : 'RAWG key cleared');
          }}
          style={inputStyle}
        />
      </div>

      {/* 3. archive.org login (for login-gated items) */}
      <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>3. archive.org login</h3>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px', maxWidth: '100%' }}>
        Log in at archive.org in your browser, copy the <code>logged-in-user</code> and <code>logged-in-sig</code> cookies (DevTools → Application → Cookies),
        and paste them here as <code>logged-in-user=...; logged-in-sig=...</code>. These cookies are required for login-gated items.
        {(settings as unknown as Record<string, string>).iaCookie === '***set***' || ((settings as unknown as Record<string, string>).iaCookie || '').trim()
          ? 'Cookie is set.'
          : 'Public items still download fine.'}
      </p>
      <div style={{ marginBottom: '24px', maxWidth: '100%' }}>
        <input
          type="password"
          placeholder="logged-in-user=...; logged-in-sig=..."
          value={(settings as unknown as Record<string, string>).iaCookie === '***set***' ? '' : ((settings as unknown as Record<string, string>).iaCookie || '')}
          onChange={(e) => {
            setSettings({ iaCookie: e.target.value } as Partial<typeof settings>);
            addToast('info', e.target.value ? 'archive.org login saved' : 'archive.org login cleared');
          }}
          style={inputStyle}
        />
      </div>

      {/* 4. Backfill */}
      <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>4. Enrich library</h3>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px', maxWidth: '100%' }}>
        Matches every game against RAWG (CUSA-anchored) and saves descriptions, genres, screenshots and trailers locally.
      </p>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
        <label style={{ display: 'flex', gap: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          {(['missing', 'refresh'] as const).map((s) => (
            <label key={s} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="backfill-scope"
                checked={backfillScope === s}
                onChange={() => setBackfillScope(s)}
                disabled={running}
                style={{ accentColor: 'var(--accent)' }}
              />
              {s === 'missing' ? 'Fill missing' : 'Refresh all'}
            </label>
          ))}
        </label>
        {!running ? (
          <button onClick={() => void startBackfill()} disabled={!catalogStatus?.configured} title={catalogStatus?.configured ? 'Enrich the library' : 'Add a catalog source first'} style={btnStyle(true)}>
            Start backfill
          </button>
        ) : (
          <button onClick={() => void cancelBackfill()} style={btnStyle(false)}>
            Cancel
          </button>
        )}
      </div>
      {!catalogStatus?.configured && (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
          Add a catalog source above before enriching.
        </div>
      )}

      {backfill && backfill.status !== 'idle' && (
        <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '6px', padding: '16px', marginBottom: '16px', maxWidth: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            <span>
              {backfill.status === 'running' ? 'Enriching…' : backfill.status === 'done' ? 'Done' : backfill.status === 'cancelled' ? 'Cancelled' : 'Failed'}
              {backfill.current ? ` — ${backfill.current.titleId} ${backfill.current.title}` : ''}
            </span>
            <span>{backfill.done}/{backfill.total} ({pct}%)</span>
          </div>
          <div style={{ height: '8px', borderRadius: '4px', backgroundColor: 'var(--bg-tertiary)', overflow: 'hidden', marginBottom: '8px' }}>
            <div style={{ height: '100%', width: `${pct}%`, backgroundColor: 'var(--accent)', transition: 'width 0.5s ease' }} />
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            exact {backfill.exact} · high {backfill.high} · missed {backfill.missed.length}
            {backfill.error && <span style={{ color: 'var(--error)' }}> · {backfill.error}</span>}
          </div>
          {backfill.missed.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Needs attention ({backfill.missed.length})
              </div>
              <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                {backfill.missed.slice(0, 50).map((m) => {
                  const expanded = expandedId === m.titleId;
                  const cand = candidates[m.titleId];
                  const incumbent = m.rejected?.rawgId ?? null;
                  return (
                    <div key={m.titleId} style={{ padding: '6px 0', borderTop: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <button
                          onClick={() => {
                            if (expanded) {
                              setExpandedId(null);
                            } else {
                              setExpandedId(m.titleId);
                              setManualText('');
                              void fetchCandidates(m.titleId);
                            }
                          }}
                          title={expanded ? 'Collapse' : 'Match manually'}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '12px', textAlign: 'left', padding: 0, flex: 1, minWidth: 0 }}
                        >
                          <span style={{ color: 'var(--accent)', marginRight: '6px' }}>{expanded ? '▾' : '▸'}</span>
                          {m.titleId} · {m.title} <span style={{ color: 'var(--text-muted)' }}>({m.reason})</span>
                        </button>
                        <button
                          onClick={async () => {
                            setRetrying(m.titleId);
                            await retryMiss(m.titleId);
                            setRetrying(null);
                          }}
                          disabled={retrying === m.titleId}
                          style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '12px', marginLeft: '8px' }}
                        >
                          {retrying === m.titleId ? '…' : 'Retry'}
                        </button>
                      </div>
                      {expanded && (
                        <div style={{ marginTop: '8px', marginBottom: '4px', padding: '10px 12px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                          {!cand || cand.loading ? (
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Searching RAWG…</div>
                          ) : cand.error ? (
                            <div style={{ fontSize: '12px', color: 'var(--error)' }}>{cand.error}</div>
                          ) : cand.items.length === 0 ? (
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              No RAWG candidates — paste a slug/id below, or ignore this title.
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                              {cand.items.map((c) => {
                                const isCurrent = incumbent != null && c.rawgId === incumbent;
                                return (
                                  <div key={c.rawgId} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    {c.image ? (
                                      <img src={c.image} alt="" width={48} height={27} loading="lazy" referrerPolicy="no-referrer" style={{ width: '48px', height: '27px', objectFit: 'cover', borderRadius: '3px' }} />
                                    ) : (
                                      <div style={{ width: '48px', height: '27px', borderRadius: '3px', backgroundColor: 'var(--bg-primary)' }} />
                                    )}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {c.name}
                                        {isCurrent && (
                                          <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: 400, color: 'var(--warning)' }}>current pick</span>
                                        )}
                                      </div>
                                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                        {c.released ? c.released.slice(0, 4) + ' · ' : ''}{c.slug || c.rawgId}{c.ps4 ? ' · PS4' : ''}
                                      </div>
                                    </div>
                                    <button
                                      onClick={async () => {
                                        setPinning(`${m.titleId}:${c.rawgId}`);
                                        const ok = await pinMatch(m.titleId, String(c.rawgId));
                                        if (ok) setExpandedId(null);
                                        setPinning(null);
                                      }}
                                      disabled={pinning === `${m.titleId}:${c.rawgId}`}
                                      style={{ background: 'none', border: '1px solid var(--accent)', color: 'var(--accent)', cursor: 'pointer', fontSize: '11px', padding: '3px 10px', borderRadius: '4px' }}
                                    >
                                      {pinning === `${m.titleId}:${c.rawgId}` ? '…' : 'Use this'}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
                            <input
                              placeholder="RAWG slug or id"
                              value={expanded ? manualText : ''}
                              onChange={(e) => setManualText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && manualText.trim()) {
                                  void (async () => {
                                    setPinning(`${m.titleId}:manual`);
                                    const ok = await pinMatch(m.titleId, manualText.trim());
                                    if (ok) { setExpandedId(null); setManualText(''); }
                                    setPinning(null);
                                  })();
                                }
                              }}
                              style={{ ...inputStyle, fontSize: '12px', padding: '5px 8px' }}
                            />
                            <button
                              onClick={() => {
                                if (!manualText.trim()) return;
                                void (async () => {
                                  setPinning(`${m.titleId}:manual`);
                                  const ok = await pinMatch(m.titleId, manualText.trim());
                                  if (ok) { setExpandedId(null); setManualText(''); }
                                  setPinning(null);
                                })();
                              }}
                              disabled={pinning === `${m.titleId}:manual` || !manualText.trim()}
                              style={{ background: 'none', border: '1px solid var(--accent)', color: 'var(--accent)', cursor: 'pointer', fontSize: '11px', padding: '4px 10px', borderRadius: '4px', whiteSpace: 'nowrap' }}
                            >
                              Pin
                            </button>
                            <button
                              onClick={() => {
                                setConfirmDialogMessage(`Ignore ${m.titleId} (${m.title})? It stays out of future enrichment runs.`);
                                setConfirmDialogOnConfirm(() => () => {
                                  void (async () => {
                                    await ignoreMiss(m.titleId, m.title);
                                    if (expandedId === m.titleId) setExpandedId(null);
                                  })();
                                });
                                setConfirmDialogOpen(true);
                              }}
                              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px', marginLeft: 'auto' }}
                            >
                              Ignore
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {backfill.missed.length > 50 && (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>…and {backfill.missed.length - 50} more (see CLI)</div>
                )}
              </div>
            </div>
          )}
          {ignored.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Ignored ({ignored.length})
              </div>
              {ignored.map((g) => (
                <div key={g.titleId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <span>{g.titleId}{g.title ? ` · ${g.title}` : ''}</span>
                  <button
                    onClick={() => void unignoreMiss(g.titleId)}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '12px' }}
                  >
                    Unignore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const { settings, setSettings, settingsCategory, setSettingsCategory, addToast } = useAppStore();
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
        </div>
      </SettingRow>
      <SettingRow label="Create game subfolder" last>
        <Toggle checked={settings.createSubfolder} onChange={() => handleToggle('createSubfolder')} />
      </SettingRow>
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
                value={(settings as any).customExtractDir || ''}
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
      <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px' }}>v0.1.0</p>
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
          onClick={async () => {
            if (!backend) { addToast('info', 'Update check only in desktop app'); return; }
            const info = await tryLive((api) => api.systemCheck());
            addToast(info ? 'success' : 'error', info ? `System OK: yt-dlp ${info.ytdlp?.available ? 'found' : 'missing'}` : 'System check failed');
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
          Check for Updates
        </button>
        <button
          onClick={async () => {
            if (!backend) { addToast('info', 'Logs only in desktop app'); return; }
            await tryLive((api) => api.openFolder());
            addToast('info', 'Opening downloads folder');
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
          Open Logs Folder
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

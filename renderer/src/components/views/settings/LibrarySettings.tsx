import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../../store/appStore';
import { Toggle, inputStyle, btnStyle } from './controls';

export function LibrarySettings() {
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
    settings.rawgApiKey === '***set***' ||
    !!(settings.rawgApiKey || '').trim();

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
          value={settings.rawgApiKey === '***set***' ? '' : (settings.rawgApiKey || '')}
          onChange={(e) => {
            setSettings({ rawgApiKey: e.target.value });
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
        {settings.iaCookie === '***set***' || (settings.iaCookie || '').trim()
          ? 'Cookie is set.'
          : 'Public items still download fine.'}
      </p>
      <div style={{ marginBottom: '24px', maxWidth: '100%' }}>
        <input
          type="password"
          placeholder="logged-in-user=...; logged-in-sig=..."
          value={settings.iaCookie === '***set***' ? '' : (settings.iaCookie || '')}
          onChange={(e) => {
            setSettings({ iaCookie: e.target.value });
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
            exact {backfill.exact} · high {backfill.high}{backfill.review ? ` · review ${backfill.review}` : ''} · missed {backfill.missedTotal ?? backfill.missed.length}
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

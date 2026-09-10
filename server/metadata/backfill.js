/**
 * Backfill job: enrich a whole catalog into the metadata DB with progress.
 * Runs in-process, throttled, resumable (missing-scope skips fresh rows),
 * cancellable. State is pollable for progress bars and persisted to disk.
 */
const fs = require('fs');
const path = require('path');

function dataDir() {
  const dir = require('../../main/settings').getConfigDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

class BackfillJob {
  constructor({ archive, metadata, delayMs = 1200 } = {}) {
    this.archive = archive;
    this.metadata = metadata;
    this.delayMs = delayMs;
    this.statePath = path.join(dataDir(), 'backfill.json');
    this.running = false;
    this.cancelled = false;
    this.state = this._freshState();
    this._loadState();
  }

  _freshState() {
    return {
      status: 'idle', // idle|running|cancelled|done|error
      scope: 'missing',
      total: 0,
      done: 0,
      exact: 0,
      high: 0,
      manual: 0,
      review: 0,
      missed: [],
      missedTotal: 0,
      current: null,
      startedAt: null,
      finishedAt: null,
      error: null,
    };
  }

  /** Bounded miss recording — the list caps, the counter doesn't. */
  _recordMiss(miss) {
    this.state.missedTotal = (this.state.missedTotal || 0) + 1;
    if (this.state.missed.length < 500) this.state.missed.push(miss);
  }

  _loadState() {
    try {
      if (fs.existsSync(this.statePath)) {
        const s = JSON.parse(fs.readFileSync(this.statePath, 'utf8'));
        if (s && typeof s === 'object' && s.status !== 'running') this.state = { ...this._freshState(), ...s };
      }
    } catch {
      /* ignore */
    }
  }

  _persist() {
    try {
      fs.writeFileSync(this.statePath, JSON.stringify(this.state));
    } catch {
      /* ignore */
    }
  }

  snapshot() {
    let enriched = 0;
    try {
      enriched = this.metadata.stats(this.archive.games.length).enriched;
    } catch {
      /* ignore */
    }
    return { ...this.state, enrichedTotal: enriched, catalogTotal: this.archive.games.length };
  }

  cancel() {
    if (this.running) this.cancelled = true;
    return this.snapshot();
  }

  async start(scope = 'missing') {
    if (this.running) return this.snapshot();
    if (!['missing', 'refresh'].includes(scope)) throw new Error('scope must be missing|refresh');

    await this.archive.ensure().catch(() => {});
    if (!this.archive.games.length) {
      this.state = { ...this._freshState(), status: 'error', error: 'No catalog loaded — paste a games.json URL first (Settings → Library).' };
      this._persist();
      return this.snapshot();
    }
    if (!this.metadata.rawg.configured) {
      this.state = { ...this._freshState(), status: 'error', error: 'No RAWG API key — paste one in Settings → Library first.' };
      this._persist();
      return this.snapshot();
    }

    // unique CUSAs, keep first-seen title
    const seen = new Map();
    for (const g of this.archive.games) {
      const id = String(g.titleId || '').toUpperCase();
      if (/^CUSA\d{5}$/.test(id) && !seen.has(id)) seen.set(id, g.title);
    }
    let targets = [...seen.entries()];
    if (scope === 'missing') {
      targets = targets.filter(([id]) => !this.metadata.getCached(id));
    }
    // ignored titles never enter the run (no attempt, no miss row)
    targets = targets.filter(([id]) => !this.metadata.isIgnored(id));

    this.running = true;
    this.cancelled = false;
    this.state = {
      ...this._freshState(),
      status: 'running',
      scope,
      total: targets.length,
      startedAt: new Date().toISOString(),
    };
    this._persist();

    // fire-and-forget: routes poll snapshot()
    void this._run(targets);
    return this.snapshot();
  }

  async _run(targets) {
    try {
      for (const [id, title] of targets) {
        if (this.cancelled) break;
        this.state.current = { titleId: id, title };
        let meta = null;
        try {
          meta = await this.metadata.get(id, title);
        } catch (e) {
          this._recordMiss({ titleId: id, title, reason: e.message || 'error' });
        }
        if (meta && (meta.confidence === 'low' || meta.confidence === 'high')) {
          // Bulk runs never keep shaky matches — quarantine for manual review.
          // (Single-game flows still persist; the bulk run must not cement guesses.)
          // keep the rejected pick so the UI can show the incumbent.
          const rejected = { rawgId: meta.rawgId ?? null, slug: meta.rawgSlug ?? null, name: meta.name || '' };
          this.metadata.remove(id);
          this.state.review = (this.state.review || 0) + 1;
          this._recordMiss({ titleId: id, title, reason: 'needs review — verify manually', rejected });
        } else if (meta) {
          if (meta.confidence === 'exact') this.state.exact++;
          else if (meta.confidence === 'manual') this.state.manual++;
          else this.state.high++;
        } else {
          this._recordMiss({ titleId: id, title, reason: 'no RAWG match' });
        }
        this.state.done++;
        if (this.state.done % 5 === 0) this._persist();
        await new Promise((r) => setTimeout(r, this.delayMs));
      }
    } finally {
      this.state.status = this.cancelled ? 'cancelled' : 'done';
      this.state.finishedAt = new Date().toISOString();
      this.state.current = null;
      this.running = false;
      this._persist();
      console.error(
        `[backfill] ${this.state.status}: ${this.state.done}/${this.state.total} (exact ${this.state.exact}, high ${this.state.high}, review ${this.state.review || 0}, missed ${this.state.missedTotal || this.state.missed.length})`
      );
    }
  }
}

module.exports = { BackfillJob };

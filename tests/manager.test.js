const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { DownloadManager } = require('../main/downloader/manager');

function makeManager(maxConcurrent = 2) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ps4dl-mgr-'));
  return new DownloadManager({ downloadDir: dir, maxConcurrent, retryCount: 1, retryDelay: 10 });
}

const inv = (mgr, max) => {
  assert.equal(mgr.activeCount, mgr.activeIds.size, 'activeCount tracks activeIds');
  assert.ok(mgr.activeCount <= max, 'never over concurrency limit');
};

test('slot accounting: pause frees, resume re-queues when full, no duplicates', async () => {
  const mgr = makeManager(1);
  const events = [];
  mgr.on('download:paused', (d) => events.push(['paused', d.id]));
  mgr.on('download:cancelled', (d) => events.push(['cancelled', d.id]));

  // restorePaused never touches the network and never takes a slot
  const a = mgr.restorePaused({ url: 'https://x/a.pkg', destination: os.tmpdir(), label: 'a' });
  const b = mgr.restorePaused({ url: 'https://x/b.pkg', destination: os.tmpdir(), label: 'b' });
  inv(mgr, 1);
  assert.equal(mgr.downloads.get(a).state, 'paused');

  // resume() with a free slot would call engine.resume() -> start() -> network;
  // instead verify the full-slot path: occupy the slot, then resume must re-queue
  mgr._acquire('slot-holder');
  try {
    assert.equal(await mgr.resume(a), true);
    assert.ok(mgr.queue.some((q) => q.engine.id === a), 're-queued while full');
    assert.equal(await mgr.resume(a), true, 'second resume idempotent');
    assert.equal(mgr.queue.filter((q) => q.engine.id === a).length, 1, 'no duplicate queue entry');
  } finally {
    mgr._release('slot-holder');
  }
  inv(mgr, 1);
});

test('findByUrl locates live engines; removeCompleted purges by id', () => {
  const mgr = makeManager(2);
  const a = mgr.restorePaused({ url: 'https://x/a.pkg', destination: os.tmpdir(), label: 'a' });
  assert.equal(mgr.findByUrl('https://x/a.pkg').id, a);
  assert.equal(mgr.findByUrl('https://x/missing.pkg'), null);
  mgr.completed.push({ id: a });
  assert.equal(mgr.removeCompleted(a), 1);
  assert.equal(mgr.removeCompleted(a), 0);
});

test('restoreCompleted is idempotent and skips bad rows', () => {
  const mgr = makeManager(2);
  const rows = [{ id: 'h1' }, { id: 'h1' }, null, {}, { id: 'h2' }];
  assert.equal(mgr.restoreCompleted(rows), 2);
  assert.equal(mgr.restoreCompleted(rows), 0);
});

test('cancel of idle engine emits for persistence without slot math', async () => {
  const mgr = makeManager(1);
  const events = [];
  mgr.on('download:cancelled', (d) => events.push(d.id));
  const a = mgr.restorePaused({ url: 'https://x/a.pkg', destination: os.tmpdir(), label: 'a' });
  assert.equal(await mgr.cancel(a, false), true);
  assert.equal(mgr.downloads.get(a).state, 'cancelled');
  assert.deepEqual(events, [a]);
  inv(mgr, 1);
});

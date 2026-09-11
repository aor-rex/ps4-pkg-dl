const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { SettingsManager, getConfigDir, ensureConfigDir } = require('../main/settings');

function fakeHome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ps4dl-test-'));
  process.env.HOME = dir;
  delete process.env.XDG_CONFIG_HOME;
  return dir;
}

test('getConfigDir respects XDG_CONFIG_HOME', () => {
  const home = fakeHome();
  process.env.XDG_CONFIG_HOME = path.join(home, 'xdg');
  assert.equal(getConfigDir(), path.join(home, 'xdg', 'ps4-pkg-dl'));
  delete process.env.XDG_CONFIG_HOME;
});

test('ensureConfigDir migrates legacy dir once and never overwrites', () => {
  const home = fakeHome();
  const legacy = path.join(home, '.ps4-pkg-dl');
  fs.mkdirSync(legacy, { recursive: true });
  fs.writeFileSync(path.join(legacy, 'settings.json'), '{"a":1}');
  const target = ensureConfigDir();
  assert.equal(target, path.join(home, '.config', 'ps4-pkg-dl'));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(target, 'settings.json'), 'utf8')), { a: 1 });
  assert.deepEqual(fs.readdirSync(legacy), []);
  // second run is a no-op (target non-empty now)
  fs.writeFileSync(path.join(legacy, 'evil.json'), '{}');
  ensureConfigDir();
  assert.ok(!fs.existsSync(path.join(target, 'evil.json')));
});

test('SettingsManager round-trips settings in isolated dir', () => {
  const home = fakeHome();
  const m = new SettingsManager();
  assert.equal(m.configDir, path.join(home, '.config', 'ps4-pkg-dl'));
  m.set('maxConcurrentDownloads', 4);
  const m2 = new SettingsManager();
  m2.load();
  assert.equal(m2.get('maxConcurrentDownloads'), 4);
  const persisted = JSON.parse(fs.readFileSync(path.join(m.configDir, 'settings.json'), 'utf8'));
  assert.equal(persisted.maxConcurrentDownloads, 4);
});

test('SettingsManager honors custom configDir without touching real dirs', () => {
  const home = fakeHome();
  const custom = path.join(home, 'custom');
  const m = new SettingsManager({ configDir: custom });
  m.set('soundAlert', true);
  assert.ok(fs.existsSync(path.join(custom, 'settings.json')));
  assert.ok(!fs.existsSync(path.join(home, '.config', 'ps4-pkg-dl', 'settings.json')));
});

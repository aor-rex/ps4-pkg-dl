#!/usr/bin/env node
/** Standalone API server entry: `npm run server` / `node src/server/index.js` */
const { bootstrapContext } = require('./context');
const { createApp } = require('./app');

const ctx = bootstrapContext();
const port = parseInt(process.env.PORT || ctx.settings.get('apiPort') || '3100', 10);

// Warm the catalog in the background (non-blocking boot)
ctx.archive.ensure().catch((err) => console.error(`[server] catalog warmup failed: ${err.message}`));

createApp(ctx).listen(port, () => {
  console.log(`ps4-pkg-dl API listening on http://localhost:${port}`);
  console.log(`catalog: ${ctx.archive.catalogUrl}`);
});

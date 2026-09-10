#!/usr/bin/env node
/**
 * Idle express server for the JavaScript launch smoke tests (issue #678).
 *
 * Unlike express_selfcall.js this server never sends itself a request and
 * never exits: the test drives it, so a step or pause that js-debug swallows
 * stays observable as `pending: true` instead of being ended by the process
 * exiting. Prints `listening <port>` on stdout once ready.
 *
 * A breakpoint set inside express — through the top-level `node_modules/express`
 * path, which pnpm makes a symlink to the real package — fires on every request.
 */
import express from 'express';

const app = express();
app.get('/ping', (req, res) => {
  res.json({ ok: true });
});

const server = app.listen(0, '127.0.0.1', () => {
  console.log(`listening ${server.address().port}`);
});

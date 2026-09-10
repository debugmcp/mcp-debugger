#!/usr/bin/env node
/**
 * Dependency-breakpoint fixture for the JavaScript smoke tests (issue #673).
 *
 * Starts an express app, sends itself one request, and exits. A breakpoint
 * set inside express — through the top-level `node_modules/express` path,
 * which pnpm makes a symlink to the real package — fires on that request.
 * js-debug never sends a `breakpoint` event for such a location; the stop
 * that names the breakpoint's id is the only proof it bound.
 */
import express from 'express';
import http from 'node:http';

const app = express();
app.get('/ping', (req, res) => {
  res.json({ ok: true });
});

const server = app.listen(0, '127.0.0.1', () => {
  const { port } = server.address();
  http.get(`http://127.0.0.1:${port}/ping`, (res) => {
    res.resume();
    res.on('end', () => {
      console.log('self-call done');
      server.close();
    });
  });
});

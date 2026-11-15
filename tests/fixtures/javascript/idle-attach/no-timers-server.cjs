/**
 * Attach target for issue #1146: an idle HTTP server on which a debugger's
 * pause cannot be made to land.
 *
 * Started as: node --inspect=127.0.0.1:<port> no-timers-server.cjs
 *
 * Like examples/javascript/idle_server_attach_target.js it runs no code
 * between requests. Unlike it, it replaces the global `setTimeout` once it is
 * listening, the way a fake-timer library does. The debugger gives an idle
 * program something to run before it pauses it by scheduling a timer; here
 * that timer never fires, so the pause stays pending until a request
 * arrives. That is the state in which breakpoint requests must wait.
 *
 * Prints `listening <port>` on stdout once ready. GET /work runs a small loop
 * in application code and responds with the result; any other path responds
 * 200 "ok".
 */
const http = require('http');

function doWork() {
  let total = 0;
  for (let i = 0; i < 1000; i++) {
    total += i * i;
  }
  return total;
}

const server = http.createServer((req, res) => {
  if (req.url === '/work') {
    const total = doWork(); // BREAK-HERE
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`work done: ${total}\n`);
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('ok\n');
});

server.listen(0, '127.0.0.1', () => {
  console.log(`listening ${server.address().port}`);
  globalThis.setTimeout = () => ({ unref() {} });
});

/**
 * Idle-server attach target for the JavaScript attach smoke tests (issue #513).
 *
 * Started as: node --inspect=127.0.0.1:<port> idle_server_attach_target.js
 *
 * A minimal HTTP server with NO timers and no background work: between
 * requests the event loop is completely idle, so no JavaScript executes at
 * all. That is the state in which a debugger pause has nothing to land on
 * until the next request arrives — the exact repro for pause_execution
 * hanging forever on an attached idle server (issue #513). Contrast with
 * attach_target.js, which ticks every 100ms and is therefore never idle.
 *
 * Prints `listening <port>` on stdout once ready. GET /work runs a small
 * loop in application code and responds with the result; any other path
 * responds 200 "ok".
 */
import http from 'http';

function doWork() {
  let total = 0;
  for (let i = 0; i < 1000; i++) {
    total += i * i;
  }
  return total;
}

const server = http.createServer((req, res) => {
  if (req.url === '/work') {
    const total = doWork();
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`work done: ${total}\n`);
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('ok\n');
});

server.listen(0, '127.0.0.1', () => {
  console.log(`listening ${server.address().port}`);
});

import fs from 'fs';
import net from 'net';
import process from 'process';

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) {
      throw new Error(`Expected --name value arguments, got: ${argv.join(' ')}`);
    }
    values[key.slice(2)] = value;
  }
  return values;
}

function encodeMessage(message) {
  const json = JSON.stringify(message);
  return Buffer.from(`Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`, 'utf8');
}

function defaultResponseBody(request) {
  switch (request.command) {
    case 'initialize':
      return { supportsConfigurationDoneRequest: true };
    case 'setBreakpoints':
      return {
        breakpoints: (request.arguments?.breakpoints ?? []).map(() => ({ verified: true }))
      };
    case 'threads':
      return { threads: [{ id: 1, name: 'adversarial-thread' }] };
    case 'stackTrace':
      return { stackFrames: [], totalFrames: 0 };
    case 'scopes':
      return { scopes: [] };
    case 'variables':
      return { variables: [] };
    default:
      return {};
  }
}

function normalizeEvents(value) {
  if (value === undefined) return [];
  const values = Array.isArray(value) ? value : [value];
  return values.map(event => typeof event === 'string' ? { event } : event);
}

function createRequestDecoder(onRequest) {
  let buffer = Buffer.alloc(0);
  return chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    for (;;) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd < 0) return;
      const header = buffer.subarray(0, headerEnd).toString('utf8');
      const match = /(?:^|\r\n)Content-Length:\s*(\d+)/i.exec(header);
      if (!match) throw new Error(`Missing Content-Length header: ${header}`);
      const length = Number(match[1]);
      const bodyStart = headerEnd + 4;
      if (buffer.length < bodyStart + length) return;
      const body = buffer.subarray(bodyStart, bodyStart + length).toString('utf8');
      buffer = buffer.subarray(bodyStart + length);
      onRequest(JSON.parse(body));
    }
  };
}

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const args = parseArguments(process.argv.slice(2));
if (!args.port || !args.scenario) throw new Error('Usage: server.mjs --port <port> --scenario <file>');

const scenario = JSON.parse(fs.readFileSync(args.scenario, 'utf8'));
const host = args.host ?? scenario.host ?? '127.0.0.1';
const port = Number(args.port);
let sequence = 1;
const sockets = new Set();

async function write(socket, bytes) {
  if (socket.destroyed) return;
  await new Promise((resolve, reject) => {
    socket.write(bytes, error => error ? reject(error) : resolve());
  });
}

async function sendEvents(socket, specs) {
  for (const spec of normalizeEvents(specs)) {
    if (spec.delayMs) await sleep(spec.delayMs);
    await write(socket, encodeMessage({
      seq: sequence++,
      type: 'event',
      event: spec.event,
      body: spec.body ?? {}
    }));
  }
}

async function handleRequest(socket, request) {
  if (request.type !== 'request') return;
  const rules = scenario.commands ?? scenario;
  const rule = rules[request.command] ?? rules['*'] ?? {};
  if (rule.delayMs) await sleep(rule.delayMs);

  const beforeEvents = rule.eventsBeforeResponse ?? rule.eventsBefore ?? rule.sendEvent;
  await sendEvents(socket, beforeEvents);

  if (rule.close === 'before-response') {
    socket.destroy();
    return;
  }

  if (!rule.dropResponse) {
    const response = {
      seq: sequence++,
      type: 'response',
      request_seq: request.seq,
      command: request.command,
      success: rule.success ?? true,
      ...(rule.message === undefined ? {} : { message: rule.message }),
      body: rule.body ?? defaultResponseBody(request)
    };
    const encoded = encodeMessage(response);

    const junk = rule.junkPrefix;

    if (rule.close === 'mid-response') {
      const byteCount = Math.max(1, Math.min(encoded.length - 1, rule.closeAfterBytes ?? 12));
      await write(socket, encoded.subarray(0, byteCount));
      socket.destroy();
      return;
    }

    const responseBytes = junk === undefined
      ? encoded
      : Buffer.concat([
          Array.isArray(junk) ? Buffer.from(junk) : Buffer.from(String(junk), 'utf8'),
          encoded
        ]);
    await write(socket, responseBytes);
    if (rule.duplicateResponse) await write(socket, encoded);

    if (rule.close === 'after-response') {
      socket.destroy();
      return;
    }
  }

  const afterEvents = rule.eventsAfterResponse ?? rule.eventsAfter;
  await sendEvents(socket, afterEvents);
}

if (scenario.neverListen) {
  process.stderr.write(`[adversarial-adapter] intentionally not listening on ${host}:${port}\n`);
  const keepAlive = setInterval(() => {}, 1000);
  const shutdown = () => {
    clearInterval(keepAlive);
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
} else {
  if (scenario.listenDelayMs) await sleep(scenario.listenDelayMs);
  const server = net.createServer(socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
    if (scenario.closeOnConnect) {
      socket.destroy();
      return;
    }
    const decode = createRequestDecoder(request => {
      void handleRequest(socket, request).catch(error => {
        process.stderr.write(`[adversarial-adapter] ${error.stack ?? error}\n`);
        socket.destroy();
      });
    });
    socket.on('data', chunk => {
      try {
        decode(chunk);
      } catch (error) {
        process.stderr.write(`[adversarial-adapter] ${error.stack ?? error}\n`);
        socket.destroy();
      }
    });
  });
  server.on('error', error => {
    process.stderr.write(`[adversarial-adapter] server error: ${error.stack ?? error}\n`);
    process.exitCode = 1;
  });
  server.listen(port, host, () => {
    process.stderr.write(`[adversarial-adapter] listening on ${host}:${port}\n`);
  });

  const shutdown = () => {
    for (const socket of sockets) socket.destroy();
    server.close(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

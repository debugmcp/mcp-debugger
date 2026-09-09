import { describe, it, expect, vi } from 'vitest';
import {
  AllowedHostError,
  hostAllowlistMiddleware,
  parseAllowedHosts,
} from '../../../src/cli/host-allowlist.js';
import { invokeMiddleware } from '../../test-utils/mocks/express-stubs.js';

const LOOPBACK = ['localhost', '127.0.0.1', '[::1]'];

describe('parseAllowedHosts', () => {
  it('is exactly the loopback trio when nothing is configured', () => {
    expect(parseAllowedHosts(undefined, undefined)).toEqual({ hosts: LOOPBACK, warnings: [] });
    expect(parseAllowedHosts([], '')).toEqual({ hosts: LOOPBACK, warnings: [] });
  });

  it('appends a --allowed-host value after the loopback trio', () => {
    expect(parseAllowedHosts(['mcp-debugger'], undefined).hosts).toEqual([...LOOPBACK, 'mcp-debugger']);
  });

  it('splits the env value on commas, trimming and dropping empty segments', () => {
    expect(parseAllowedHosts(undefined, ' a.example, b.example ,,').hosts).toEqual([
      ...LOOPBACK,
      'a.example',
      'b.example',
    ]);
  });

  it('merges flag and env values, case-folded and de-duplicated against each other and the loopback trio', () => {
    const { hosts, warnings } = parseAllowedHosts(['API.Example'], 'api.example,localhost,LOCALHOST');
    expect(hosts).toEqual([...LOOPBACK, 'api.example']);
    expect(warnings).toEqual([]);
  });

  it('accepts a host:port entry as the bare host and warns that the port is ignored', () => {
    const { hosts, warnings } = parseAllowedHosts(['mcp-debugger:3000'], undefined);
    expect(hosts).toEqual([...LOOPBACK, 'mcp-debugger']);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('mcp-debugger:3000');
    expect(warnings[0]).toContain('port');
  });

  it('accepts a bracketed IPv6 literal and keeps the brackets', () => {
    expect(parseAllowedHosts(['[fd00::5]'], undefined).hosts).toEqual([...LOOPBACK, '[fd00::5]']);
  });

  it('splits a comma-separated --allowed-host value too, since the env var invites that shape', () => {
    expect(parseAllowedHosts(['a.example,b.example'], undefined).hosts).toEqual([...LOOPBACK, 'a.example', 'b.example']);
  });

  it('rejects an entry the URL parser would silently rewrite into a different host, naming what it became', () => {
    const cases: Array<[string, string]> = [
      ['3001', '0.0.11.185'],
      ['192.168.1', '192.168.0.1'],
      ['evil@localhost', 'localhost'],
      ['host?x', 'host'],
      ['bücher.example', 'xn--bcher-kva.example'],
    ];
    for (const [entry, canonical] of cases) {
      let error: unknown;
      try {
        parseAllowedHosts([entry], undefined);
      } catch (err) {
        error = err;
      }
      expect(error, entry).toBeInstanceOf(AllowedHostError);
      expect((error as Error).message, entry).toContain(canonical);
    }
  });

  it('rejects characters that can never appear in a Host header, so a wildcard pattern cannot masquerade as a hostname', () => {
    for (const entry of ['*.example', 'a.example;b.example', 'a=b.example', 'under_score.example']) {
      expect(() => parseAllowedHosts([entry], undefined), entry).toThrow(AllowedHostError);
    }
  });

  it('explains that a zone id cannot appear in a Host header', () => {
    let error: unknown;
    try {
      parseAllowedHosts(['[fe80::1%eth0]'], undefined);
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(AllowedHostError);
    expect((error as Error).message).toContain('zone');
  });

  it('rejects a URL instead of silently accepting its scheme as the hostname', () => {
    expect(() => parseAllowedHosts(['http://mcp-debugger'], undefined)).toThrow(AllowedHostError);
    expect(() => parseAllowedHosts(['mcp-debugger/mcp'], undefined)).toThrow(AllowedHostError);
  });

  it('rejects a wildcard', () => {
    expect(() => parseAllowedHosts(['*'], undefined)).toThrow(AllowedHostError);
  });

  it('rejects a bare IPv6 literal and points at the bracket form', () => {
    let error: unknown;
    try {
      parseAllowedHosts(['fd00::5'], undefined);
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(AllowedHostError);
    expect((error as Error).message).toContain('[fd00::5]');
  });

  it('names the offending entry and its source in the error', () => {
    let error: unknown;
    try {
      parseAllowedHosts(undefined, 'ok.example,http://bad.example');
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(AllowedHostError);
    const typed = error as AllowedHostError;
    expect(typed.entry).toBe('http://bad.example');
    expect(typed.source).toBe('MCP_HTTP_ALLOWED_HOSTS');
    expect(typed.message).toContain('http://bad.example');
    expect(typed.message).toContain('MCP_HTTP_ALLOWED_HOSTS');

    try {
      parseAllowedHosts(['http://bad.example'], undefined);
    } catch (err) {
      error = err;
    }
    expect((error as AllowedHostError).source).toBe('--allowed-host');
  });
});

describe('hostAllowlistMiddleware', () => {
  function run(hostHeader: string | undefined, allowed: string[], logger = { warn: vi.fn() }) {
    const headers: Record<string, string> = hostHeader === undefined ? {} : { host: hostHeader };
    return { ...invokeMiddleware(hostAllowlistMiddleware(allowed, logger), { headers }), logger };
  }

  it('answers 403 with a JSON-RPC error when the Host header is missing', () => {
    const { res, json, next } = run(undefined, LOOPBACK);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Missing Host header' },
      id: null,
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('answers 403 for an unparsable Host header', () => {
    const { res, json, next } = run('bad host', LOOPBACK);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(json.mock.calls[0][0].error.message).toBe('Invalid Host header: bad host');
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a foreign Host with a message that names the host, the allowlist, and both opt-in paths', () => {
    const { res, json, next } = run('mcp-debugger:3000', LOOPBACK);
    expect(res.status).toHaveBeenCalledWith(403);
    const body = json.mock.calls[0][0];
    expect(body.jsonrpc).toBe('2.0');
    expect(body.id).toBeNull();
    expect(body.error.code).toBe(-32000);
    expect(body.error.message.startsWith('Invalid Host: mcp-debugger')).toBe(true);
    expect(body.error.message).toContain('localhost, 127.0.0.1, [::1]');
    expect(body.error.message).toContain('--allowed-host mcp-debugger');
    expect(body.error.message).toContain('MCP_HTTP_ALLOWED_HOSTS=mcp-debugger');
    expect(next).not.toHaveBeenCalled();
  });

  it('passes a loopback Host through, with or without a port', () => {
    for (const host of ['localhost', 'localhost:3111', '127.0.0.1:3001', '[::1]:3001']) {
      const { res, next } = run(host, LOOPBACK);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    }
  });

  it('passes an allowlisted Host through case-insensitively', () => {
    const { res, next } = run('MCP-Debugger:3000', [...LOOPBACK, 'mcp-debugger']);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('logs one warning per distinct rejected hostname, not per request', () => {
    const logger = { warn: vi.fn() };
    const middleware = hostAllowlistMiddleware(LOOPBACK, logger);
    const call = (host: string) => invokeMiddleware(middleware, { headers: { host } });
    call('evil.example');
    call('evil.example:8080');
    call('other.example');
    expect(logger.warn).toHaveBeenCalledTimes(2);
    expect(logger.warn.mock.calls[0][0]).toContain('evil.example');
    expect(logger.warn.mock.calls[1][0]).toContain('other.example');
  });

  it('logs the same remedy text the 403 body carries, so log and client never disagree', () => {
    const logger = { warn: vi.fn() };
    const { json } = run('evil.example', LOOPBACK, logger);
    const body = json.mock.calls[0][0].error.message as string;
    expect(logger.warn.mock.calls[0][0]).toContain(body);
  });

  it('stops logging new hostnames after 50 distinct rejections so a scanner cannot grow the log', () => {
    const logger = { warn: vi.fn() };
    const middleware = hostAllowlistMiddleware(LOOPBACK, logger);
    for (let i = 0; i < 60; i++) {
      invokeMiddleware(middleware, { headers: { host: `scan-${i}.example` } });
    }
    // 50 hostnames, then one notice that the cap was reached — never silence without saying so.
    expect(logger.warn).toHaveBeenCalledTimes(51);
    expect(logger.warn.mock.calls[50][0]).toMatch(/no further rejected hostnames will be logged/i);
  });

  describe('Origin validation (browser cross-origin requests)', () => {
    function runOrigin(origin: string | undefined, allowed: string[]) {
      const headers: Record<string, string> = { host: 'localhost:3001' };
      if (origin !== undefined) headers.origin = origin;
      return invokeMiddleware(hostAllowlistMiddleware(allowed, { warn: vi.fn() }), { headers });
    }

    it('passes a request with no Origin header (every non-browser client)', () => {
      const { next, res } = runOrigin(undefined, LOOPBACK);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('passes a browser request whose Origin host is allowlisted, port ignored', () => {
      for (const origin of ['http://localhost:6274', 'http://127.0.0.1', 'https://mcp-debugger:8443']) {
        const { next, res } = runOrigin(origin, [...LOOPBACK, 'mcp-debugger']);
        expect(next, origin).toHaveBeenCalledTimes(1);
        expect(res.status, origin).not.toHaveBeenCalled();
      }
    });

    it('refuses a browser request from a foreign Origin even when Host is loopback, naming the remedy', () => {
      const { json, res, next } = runOrigin('https://evil.example', LOOPBACK);
      expect(res.status).toHaveBeenCalledWith(403);
      const message = json.mock.calls[0][0].error.message as string;
      expect(message.startsWith('Invalid Origin: https://evil.example')).toBe(true);
      expect(message).toContain('--allowed-host evil.example');
      expect(next).not.toHaveBeenCalled();
    });

    it('refuses the opaque "null" Origin and an unparsable one', () => {
      for (const origin of ['null', 'not a url']) {
        const { res, next } = runOrigin(origin, LOOPBACK);
        expect(res.status, origin).toHaveBeenCalledWith(403);
        expect(next, origin).not.toHaveBeenCalled();
      }
    });
  });
});

import { describe, it, expect } from 'vitest';
import {
  BIND_ENV_KEY,
  BIND_FLAG,
  BindAddressError,
  DEFAULT_BIND_ADDRESS,
  bindOption,
  bindNotice,
  describeEndpoint,
  describeListenError,
  isLoopbackAddress,
  isUnspecifiedAddress,
  resolveBindAddress,
  type ResolvedBindAddress
} from '../../../src/cli/bind-address.js';

describe('bind-address (issue #680)', () => {
  describe('resolveBindAddress', () => {
    it('defaults to loopback when neither the flag nor the variable is set', () => {
      expect(resolveBindAddress(undefined, {})).toEqual({ address: '127.0.0.1', source: 'default' });
      expect(DEFAULT_BIND_ADDRESS).toBe('127.0.0.1');
    });

    it('takes the flag over the variable, and the variable over the default, naming the knob that won', () => {
      expect(resolveBindAddress('0.0.0.0', { [BIND_ENV_KEY]: '10.0.0.5' })).toEqual({
        address: '0.0.0.0',
        source: 'flag',
        origin: '--bind'
      });
      expect(resolveBindAddress(undefined, { [BIND_ENV_KEY]: '10.0.0.5' })).toEqual({
        address: '10.0.0.5',
        source: 'env',
        origin: 'MCP_HTTP_BIND'
      });
    });

    it('trims whitespace and unbrackets IPv6 literals', () => {
      expect(resolveBindAddress(' 0.0.0.0 ', {})).toEqual({ address: '0.0.0.0', source: 'flag', origin: BIND_FLAG });
      expect(resolveBindAddress('[::1]', {})).toEqual({ address: '::1', source: 'flag', origin: BIND_FLAG });
      expect(resolveBindAddress(undefined, { [BIND_ENV_KEY]: '::' })).toEqual({ address: '::', source: 'env', origin: BIND_ENV_KEY });
    });

    it('normalizes localhost to 127.0.0.1 with a note naming the source', () => {
      const fromFlag = resolveBindAddress('localhost', {});
      expect(fromFlag.address).toBe('127.0.0.1');
      expect(fromFlag.source).toBe('flag');
      expect(fromFlag.origin).toBe(BIND_FLAG);
      expect(fromFlag.note).toContain(BIND_FLAG);
      expect(fromFlag.note).toContain('127.0.0.1');

      const fromEnv = resolveBindAddress(undefined, { [BIND_ENV_KEY]: 'LOCALHOST' });
      expect(fromEnv.address).toBe('127.0.0.1');
      expect(fromEnv.note).toContain(BIND_ENV_KEY);
    });

    it('refuses an empty or blank value, naming the source', () => {
      expect(() => resolveBindAddress('', {})).toThrow(BindAddressError);
      expect(() => resolveBindAddress('   ', {})).toThrow(/--bind is empty/);
      expect(() => resolveBindAddress(undefined, { [BIND_ENV_KEY]: '' })).toThrow(/MCP_HTTP_BIND is empty/);
    });

    it('refuses hostnames and URLs with a remedy, rather than binding through DNS', () => {
      expect(() => resolveBindAddress('myhost', {})).toThrow(/--bind value 'myhost' is not an IP address/);
      expect(() => resolveBindAddress('http://0.0.0.0', {})).toThrow(BindAddressError);
      expect(() => resolveBindAddress(undefined, { [BIND_ENV_KEY]: 'mcp-debugger' })).toThrow(/MCP_HTTP_BIND value 'mcp-debugger'/);
      expect(() => resolveBindAddress('0.0.0.0:3001', {})).toThrow(/not an IP address/);
    });

    it('refuses an IPv6 literal carrying a zone id, which neither a Host header nor a URL can carry', () => {
      // net.isIP accepts fe80::1%eth0, so this needs its own check.
      expect(() => resolveBindAddress('fe80::1%eth0', {})).toThrow(BindAddressError);
      expect(() => resolveBindAddress('fe80::1%eth0', {})).toThrow(/zone id/);
      expect(() => resolveBindAddress('[fe80::1%12]', {})).toThrow(/--bind value '\[fe80::1%12\]'/);
      expect(() => resolveBindAddress(undefined, { [BIND_ENV_KEY]: 'fe80::1%eth0' })).toThrow(/MCP_HTTP_BIND value/);
    });
  });

  describe('isLoopbackAddress', () => {
    it('recognises 127/8, ::1 and their mapped forms', () => {
      for (const address of [
        '127.0.0.1', '127.1.2.3', '::1', '[::1]',
        '::ffff:127.0.0.1', '::FFFF:127.0.0.1',
        // The hex spelling Node's URL parser and some resolvers produce for the same address.
        '::ffff:7f00:1', '::FFFF:7F00:1', '[::ffff:7f00:1]', '::ffff:7f01:203'
      ]) {
        expect(isLoopbackAddress(address), address).toBe(true);
      }
    });

    it('rejects everything else, the unspecified addresses included', () => {
      for (const address of ['0.0.0.0', '::', '10.0.0.5', '192.168.1.20', 'fe80::1', '128.0.0.1', '::ffff:10.0.0.1', '::ffff:a00:1', '::ffff:7f00']) {
        expect(isLoopbackAddress(address), address).toBe(false);
      }
    });
  });

  describe('isUnspecifiedAddress', () => {
    it('is true only for 0.0.0.0 and ::', () => {
      expect(isUnspecifiedAddress('0.0.0.0')).toBe(true);
      expect(isUnspecifiedAddress('::')).toBe(true);
      expect(isUnspecifiedAddress('[::]')).toBe(true);
      expect(isUnspecifiedAddress('127.0.0.1')).toBe(false);
      expect(isUnspecifiedAddress('::1')).toBe(false);
    });
  });

  describe('describeEndpoint', () => {
    it('prints a connectable loopback URL for an unspecified bind and says every interface is bound', () => {
      expect(describeEndpoint('0.0.0.0', 3001, '/mcp')).toBe('http://127.0.0.1:3001/mcp (bound to all interfaces: 0.0.0.0)');
      expect(describeEndpoint('::', 3001, '/sse')).toBe('http://127.0.0.1:3001/sse (bound to all interfaces: ::)');
    });

    it('prints the bound address otherwise, bracketing IPv6', () => {
      expect(describeEndpoint('127.0.0.1', 4000, '/mcp')).toBe('http://127.0.0.1:4000/mcp');
      expect(describeEndpoint('10.0.0.5', 3001, '/mcp')).toBe('http://10.0.0.5:3001/mcp');
      expect(describeEndpoint('::1', 3001, '/mcp')).toBe('http://[::1]:3001/mcp');
      expect(describeEndpoint('[fe80::1]', 3001, '/mcp')).toBe('http://[fe80::1]:3001/mcp');
    });
  });

  describe('bindNotice', () => {
    const flag = (address: string): ResolvedBindAddress => ({ address, source: 'flag', origin: BIND_FLAG });
    const env = (address: string): ResolvedBindAddress => ({ address, source: 'env', origin: BIND_ENV_KEY });

    it('says nothing for a loopback address the allowlist already accepts', () => {
      expect(bindNotice({ address: '127.0.0.1', source: 'default' }, {})).toBeUndefined();
      expect(bindNotice(flag('127.0.0.1'), {})).toBeUndefined();
      expect(bindNotice(env('::1'), {})).toBeUndefined();
    });

    it('tells the operator which --allowed-host entry a non-canonical loopback bind needs, at info level', () => {
      // 127.0.0.2 is still loopback-only, but a client dialing it sends Host: 127.0.0.2, which the trio rejects.
      const notice = bindNotice(flag('127.0.0.2'), {});
      expect(notice?.level).toBe('info');
      expect(notice?.message).toContain('127.0.0.2');
      expect(notice?.message).toContain('--allowed-host 127.0.0.2');
      expect(notice?.message).not.toContain('reachable from other machines');
      // The hex-mapped loopback is reported in the bracketed form the allowlist stores.
      expect(bindNotice(flag('::ffff:7f00:1'), {})?.message).toContain('--allowed-host [::ffff:7f00:1]');
    });

    it('warns for a specific non-loopback address, naming the knob and the exact --allowed-host entry', () => {
      const notice = bindNotice(env('10.0.0.5'), {});
      expect(notice?.level).toBe('warn');
      expect(notice?.message).toContain('Bound to 10.0.0.5');
      expect(notice?.message).toContain('reachable from other machines');
      expect(notice?.message).toContain(BIND_ENV_KEY);
      expect(notice?.message).not.toContain(BIND_FLAG);
      expect(notice?.message).toContain('--allowed-host 10.0.0.5');
      // An IPv6 literal is bracketed, the way the allowlist stores it.
      expect(bindNotice(flag('fe80::1'), {})?.message).toContain('--allowed-host [fe80::1]');
      expect(bindNotice(flag('fe80::1'), {})?.message).toContain(BIND_FLAG);
    });

    it('warns for an unspecified address and says every client name needs an --allowed-host entry', () => {
      const notice = bindNotice(flag('0.0.0.0'), {});
      expect(notice?.level).toBe('warn');
      expect(notice?.message).toContain('Bound to 0.0.0.0');
      expect(notice?.message).toContain('reachable from other machines');
      expect(notice?.message).toContain('--allowed-host <name>');
      expect(bindNotice(env('::'), {})?.level).toBe('warn');
    });

    it('reports the image default (MCP_HTTP_BIND unspecified under MCP_CONTAINER=true) at info level', () => {
      const notice = bindNotice(env('0.0.0.0'), { MCP_CONTAINER: 'true' });
      expect(notice?.level).toBe('info');
      expect(notice?.message).toContain('image default');
      expect(notice?.message).toContain(BIND_ENV_KEY);
      expect(notice?.message).toContain('--allowed-host <name>');
      expect(bindNotice(env('::'), { MCP_CONTAINER: 'true' })?.level).toBe('info');
    });

    it('does not soften an explicit flag, a specific address, or a near-miss MCP_CONTAINER value', () => {
      expect(bindNotice(flag('0.0.0.0'), { MCP_CONTAINER: 'true' })?.level).toBe('warn');
      expect(bindNotice(env('10.0.0.5'), { MCP_CONTAINER: 'true' })?.level).toBe('warn');
      expect(bindNotice(env('0.0.0.0'), { MCP_CONTAINER: '1' })?.level).toBe('warn');
      expect(bindNotice(env('0.0.0.0'), { MCP_CONTAINER: 'TRUE' })?.level).toBe('warn');
    });
  });

  describe('describeListenError', () => {
    const bind: ResolvedBindAddress = { address: '10.255.255.9', source: 'flag', origin: BIND_FLAG };
    const errno = (code: string, message = `listen ${code}`) => Object.assign(new Error(message), { code });

    it('keeps the port-in-use line', () => {
      expect(describeListenError(errno('EADDRINUSE'), 3001, bind)).toBe(
        'Port 3001 is already in use on 10.255.255.9. Another instance may be running.'
      );
    });

    it('names the address, the port, the knob and a remedy when no interface has the address', () => {
      const line = describeListenError(errno('EADDRNOTAVAIL'), 3001, bind);
      expect(line).toContain('10.255.255.9:3001');
      expect(line).toContain(BIND_FLAG);
      expect(line).toContain('no interface');
      expect(line).toContain('0.0.0.0');
      expect(describeListenError(errno('EADDRNOTAVAIL'), 3001, { address: '10.0.0.5', source: 'env', origin: BIND_ENV_KEY })).toContain(
        BIND_ENV_KEY
      );
    });

    it('explains a permission failure and points at -p', () => {
      const line = describeListenError(errno('EACCES'), 80, bind);
      expect(line).toContain('10.255.255.9:80');
      expect(line).toContain('permission');
      expect(line).toContain('-p');
    });

    it('falls back to the raw message for anything else', () => {
      expect(describeListenError(errno('EPROTO', 'boom'), 3001, bind)).toBe('Server error: boom');
    });
  });

  describe('bindOption', () => {
    it('is --bind <address> with the default and the variable spelled out in the description, and no commander default', () => {
      const option = bindOption();
      expect(option.long).toBe('--bind');
      expect(option.flags).toBe('--bind <address>');
      expect(option.description).toContain('127.0.0.1');
      expect(option.description).toContain(BIND_ENV_KEY);
      expect(option.description).toContain('0.0.0.0');
      // F9 (#688 review): an empty value is fatal, unlike an empty MCP_HTTP_ALLOWED_HOSTS; the help says so.
      expect(option.description).toMatch(/empty value/i);
      // A commander default would always populate options.bind and MCP_HTTP_BIND could never win.
      expect(option.defaultValue).toBeUndefined();
    });
  });
});

import { describe, it, expect } from 'vitest';
import {
  BIND_ENV_KEY,
  BIND_FLAG,
  BindAddressError,
  DEFAULT_BIND_ADDRESS,
  bindOption,
  describeEndpoint,
  isLoopbackAddress,
  isUnspecifiedAddress,
  resolveBindAddress
} from '../../../src/cli/bind-address.js';

describe('bind-address (issue #680)', () => {
  describe('resolveBindAddress', () => {
    it('defaults to loopback when neither the flag nor the variable is set', () => {
      expect(resolveBindAddress(undefined, {})).toEqual({ address: '127.0.0.1', source: 'default' });
      expect(DEFAULT_BIND_ADDRESS).toBe('127.0.0.1');
    });

    it('takes the flag over the variable, and the variable over the default', () => {
      expect(resolveBindAddress('0.0.0.0', { [BIND_ENV_KEY]: '10.0.0.5' })).toEqual({ address: '0.0.0.0', source: 'flag' });
      expect(resolveBindAddress(undefined, { [BIND_ENV_KEY]: '10.0.0.5' })).toEqual({ address: '10.0.0.5', source: 'env' });
    });

    it('trims whitespace and unbrackets IPv6 literals', () => {
      expect(resolveBindAddress(' 0.0.0.0 ', {})).toEqual({ address: '0.0.0.0', source: 'flag' });
      expect(resolveBindAddress('[::1]', {})).toEqual({ address: '::1', source: 'flag' });
      expect(resolveBindAddress(undefined, { [BIND_ENV_KEY]: '::' })).toEqual({ address: '::', source: 'env' });
    });

    it('normalizes localhost to 127.0.0.1 with a note naming the source', () => {
      const fromFlag = resolveBindAddress('localhost', {});
      expect(fromFlag.address).toBe('127.0.0.1');
      expect(fromFlag.source).toBe('flag');
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
  });

  describe('isLoopbackAddress', () => {
    it('recognises 127/8, ::1 and their mapped forms', () => {
      for (const address of ['127.0.0.1', '127.1.2.3', '::1', '[::1]', '::ffff:127.0.0.1', '::FFFF:127.0.0.1']) {
        expect(isLoopbackAddress(address), address).toBe(true);
      }
    });

    it('rejects everything else, the unspecified addresses included', () => {
      for (const address of ['0.0.0.0', '::', '10.0.0.5', '192.168.1.20', 'fe80::1', '128.0.0.1', '::ffff:10.0.0.1']) {
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

  describe('bindOption', () => {
    it('is --bind <address> with the default and the variable spelled out in the description, and no commander default', () => {
      const option = bindOption();
      expect(option.long).toBe('--bind');
      expect(option.flags).toBe('--bind <address>');
      expect(option.description).toContain('127.0.0.1');
      expect(option.description).toContain(BIND_ENV_KEY);
      expect(option.description).toContain('0.0.0.0');
      // A commander default would always populate options.bind and MCP_HTTP_BIND could never win.
      expect(option.defaultValue).toBeUndefined();
    });
  });
});

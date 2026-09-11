import { describe, it, expect } from 'vitest';
import { DEFAULT_PORT, MAX_PORT, PORT_FLAG, PortError, portOption, resolvePort } from '../../../src/cli/port.js';

describe('port (issue #689)', () => {
  describe('resolvePort', () => {
    it('accepts the whole valid range as a number, 0 included', () => {
      expect(resolvePort('0')).toBe(0);
      expect(resolvePort('3001')).toBe(3001);
      expect(resolvePort('65535')).toBe(65535);
      expect(MAX_PORT).toBe(65535);
    });

    it.each([
      ['abc', 'letters'],
      ['3001x', 'trailing junk (parseInt would have bound 3001)'],
      ['-5', 'a negative'],
      ['70000', 'above 65535'],
      ['1.5', 'a decimal'],
      ['', 'an empty value'],
      [' 3001', 'leading whitespace']
    ])("refuses '%s' (%s) with a PortError naming the flag, the value and the range", (raw) => {
      let caught: unknown;
      try {
        resolvePort(raw);
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(PortError);
      const message = (caught as Error).message;
      expect(message).toContain(PORT_FLAG);
      expect(message).toContain(`'${raw}'`);
      expect(message).toContain('0-65535');
      // The handlers append ". The server was not started." to this message.
      expect(message.endsWith('.')).toBe(false);
    });

    it('names its error class so a catch can tell it from a generic startup failure', () => {
      expect(() => resolvePort('abc')).toThrow(expect.objectContaining({ name: 'PortError' }));
    });
  });

  describe('portOption', () => {
    it('is -p, --port <number> with the string default 3001 and the range and the 0 rule in the description', () => {
      const option = portOption();
      expect(option.short).toBe('-p');
      expect(option.long).toBe('--port');
      expect(option.flags).toBe('-p, --port <number>');
      // A string default: commander never runs a parser over a default, and
      // the handlers resolve the value themselves.
      expect(option.defaultValue).toBe(DEFAULT_PORT);
      expect(DEFAULT_PORT).toBe('3001');
      expect(option.description).toContain('Port to listen on');
      expect(option.description).toContain('65535');
      expect(option.description).toMatch(/0 lets the OS choose/);
    });
  });
});

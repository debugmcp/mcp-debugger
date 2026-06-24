import { describe, it, expect, vi } from 'vitest';
import {
  isAdapterSpawnBlocked,
  extractSpawnMessage,
  skipIfSpawnBlocked
} from '../../test-utils/helpers/adapter-spawn.js';

describe('adapter-spawn detection', () => {
  // The exact message observed when Windows Smart App Control blocks the
  // vendored, unsigned CodeLLDB binary.
  const SAC_MESSAGE =
    'Critical initialization error: spawn UNKNOWN [Adapter command: ' +
    'C:\\...\\codelldb.exe --port 60849 --liblldb C:\\...\\liblldb.dll | adapter PID=none exitCode=n/a]';

  describe('isAdapterSpawnBlocked', () => {
    it('detects the real Windows SAC spawn-block message', () => {
      expect(isAdapterSpawnBlocked({ success: false, message: SAC_MESSAGE })).toBe(true);
    });

    it.each([
      'spawn UNKNOWN',
      'spawn ENOENT',
      'spawn EACCES',
      'Error: ENOENT: no such file or directory',
      'EACCES: permission denied',
      'An Application Control policy has blocked this file',
      'binary is not executable'
    ])('detects spawn-block signature in %j', (message) => {
      expect(isAdapterSpawnBlocked({ message })).toBe(true);
    });

    it('reads from a thrown Error and a raw string', () => {
      expect(isAdapterSpawnBlocked(new Error('spawn UNKNOWN'))).toBe(true);
      expect(isAdapterSpawnBlocked('spawn ENOENT')).toBe(true);
    });

    it('falls back to the `error` field when `message` is absent', () => {
      expect(isAdapterSpawnBlocked({ error: 'spawn UNKNOWN' })).toBe(true);
    });

    it.each([
      { success: false, message: 'Session not found' },
      { success: false, message: 'MCP error: unknown tool' },
      { success: false, message: 'Failed to set breakpoint' },
      { success: false, message: 'proxy exited unexpectedly' }
    ])('does NOT skip ordinary failures: %j', (resp) => {
      expect(isAdapterSpawnBlocked(resp)).toBe(false);
    });

    it('returns false for empty / nullish input', () => {
      expect(isAdapterSpawnBlocked(undefined)).toBe(false);
      expect(isAdapterSpawnBlocked(null)).toBe(false);
      expect(isAdapterSpawnBlocked({})).toBe(false);
      expect(isAdapterSpawnBlocked('')).toBe(false);
    });
  });

  describe('extractSpawnMessage', () => {
    it('lowercases and prefers message over error', () => {
      expect(extractSpawnMessage({ message: 'Boom', error: 'Other' })).toBe('boom');
      expect(extractSpawnMessage({ error: 'Other' })).toBe('other');
    });
  });

  describe('skipIfSpawnBlocked', () => {
    it('calls ctx.skip with a clear diagnostic when spawn-blocked', () => {
      const skip = vi.fn((note?: string): never => {
        throw new Error(`__SKIP__:${note}`);
      });
      expect(() =>
        skipIfSpawnBlocked({ skip }, { success: false, message: SAC_MESSAGE }, 'Rust')
      ).toThrow('__SKIP__');
      expect(skip).toHaveBeenCalledOnce();
      const note = skip.mock.calls[0][0] as string;
      expect(note).toContain('Rust adapter could not be spawned');
      expect(note).toContain('Smart App Control');
      expect(note.toLowerCase()).toContain('spawn unknown');
    });

    it('returns false and does NOT skip an ordinary failure', () => {
      const skip = vi.fn((note?: string): never => {
        throw new Error(`__SKIP__:${note}`);
      });
      expect(
        skipIfSpawnBlocked({ skip }, { success: false, message: 'Session not found' }, 'Rust')
      ).toBe(false);
      expect(skip).not.toHaveBeenCalled();
    });
  });
});

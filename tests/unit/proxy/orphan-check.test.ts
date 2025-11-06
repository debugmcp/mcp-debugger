import { describe, it, expect } from 'vitest';
import { shouldExitAsOrphan, shouldExitAsOrphanFromEnv } from '../../../src/proxy/utils/orphan-check.js';

describe('orphan-check', () => {
  describe('shouldExitAsOrphan', () => {
    it('exits when parent is init process outside containers', () => {
      expect(shouldExitAsOrphan(1, false)).toBe(true);
    });

    it('does not exit when running inside container namespaces', () => {
      expect(shouldExitAsOrphan(1, true)).toBe(false);
    });

    it('does not exit when parent process is not init', () => {
      expect(shouldExitAsOrphan(42, false)).toBe(false);
    });
  });

  describe('shouldExitAsOrphanFromEnv', () => {
    it('derives container flag from env and reuses logic', () => {
      expect(
        shouldExitAsOrphanFromEnv(1, { MCP_CONTAINER: 'true' })
      ).toBe(false);
      expect(
        shouldExitAsOrphanFromEnv(1, { MCP_CONTAINER: 'false' })
      ).toBe(true);
    });

    it('falls back to process.env when env argument omitted', () => {
      const original = process.env.MCP_CONTAINER;
      process.env.MCP_CONTAINER = 'true';
      try {
        expect(shouldExitAsOrphanFromEnv(1)).toBe(false);
      } finally {
        if (original === undefined) {
          delete process.env.MCP_CONTAINER;
        } else {
          process.env.MCP_CONTAINER = original;
        }
      }
    });
  });
});

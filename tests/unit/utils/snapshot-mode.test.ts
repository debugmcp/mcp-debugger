import { describe, it, expect } from 'vitest';
import {
  SNAPSHOT_ENV_KEY,
  isSnapshotEnabled,
} from '../../../src/utils/snapshot-mode.js';

function envWith(value: string | undefined) {
  return {
    get: (key: string) => (key === SNAPSHOT_ENV_KEY ? value : undefined),
  };
}

describe('snapshot mode helper (issue #982)', () => {
  it('is enabled by default when the env variable is unset', () => {
    expect(isSnapshotEnabled(envWith(undefined))).toBe(true);
  });

  it('stays enabled for empty or whitespace-only values', () => {
    expect(isSnapshotEnabled(envWith(''))).toBe(true);
    expect(isSnapshotEnabled(envWith('   '))).toBe(true);
  });

  it('is disabled by DEBUG_MCP_NO_SNAPSHOT=1 or true (any case, padded)', () => {
    expect(isSnapshotEnabled(envWith('1'))).toBe(false);
    expect(isSnapshotEnabled(envWith('true'))).toBe(false);
    expect(isSnapshotEnabled(envWith(' TRUE '))).toBe(false);
  });

  it('stays enabled for other values (0, false, random text)', () => {
    expect(isSnapshotEnabled(envWith('0'))).toBe(true);
    expect(isSnapshotEnabled(envWith('false'))).toBe(true);
    expect(isSnapshotEnabled(envWith('off'))).toBe(true);
  });

  it('uses the documented env key', () => {
    expect(SNAPSHOT_ENV_KEY).toBe('DEBUG_MCP_NO_SNAPSHOT');
  });
});

import { describe, it, expect, vi } from 'vitest';
import {
  toolchainComponent,
  normalizeToolchainDescription,
  probeWithinBudget
} from '../../src/utils/toolchain-description.js';

describe('toolchainComponent', () => {
  it('returns the component when a path was detected', () => {
    expect(toolchainComponent({ label: 'Python', path: '/usr/bin/python3' })).toEqual({
      label: 'Python',
      path: '/usr/bin/python3'
    });
  });

  it('returns the component when only a version was detected', () => {
    expect(toolchainComponent({ label: 'debugpy', version: '1.8.14' })).toEqual({
      label: 'debugpy',
      version: '1.8.14'
    });
  });

  it('returns the component when only a source was detected', () => {
    expect(toolchainComponent({ label: 'js-debug', source: 'vendored' })).toEqual({
      label: 'js-debug',
      source: 'vendored'
    });
  });

  it('omits the component when nothing was detected — a bare label would read as present', () => {
    expect(toolchainComponent({ label: 'Ruby' })).toBeUndefined();
  });

  it('treats empty strings as absent, like the old presenter str() helper', () => {
    expect(toolchainComponent({ label: 'Go', path: '', version: '' })).toBeUndefined();
  });

  it('drops empty-string fields from a component that has a real detection', () => {
    expect(toolchainComponent({ label: 'rdbg', path: '', version: '1.11.0' })).toEqual({
      label: 'rdbg',
      version: '1.11.0'
    });
  });

  it('drops non-string field values (details come from an untyped bag)', () => {
    expect(
      toolchainComponent({ label: 'Delve', path: 42 as unknown as string, version: 'v1.26.3' })
    ).toEqual({ label: 'Delve', version: 'v1.26.3' });
  });

  it('lets "(built-in)" style labels stand alone by design', () => {
    expect(toolchainComponent({ label: '(built-in)' })).toEqual({ label: '(built-in)' });
  });
});

describe('normalizeToolchainDescription', () => {
  it('passes a well-formed description through', () => {
    const description = {
      runtime: { label: 'Python', path: '/usr/bin/python3', version: '3.12.1' },
      backend: { label: 'debugpy', version: '1.8.14' }
    };
    expect(normalizeToolchainDescription(description)).toEqual(description);
  });

  it('returns empty cells for non-object values', () => {
    expect(normalizeToolchainDescription(undefined)).toEqual({});
    expect(normalizeToolchainDescription(null)).toEqual({});
    expect(normalizeToolchainDescription('Python 3.12')).toEqual({});
    expect(normalizeToolchainDescription([{ label: 'x' }])).toEqual({});
  });

  it('drops a component with a missing or non-string label', () => {
    expect(
      normalizeToolchainDescription({
        runtime: { path: '/usr/bin/python3' },
        backend: { label: 7, version: '1.0' }
      })
    ).toEqual({});
  });

  it('applies the omit-undetected rule to each component', () => {
    expect(
      normalizeToolchainDescription({
        runtime: { label: 'Ruby' },
        backend: { label: '(built-in)' }
      })
    ).toEqual({ backend: { label: '(built-in)' } });
  });

  it('strips non-string and unknown fields, then re-applies the omission rule', () => {
    expect(
      normalizeToolchainDescription({
        runtime: { label: 'Go', path: 42, extra: 'ignored' },
        backend: { label: 'Delve', version: 'v1.26.3', extra: 'ignored' }
      })
    ).toEqual({ backend: { label: 'Delve', version: 'v1.26.3' } });
  });
});

describe('probeWithinBudget', () => {
  it('returns the probe result when it settles inside the budget', async () => {
    await expect(probeWithinBudget(5000, async () => '8.0.401')).resolves.toBe('8.0.401');
  });

  it('returns null instead of hanging when the probe outlives the budget', async () => {
    const result = await probeWithinBudget(150, () => new Promise<string>(() => undefined));
    expect(result).toBeNull();
  });

  it('does not run the probe at all when the budget is already exhausted', async () => {
    const probe = vi.fn().mockResolvedValue('never');

    await expect(probeWithinBudget(0, probe)).resolves.toBeNull();
    expect(probe).not.toHaveBeenCalled();
  });

  it('swallows a probe rejection as null', async () => {
    await expect(
      probeWithinBudget(5000, async () => {
        throw new Error('spawn failed');
      })
    ).resolves.toBeNull();
  });

  it('awaits the probe fully when no budget was given', async () => {
    await expect(probeWithinBudget(undefined, async () => 'value')).resolves.toBe('value');
  });
});

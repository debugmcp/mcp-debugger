import { describe, it, expect, afterEach, vi } from 'vitest';
import { ProcessEnvironment } from '../../../src/implementations/environment-impl.js';

describe('ProcessEnvironment', () => {
  afterEach(() => {
    delete process.env.TEST_ENV_SNAPSHOT;
    vi.restoreAllMocks();
  });

  it('captures a snapshot of environment variables at construction', () => {
    process.env.TEST_ENV_SNAPSHOT = 'initial';
    const env = new ProcessEnvironment();

    expect(env.get('TEST_ENV_SNAPSHOT')).toBe('initial');

    process.env.TEST_ENV_SNAPSHOT = 'mutated';
    expect(env.get('TEST_ENV_SNAPSHOT')).toBe('initial');
  });

  it('returns a defensive copy from getAll', () => {
    process.env.TEST_ENV_SNAPSHOT = 'value';
    const env = new ProcessEnvironment();

    const snapshot = env.getAll();
    snapshot.TEST_ENV_SNAPSHOT = 'changed';

    expect(env.get('TEST_ENV_SNAPSHOT')).toBe('value');
    expect(env.getAll().TEST_ENV_SNAPSHOT).toBe('value');
  });

  it('returns current working directory', () => {
    const fakeCwd = 'C:\\fake-path';
    vi.spyOn(process, 'cwd').mockReturnValue(fakeCwd);

    const env = new ProcessEnvironment();
    expect(env.getCurrentWorkingDirectory()).toBe(fakeCwd);
  });
});

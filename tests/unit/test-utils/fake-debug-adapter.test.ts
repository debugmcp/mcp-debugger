/**
 * Tests for the test double itself.
 *
 * `FakeDebugAdapter` is used by every proxy and session suite, so its own contract has to hold
 * or a whole class of tests quietly stops testing what it claims. The four properties below
 * are exactly the ones that were wrong (or only true by accident) before review:
 *
 * - an optional member the production code guards must be genuinely ABSENT, not present-and-
 *   undefined, or `adapter.supportsAttach?.()` only ever exercises one branch;
 * - an explicitly-undefined override must not resurrect such a member as a truthy mock;
 * - a constructor override must survive `vi.resetAllMocks()`, which restores the
 *   implementation a mock was CONSTRUCTED with;
 * - the builders deliberately win over constructor overrides.
 */
import { describe, it, expect, vi } from 'vitest';
import { DebugLanguage, type AdapterLaunchBarrier, type GenericAttachConfig } from '@debugmcp/shared';
import { FakeDebugAdapter } from '../../test-utils/fakes/fake-debug-adapter.js';

/** The seven members production code reaches through an optional call. */
const OPTIONAL_MEMBERS = [
  'createLaunchBarrier',
  'supportsAttach',
  'supportsDetach',
  'usesDirectConnectForAttach',
  'transformAttachConfig',
  'getDefaultAttachConfig',
  'supportedAttachKeys'
] as const;

function makeBarrier(): AdapterLaunchBarrier {
  return {
    awaitResponse: false,
    onRequestSent: vi.fn(),
    onProxyStatus: vi.fn(),
    onDapEvent: vi.fn(),
    onProxyExit: vi.fn(),
    waitUntilReady: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn()
  };
}

describe('FakeDebugAdapter', () => {
  describe('optional members are absent until opted in', () => {
    it('defines no own property for any optional member', () => {
      const adapter = new FakeDebugAdapter();

      for (const member of OPTIONAL_MEMBERS) {
        // `in` and Object.keys, not just `=== undefined`: an uninitialised ES2022 class field
        // is emitted as an own property holding undefined, which passes a truthiness check on
        // the value but fails these — and would make the fake claim a capability it lacks.
        expect(member in adapter, member).toBe(false);
        expect(Object.keys(adapter), member).not.toContain(member);
      }
    });

    it('keeps a member absent when an override passes undefined explicitly', () => {
      // The shape a conditional override produces: `{ transformAttachConfig: cond ? fn : undefined }`.
      const adapter = new FakeDebugAdapter({ transformAttachConfig: undefined });

      expect('transformAttachConfig' in adapter).toBe(false);
      expect(adapter.transformAttachConfig).toBeUndefined();
    });

    it('defines a member when an override supplies one', () => {
      const adapter = new FakeDebugAdapter({
        transformAttachConfig: (config: GenericAttachConfig) => ({ ...config, tagged: true })
      });

      expect('transformAttachConfig' in adapter).toBe(true);
      expect(adapter.transformAttachConfig?.({ request: 'attach' })).toEqual({
        request: 'attach',
        tagged: true
      });
    });

    it('defines the attach set only after withAttachSupport()', () => {
      const adapter = new FakeDebugAdapter().withAttachSupport({ directConnect: true });

      expect(adapter.supportsAttach?.()).toBe(true);
      expect(adapter.usesDirectConnectForAttach?.()).toBe(true);
      expect(adapter.supportsDetach?.()).toBe(true);
      expect('transformAttachConfig' in adapter).toBe(true);
      expect('getDefaultAttachConfig' in adapter).toBe(true);
    });
  });

  describe('overrides', () => {
    it('survives vi.resetAllMocks()', () => {
      // mockReset restores the implementation a mock was CONSTRUCTED with, so an override
      // installed via mockImplementation would silently revert to the fake's own default here.
      const adapter = new FakeDebugAdapter({ getDefaultExecutableName: () => 'overridden' });
      expect(adapter.getDefaultExecutableName()).toBe('overridden');

      vi.resetAllMocks();

      expect(adapter.getDefaultExecutableName()).toBe('overridden');
    });

    it('sets language and name, defaulting language to mock', () => {
      expect(new FakeDebugAdapter().language).toBe(DebugLanguage.MOCK);
      expect(new FakeDebugAdapter({ language: DebugLanguage.RUBY }).language).toBe(
        DebugLanguage.RUBY
      );
      expect(new FakeDebugAdapter({ name: 'Explicit' }).name).toBe('Explicit');
    });
  });

  describe('builders win over constructor overrides', () => {
    it('withAttachSupport() replaces a same-member override', () => {
      const adapter = new FakeDebugAdapter({ supportsDetach: () => false }).withAttachSupport();

      expect(adapter.supportsDetach?.()).toBe(true);
    });

    it('withLaunchBarrier() replaces a same-member override', () => {
      const constructed = makeBarrier();
      const built = makeBarrier();
      const adapter = new FakeDebugAdapter({
        createLaunchBarrier: () => constructed
      }).withLaunchBarrier(built);

      expect(adapter.createLaunchBarrier?.('launch')).toBe(built);
    });

    it('withLaunchBarrier(undefined) defines the member but declines the barrier', () => {
      const adapter = new FakeDebugAdapter().withLaunchBarrier(undefined);

      expect('createLaunchBarrier' in adapter).toBe(true);
      expect(adapter.createLaunchBarrier?.('launch')).toBeUndefined();
    });
  });

  describe('production-shaped defaults', () => {
    it('falls back to a real executable name for an empty preferred path', async () => {
      // '' is not a path: real adapters treat it as "search PATH", and the proxy worker's
      // init-payload validation rejects an empty executablePath outright.
      const adapter = new FakeDebugAdapter();

      await expect(adapter.resolveExecutablePath('')).resolves.toBe('fake-executable');
      await expect(adapter.resolveExecutablePath(undefined)).resolves.toBe('fake-executable');
      await expect(adapter.resolveExecutablePath('/usr/bin/python3')).resolves.toBe(
        '/usr/bin/python3'
      );
    });

    it('transforms launch config asynchronously, as the interface requires', async () => {
      const adapter = new FakeDebugAdapter();
      const config = { stopOnEntry: true };

      const transformed = adapter.transformLaunchConfig(config);
      expect(transformed).toBeInstanceOf(Promise);
      // A copy, not the caller's object — a transform that aliased its input would hide
      // mutation bugs in the code under test.
      await expect(transformed).resolves.toEqual(config);
      await expect(transformed).resolves.not.toBe(config);
    });

    it('is a real EventEmitter', () => {
      const adapter = new FakeDebugAdapter();
      const listener = vi.fn();

      adapter.on('exited', listener);
      adapter.emit('exited', 0);

      expect(listener).toHaveBeenCalledWith(0);
    });
  });

  describe('withExtras', () => {
    it('exposes adapter-specific members to the compiler and at runtime', () => {
      const consumeLastToolchainValidation = vi.fn(() => 'clean');
      const adapter = new FakeDebugAdapter().withExtras({ consumeLastToolchainValidation });

      expect(adapter.consumeLastToolchainValidation()).toBe('clean');
      // Same object, so a collaborator holding the IDebugAdapter still sees the extras.
      expect(adapter).toBeInstanceOf(FakeDebugAdapter);
    });
  });
});

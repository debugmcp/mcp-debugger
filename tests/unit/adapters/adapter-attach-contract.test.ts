/**
 * Attach-addressing contract test (issue #903).
 *
 * Eleven adapter factories declare, on `getMetadata().modes`, how their attach works
 * (`attach`) and what an `attach_to_process` request may address (`attachBy`, with
 * `attachHints` for the forms it lacks). The core refuses the rest by name before any
 * session state changes (`classifyAttachAddressing`), so the table below is user-visible
 * behaviour: a language starting or stopping to accept a form should require editing this
 * table on purpose, not pass silently — the same reasoning as `adapter-policy-contract.test.ts`.
 *
 * These assertions run against the REAL factories (the `@debugmcp/adapter-*` vitest
 * aliases), plus the loader's static known-adapters list, which mirrors the declarations
 * for `list_supported_languages` before a factory is loaded and must agree with them.
 */
import { describe, it, expect } from 'vitest';
import type { AdapterModes, AttachAddressing, AttachMechanism, IAdapterFactory } from '@debugmcp/shared';
import { MockAdapterFactory } from '@debugmcp/adapter-mock';
import { PythonAdapterFactory } from '@debugmcp/adapter-python';
import { RubyAdapterFactory } from '@debugmcp/adapter-ruby';
import { JavascriptAdapterFactory } from '@debugmcp/adapter-javascript';
import { RustAdapterFactory } from '@debugmcp/adapter-rust';
import { GoAdapterFactory } from '@debugmcp/adapter-go';
import { JavaAdapterFactory } from '@debugmcp/adapter-java';
import { DotnetAdapterFactory } from '@debugmcp/adapter-dotnet';
import { CppAdapterFactory } from '@debugmcp/adapter-cpp';
import { CobolAdapterFactory } from '@debugmcp/adapter-cobol';
import { DartAdapterFactory } from '@debugmcp/adapter-dart';
import { AdapterLoader } from '../../../src/adapters/adapter-loader.js';

interface PinnedAttach {
  attach: AttachMechanism;
  attachBy: readonly AttachAddressing[] | undefined;
  /** Which hints the declaration carries; a form the adapter lacks needs one. */
  hints: readonly ('processId' | 'port')[];
}

/**
 * What each language declares today. `attach: 'none'` languages declare no `attachBy`;
 * every other language names every form it accepts, and carries a hint for each of the
 * two top-level forms it does not accept, so the refusal can say what to do instead.
 */
const PINNED: Record<string, PinnedAttach> = {
  python: { attach: 'direct-connect', attachBy: ['port'], hints: ['processId'] },
  ruby: { attach: 'direct-connect', attachBy: ['port'], hints: ['processId'] },
  javascript: { attach: 'spawn', attachBy: ['processId', 'port', 'adapterConfig'], hints: [] },
  java: { attach: 'spawn', attachBy: ['port'], hints: ['processId'] },
  dotnet: { attach: 'spawn', attachBy: ['processId'], hints: ['port'] },
  cpp: { attach: 'spawn', attachBy: ['processId'], hints: ['port'] },
  cobol: { attach: 'spawn', attachBy: ['processId'], hints: ['port'] },
  dart: { attach: 'spawn', attachBy: ['port', 'adapterConfig'], hints: ['processId'] },
  go: { attach: 'none', attachBy: undefined, hints: [] },
  rust: { attach: 'none', attachBy: undefined, hints: [] },
  mock: { attach: 'none', attachBy: undefined, hints: [] }
};

const FACTORIES: Record<string, () => IAdapterFactory> = {
  python: () => new PythonAdapterFactory(),
  ruby: () => new RubyAdapterFactory(),
  javascript: () => new JavascriptAdapterFactory(),
  java: () => new JavaAdapterFactory(),
  dotnet: () => new DotnetAdapterFactory(),
  cpp: () => new CppAdapterFactory(),
  cobol: () => new CobolAdapterFactory(),
  dart: () => new DartAdapterFactory(),
  go: () => new GoAdapterFactory(),
  rust: () => new RustAdapterFactory(),
  mock: () => new MockAdapterFactory()
};

const LANGUAGES = Object.keys(PINNED);

function modesOf(language: string): AdapterModes | undefined {
  return FACTORIES[language]().getMetadata().modes;
}

describe('attach-addressing contract (issue #903)', () => {
  it('pins every known language and nothing else', () => {
    expect(Object.keys(FACTORIES).sort()).toEqual(LANGUAGES.slice().sort());
  });

  describe.each(LANGUAGES)('%s', (language) => {
    const pinned = PINNED[language];

    it('declares the pinned attach mechanism and addressing forms', () => {
      const modes = modesOf(language);
      expect(modes?.attach).toBe(pinned.attach);
      expect(modes?.attachBy).toEqual(pinned.attachBy);
    });

    it('declares attachBy exactly when attach is implemented', () => {
      const modes = modesOf(language);
      if (modes?.attach === 'none') {
        expect(modes.attachBy).toBeUndefined();
        expect(modes.attachHints).toBeUndefined();
      } else {
        expect(Array.isArray(modes?.attachBy)).toBe(true);
        expect(modes!.attachBy!.length).toBeGreaterThan(0);
        expect(new Set(modes!.attachBy).size).toBe(modes!.attachBy!.length);
      }
    });

    it('carries a remedy for each top-level form it does not accept', () => {
      const modes = modesOf(language);
      const hints = modes?.attachHints ?? {};
      expect(Object.keys(hints).sort()).toEqual(pinned.hints.slice().sort());
      for (const form of ['processId', 'port'] as const) {
        if (modes?.attach !== 'none' && !modes?.attachBy?.includes(form)) {
          expect(typeof hints[form]).toBe('string');
          expect(hints[form]!.length).toBeGreaterThan(20);
        }
      }
    });
  });

  it("mirrors the factories in the loader's known-adapters list", async () => {
    // Nothing is installed from the loader's point of view here; the static
    // declarations are what list_supported_languages shows before a load.
    const loader = new AdapterLoader(undefined, undefined, {
      isInstalled: async () => false
    });
    const known = await loader.listAvailableAdapters();
    expect(known.map((entry) => entry.name).sort()).toEqual(LANGUAGES.slice().sort());
    for (const entry of known) {
      const modes = modesOf(entry.name);
      expect(entry.attach, entry.name).toBe(modes?.attach);
      expect(entry.attachBy, entry.name).toEqual(modes?.attachBy);
    }
  });
});

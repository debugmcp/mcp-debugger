/**
 * Batteries-Included Imports
 * 
 * This file statically imports all adapters to ensure they're bundled
 * into the CLI for the "batteries included" npx distribution.
 * 
 * These imports ensure esbuild includes the adapters in the bundle.
 */

import { JavascriptAdapterFactory } from '@debugmcp/adapter-javascript';
import { PythonAdapterFactory } from '@debugmcp/adapter-python';
import { MockAdapterFactory } from '@debugmcp/adapter-mock';
import { GoAdapterFactory } from '@debugmcp/adapter-go';
import type { IAdapterFactory } from '@debugmcp/shared';

interface BundledAdapterEntry {
  language: 'javascript' | 'python' | 'mock' | 'go';
  factoryCtor: new () => IAdapterFactory;
}

const GLOBAL_KEY = '__DEBUG_MCP_BUNDLED_ADAPTERS__';

const adapters: BundledAdapterEntry[] = [
  { language: 'javascript', factoryCtor: JavascriptAdapterFactory },
  { language: 'python', factoryCtor: PythonAdapterFactory },
  { language: 'mock', factoryCtor: MockAdapterFactory },
  { language: 'go', factoryCtor: GoAdapterFactory }
];

const globalAdapters = (globalThis as unknown as Record<string, BundledAdapterEntry[] | undefined>)[GLOBAL_KEY];
if (Array.isArray(globalAdapters)) {
  const existing = new Set(globalAdapters.map((entry) => entry.language));
  adapters.forEach((entry) => {
    if (!existing.has(entry.language)) {
      globalAdapters.push(entry);
    }
  });
} else {
  (globalThis as unknown as Record<string, BundledAdapterEntry[] | undefined>)[GLOBAL_KEY] = [...adapters];
}

// Export empty object to make this a valid module
export {};

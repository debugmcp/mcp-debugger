/**
 * The shim is bundled into one file by scripts/bundle-shim.mjs and ships without
 * node_modules, so `src/shim/**` may only reach node builtins, the framing codec
 * in @debugmcp/shared, @vscode/debugprotocol types, and this package's own
 * shim-protocol / manifest / decoder modules. It must also never touch the
 * process's stdio (CodeLLDB and the debuggee own it) or install process listeners.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';

const SHIM_DIR = path.resolve(__dirname, '../../../src/shim');

const ALLOWED_PACKAGES = new Set(['@debugmcp/shared', '@vscode/debugprotocol']);
const ALLOWED_PACKAGE_FILES = new Set([
  'shim-protocol.js',
  'manifest/schema.js',
  'manifest/attr-constants.js',
  'decoder/index.js'
]);

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...listTsFiles(full));
    } else if (name.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

function importSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const pattern = /(?:^|\n)\s*(?:import|export)\s[^;]*?\sfrom\s+'([^']+)'|(?:^|\n)\s*import\s+'([^']+)'|\bimport\(\s*'([^']+)'\s*\)/g;
  for (const match of source.matchAll(pattern)) {
    specifiers.push(match[1] ?? match[2] ?? match[3]);
  }
  return specifiers;
}

/** Comments may talk about console.log; code may not use it. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
}

function isBuiltin(specifier: string): boolean {
  const bare = specifier.startsWith('node:') ? specifier.slice(5) : specifier;
  return builtinModules.includes(bare);
}

describe('src/shim import allow-list', () => {
  const files = listTsFiles(SHIM_DIR);

  it('finds the shim sources', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(files.map((file) => [path.relative(SHIM_DIR, file), file]))('%s imports only what the bundle may carry', (_label, file) => {
    const source = readFileSync(file, 'utf8');
    for (const specifier of importSpecifiers(source)) {
      if (isBuiltin(specifier) || ALLOWED_PACKAGES.has(specifier)) {
        continue;
      }
      expect(specifier.startsWith('.'), `${specifier} is not a builtin, an allowed package or a relative import`).toBe(true);
      const resolved = path.resolve(path.dirname(file), specifier);
      const insideShim = !path.relative(SHIM_DIR, resolved).startsWith('..');
      if (insideShim) {
        expect(specifier.endsWith('.js'), `${specifier} must carry the .js suffix`).toBe(true);
        continue;
      }
      const fromPackage = path.relative(path.resolve(SHIM_DIR, '..'), resolved).replace(/\\/g, '/');
      expect(ALLOWED_PACKAGE_FILES.has(fromPackage), `${specifier} (${fromPackage}) is outside the shim's allowed package files`).toBe(true);
    }
  });

  it.each(files.map((file) => [path.relative(SHIM_DIR, file), file]))('%s never writes to stdio or installs process listeners', (label, file) => {
    const source = stripComments(readFileSync(file, 'utf8'));
    expect(source, `${label} uses console`).not.toMatch(/\bconsole\./);
    expect(source, `${label} touches process.stdout/stderr`).not.toMatch(/process\.(stdout|stderr)/);
    if (label !== 'cobol-shim.ts') {
      expect(source, `${label} installs a process listener`).not.toMatch(/process\.(on|once)\(/);
    }
  });
});

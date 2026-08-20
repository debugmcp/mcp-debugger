#!/usr/bin/env node

/**
 * Stage CodeLLDB binaries into the per-platform npm packages (issue #383).
 *
 * Copies the vendored payload (adapter/, lldb/, lang_support/, version.json)
 * from packages/codelldb-common/vendor/codelldb/<dir>/ into
 * packages/codelldb-<dir>/ so those packages can be packed and published.
 * Missing platforms are vendored on demand via the digest-pinned vendor
 * script. Run at pack/publish time only - the payload is git-ignored and the
 * platform packages have no build step.
 *
 * Usage:
 *   node scripts/stage-codelldb-packages.mjs [--verify] [platform ...]
 *
 * With no platform arguments, all five supported platforms are staged.
 * --verify additionally fails unless each staged package holds the codelldb
 * executable, the platform's liblldb library, and a version.json matching
 * vendor-manifest.json - the guard against publishing a near-empty package
 * (npm silently omits `files` entries that do not exist).
 */

import fs from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const vendorRoot = path.join(repoRoot, 'packages', 'codelldb-common', 'vendor', 'codelldb');
const manifestPath = path.join(repoRoot, 'packages', 'codelldb-common', 'vendor-manifest.json');
const pinnedVersion = JSON.parse(readFileSync(manifestPath, 'utf8')).codelldb.version;

const PLATFORM_LAYOUT = {
  'win32-x64': { binary: ['adapter', 'codelldb.exe'], liblldb: ['lldb', 'bin', 'liblldb.dll'] },
  'darwin-x64': { binary: ['adapter', 'codelldb'], liblldb: ['lldb', 'lib', 'liblldb.dylib'] },
  'darwin-arm64': { binary: ['adapter', 'codelldb'], liblldb: ['lldb', 'lib', 'liblldb.dylib'] },
  'linux-x64': { binary: ['adapter', 'codelldb'], liblldb: ['lldb', 'lib', 'liblldb.so'] },
  'linux-arm64': { binary: ['adapter', 'codelldb'], liblldb: ['lldb', 'lib', 'liblldb.so'] }
};

const PAYLOAD_ENTRIES = ['adapter', 'lldb', 'lang_support', 'version.json'];

function log(msg) {
  console.log(`[stage-codelldb] ${msg}`);
}

function fail(msg) {
  console.error(`[stage-codelldb][error] ${msg}`);
  process.exitCode = 1;
}

async function ensureVendored(platformDir) {
  const versionFile = path.join(vendorRoot, platformDir, 'version.json');
  if (existsSync(versionFile)) {
    try {
      const { version } = JSON.parse(await fs.readFile(versionFile, 'utf8'));
      if (version === pinnedVersion) {
        return true;
      }
      log(`${platformDir} vendored at ${version}, expected ${pinnedVersion} - re-vendoring`);
    } catch {
      log(`${platformDir} has an unreadable version.json - re-vendoring`);
    }
  }
  const { downloadAndExtract } = await import(
    pathToFileURL(path.join(repoRoot, 'packages', 'codelldb-common', 'scripts', 'vendor-codelldb.js')).href
  );
  log(`Vendoring ${platformDir} via vendor-codelldb.js...`);
  return downloadAndExtract(platformDir);
}

async function stagePlatform(platformDir) {
  const sourceDir = path.join(vendorRoot, platformDir);
  const packageDir = path.join(repoRoot, 'packages', `codelldb-${platformDir}`);

  if (!existsSync(path.join(packageDir, 'package.json'))) {
    fail(`Platform package missing: ${packageDir}`);
    return false;
  }

  if (!(await ensureVendored(platformDir))) {
    fail(`Unable to vendor CodeLLDB for ${platformDir}`);
    return false;
  }

  for (const entry of PAYLOAD_ENTRIES) {
    const source = path.join(sourceDir, entry);
    const target = path.join(packageDir, entry);
    await fs.rm(target, { recursive: true, force: true });
    if (!existsSync(source)) {
      if (entry === 'lang_support') {
        continue; // optional upstream payload
      }
      fail(`${platformDir}: expected ${source} after vendoring`);
      return false;
    }
    await fs.cp(source, target, { recursive: true });
  }

  log(`Staged ${platformDir} -> packages/codelldb-${platformDir}`);
  return true;
}

async function verifyPlatform(platformDir) {
  const packageDir = path.join(repoRoot, 'packages', `codelldb-${platformDir}`);
  const layout = PLATFORM_LAYOUT[platformDir];
  const binaryPath = path.join(packageDir, ...layout.binary);
  const liblldbPath = path.join(packageDir, ...layout.liblldb);
  const versionFile = path.join(packageDir, 'version.json');
  let ok = true;

  if (!existsSync(binaryPath)) {
    fail(`${platformDir}: missing executable ${binaryPath}`);
    ok = false;
  } else if (process.platform !== 'win32' && platformDir !== 'win32-x64') {
    const stats = await fs.stat(binaryPath);
    if (!(stats.mode & 0o111)) {
      fail(`${platformDir}: ${binaryPath} is not executable`);
      ok = false;
    }
  }

  if (!existsSync(liblldbPath)) {
    fail(`${platformDir}: missing liblldb ${liblldbPath}`);
    ok = false;
  }

  try {
    const { version } = JSON.parse(await fs.readFile(versionFile, 'utf8'));
    if (version !== pinnedVersion) {
      fail(`${platformDir}: version.json says ${version}, vendor-manifest pins ${pinnedVersion}`);
      ok = false;
    }
  } catch (error) {
    fail(`${platformDir}: unreadable ${versionFile}: ${error instanceof Error ? error.message : error}`);
    ok = false;
  }

  if (ok) {
    log(`Verified ${platformDir}`);
  }
  return ok;
}

async function main() {
  const args = process.argv.slice(2);
  const verify = args.includes('--verify');
  const requested = args.filter(a => a !== '--verify');
  const platforms = requested.length > 0 ? requested : Object.keys(PLATFORM_LAYOUT);

  for (const platformDir of platforms) {
    if (!PLATFORM_LAYOUT[platformDir]) {
      fail(`Unknown platform: ${platformDir} (supported: ${Object.keys(PLATFORM_LAYOUT).join(', ')})`);
      continue;
    }
    const staged = await stagePlatform(platformDir);
    if (staged && verify) {
      await verifyPlatform(platformDir);
    }
  }

  if (process.exitCode === 1) {
    console.error('[stage-codelldb][error] One or more platforms failed to stage/verify.');
  } else {
    log('All requested platforms staged successfully.');
  }
}

main().catch(error => {
  fail(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exitCode = 1;
});

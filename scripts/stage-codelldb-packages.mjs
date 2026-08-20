#!/usr/bin/env node

/**
 * Stage CodeLLDB binaries into the per-platform npm packages (issue #383).
 *
 * Copies the vendored payload (adapter/, lldb/, lang_support/, version.json)
 * from packages/codelldb-common/vendor/codelldb/<dir>/ into
 * packages/codelldb-<dir>/ so those packages can be packed and published.
 * Missing/stale platforms are vendored on demand via the digest-pinned vendor
 * script (its own freshness check + CODELLDB_FORCE_REBUILD apply). Run at
 * pack/publish time only - the payload is git-ignored and the platform
 * packages have no build step.
 *
 * Usage:
 *   node scripts/stage-codelldb-packages.mjs [--verify] [--verify-only] [platform ...]
 *
 * With no platform arguments, all supported platforms are staged.
 * --verify additionally fails unless each staged package holds the codelldb
 * executable, the platform's liblldb library, and a version.json matching
 * vendor-manifest.json - the guard against publishing a near-empty package
 * (npm silently omits `files` entries that do not exist). --verify-only
 * skips staging and only verifies, so the release workflow can verify in a
 * FRESH process (a vendoring process that died silently cannot vouch for
 * itself - issue #389).
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

// Single source of truth for platform keys and payload layout - the vendor
// script's PLATFORMS table (drift-guarded against the resolver's dir list).
const { downloadAndExtract, PLATFORMS } = await import(
  pathToFileURL(
    path.join(repoRoot, 'packages', 'codelldb-common', 'scripts', 'vendor-codelldb.js')
  ).href
);

// PLATFORMS paths are VSIX-relative ('extension/adapter/codelldb.exe');
// staged payloads drop the 'extension/' prefix.
function packageRelative(vsixPath) {
  return vsixPath.replace(/^extension\//, '').split('/');
}

const PAYLOAD_ENTRIES = ['adapter', 'lldb', 'lang_support', 'version.json'];

const failures = [];

function log(msg) {
  console.log(`[stage-codelldb] ${msg}`);
}

function fail(msg) {
  console.error(`[stage-codelldb][error] ${msg}`);
  failures.push(msg);
}

async function stagePlatform(platformDir) {
  const sourceDir = path.join(vendorRoot, platformDir);
  const packageDir = path.join(repoRoot, 'packages', `codelldb-${platformDir}`);

  if (!existsSync(path.join(packageDir, 'package.json'))) {
    fail(`Platform package missing: ${packageDir}`);
    return false;
  }

  // The vendor script skips fresh platforms, re-vendors stale ones, and
  // verifies the pinned digest on download.
  if (!(await downloadAndExtract(platformDir))) {
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

async function checkExecutableBit(platformDir, filePath) {
  const stats = await fs.stat(filePath);
  if (!(stats.mode & 0o111)) {
    fail(`${platformDir}: ${filePath} is not executable`);
    return false;
  }
  return true;
}

async function verifyPlatform(platformDir) {
  const packageDir = path.join(repoRoot, 'packages', `codelldb-${platformDir}`);
  const info = PLATFORMS[platformDir];
  const binaryPath = path.join(packageDir, ...packageRelative(info.binaryPath));
  const liblldbPath = path.join(packageDir, ...packageRelative(info.libPath));
  const versionFile = path.join(packageDir, 'version.json');
  let ok = true;

  if (!existsSync(binaryPath)) {
    fail(`${platformDir}: missing executable ${binaryPath}`);
    ok = false;
  }

  if (!existsSync(liblldbPath)) {
    fail(`${platformDir}: missing liblldb ${liblldbPath}`);
    ok = false;
  }

  // Exec-bit verification for POSIX payloads: the codelldb binary plus every
  // helper under lldb/bin (debugserver, lldb-server, lldb-argdumper rely on
  // extract-zip preserving zip unix attrs). NTFS does not track exec bits,
  // so a win32 staging host cannot verify - warn loudly rather than pass
  // silently (the release runner is Linux, where the check is real).
  if (platformDir !== 'win32-x64') {
    if (process.platform === 'win32') {
      console.warn(
        `[stage-codelldb][warn] ${platformDir}: staging on Windows cannot verify POSIX exec bits - ` +
        'do not publish this payload from this machine; the release runner re-stages on Linux.'
      );
    } else {
      if (existsSync(binaryPath)) {
        ok = (await checkExecutableBit(platformDir, binaryPath)) && ok;
      }
      const lldbBin = path.join(packageDir, 'lldb', 'bin');
      if (existsSync(lldbBin)) {
        for (const entry of await fs.readdir(lldbBin, { withFileTypes: true })) {
          if (entry.isFile()) {
            ok = (await checkExecutableBit(platformDir, path.join(lldbBin, entry.name))) && ok;
          }
        }
      }
    }
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
  const verify = args.includes('--verify') || args.includes('--verify-only');
  const stageStep = !args.includes('--verify-only');
  const requested = args.filter(a => !a.startsWith('--'));
  const platforms = requested.length > 0 ? requested : Object.keys(PLATFORMS);

  const unknown = platforms.filter(p => !PLATFORMS[p]);
  for (const p of unknown) {
    fail(`Unknown platform: ${p} (supported: ${Object.keys(PLATFORMS).join(', ')})`);
  }
  const valid = platforms.filter(p => PLATFORMS[p]);

  if (stageStep) {
    // The vendor script uses per-platform temp/target dirs, so parallel
    // staging is safe and cuts the release step to ~1x download time.
    const staged = await Promise.all(valid.map(p => stagePlatform(p)));
    if (verify) {
      for (let i = 0; i < valid.length; i++) {
        if (staged[i]) {
          await verifyPlatform(valid[i]);
        }
      }
    }
  } else {
    for (const p of valid) {
      await verifyPlatform(p);
    }
  }

  if (failures.length > 0) {
    console.error(`[stage-codelldb][error] ${failures.length} failure(s); see above.`);
    process.exitCode = 1;
  } else {
    log('All requested platforms processed successfully.');
  }
}

main().catch(error => {
  fail(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exitCode = 1;
});

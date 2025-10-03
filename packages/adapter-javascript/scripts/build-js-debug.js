#!/usr/bin/env node
/**
 * Vendor Microsoft js-debug vsDebugServer.js into vendor/js-debug
 *
 * - Fetches prebuilt artifact from GitHub releases (preferred)
 * - Optional build-from-source fallback when explicitly enabled
 * - Cross-platform (Windows/macOS/Linux), Node 18+ (uses global fetch)
 * - Deterministic output:
 *    - vendor/js-debug/vsDebugServer.js
 *    - vendor/js-debug/vsDebugServer.js.sha256
 *    - vendor/js-debug/manifest.json
 *
 * Environment variables:
 *   - JS_DEBUG_VERSION: tag or 'latest' (default: 'latest')
 *   - GH_TOKEN: GitHub token to avoid API rate limits (optional)
 *   - JS_DEBUG_FORCE_REBUILD: 'true' to ignore cache and refetch
 *   - JS_DEBUG_BUILD_FROM_SOURCE: 'true' to build from source if prebuilt fetch fails or is desired
 *
 * Exit codes:
 *   - 0 on success or cache-hit
 *   - non-zero with actionable error message on failure
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import tar from 'tar';
import extractZip from 'extract-zip';
import { ensureDir, copy as fsxCopy } from 'fs-extra';
import { selectBestAsset, normalizePath } from './lib/js-debug-helpers.js';
import { determineVendoringPlan } from './lib/vendor-strategy.js';

const VERSION = process.env.JS_DEBUG_VERSION || 'latest';
const FORCE = (process.env.JS_DEBUG_FORCE_REBUILD || '').trim() === 'true';
const GH_TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, '..');
const VENDOR_DIR = path.join(PKG_ROOT, 'vendor', 'js-debug');
const VENDOR_FILE = path.join(VENDOR_DIR, 'vsDebugServer.js');
const VENDOR_FILE_CJS = path.join(VENDOR_DIR, 'vsDebugServer.cjs');
const CHECKSUM_FILE = VENDOR_FILE + '.sha256';
const MANIFEST_FILE = path.join(VENDOR_DIR, 'manifest.json');

const REPO_OWNER = 'microsoft';
const REPO_NAME = 'vscode-js-debug';
const API_BASE = 'https://api.github.com';

function logInfo(msg) {
  process.stdout.write(`[js-debug vendor] ${msg}\n`);
}
function logWarn(msg) {
  process.stderr.write(`[js-debug vendor][warn] ${msg}\n`);
}
function logError(msg) {
  process.stderr.write(`[js-debug vendor][error] ${msg}\n`);
}

/**
 * Abortable fetch with timeout and headers
 * Retries handled by caller
 */
async function fetchJsonWithTimeout(url, { signal, headers = {} } = {}) {
  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'debugmcp/adapter-javascript',
      ...(GH_TOKEN ? { 'Authorization': `Bearer ${GH_TOKEN}` } : {}),
      ...headers
    },
    signal
  });
  const text = await resp.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // ignore parse error; will report body text if needed
  }
  return { resp, data, text };
}

function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

function makeTmpDir(prefix = 'js-debug-') {
  return fsp.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function safeRmRf(p) {
  try {
    await fsp.rm(p, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

/**
 * Get GitHub release JSON either /releases/latest or /releases/tags/:tag
 * Retries on transient errors (HTTP 5xx, network), not on 404 tag-not-found.
 */
async function getRelease(version) {
  const url = version === 'latest'
    ? `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`
    : `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/releases/tags/${encodeURIComponent(version)}`;

  const maxAttempts = 3;
  const timeoutMs = 30_000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const { resp, data, text } = await fetchJsonWithTimeout(url, { signal: controller.signal });
      clearTimeout(t);

      if (resp.status === 200) {
        return data;
      }

      // Handle 404 tag not found without retry
      if (resp.status === 404) {
        const bodyMsg = data?.message || text || 'Tag not found';
        throw new Error(`GitHub release not found for '${version}'. ${bodyMsg}`);
      }

      if (resp.status === 403) {
        const rate = {
          limit: resp.headers.get('X-RateLimit-Limit'),
          remaining: resp.headers.get('X-RateLimit-Remaining'),
          reset: resp.headers.get('X-RateLimit-Reset')
        };
        const bodyMsg = data?.message || text || 'Forbidden';
        throw new Error(
          `GitHub API returned 403 (rate limited or forbidden). ${bodyMsg}\n` +
          `RateLimit: limit=${rate.limit}, remaining=${rate.remaining}, reset=${rate.reset}\n` +
          `Tip: set GH_TOKEN to increase rate limits, or pin JS_DEBUG_VERSION to a specific tag.`
        );
      }

      // Other non-200 responses: retry for 5xx, otherwise throw
      if (resp.status >= 500 && resp.status < 600) {
        throw new Error(`GitHub API ${resp.status} ${resp.statusText || ''}`);
      } else {
        const bodyMsg = data?.message || text || `HTTP ${resp.status}`;
        throw new Error(`GitHub API error: ${bodyMsg}`);
      }
    } catch (err) {
      clearTimeout(t);
      if (attempt === maxAttempts) {
        throw err;
      }
      // exponential backoff
      const backoff = Math.floor(500 * Math.pow(2, attempt - 1));
      logWarn(`Release fetch failed (attempt ${attempt}/${maxAttempts}): ${(err && err.message) || err}. Retrying in ${backoff}ms...`);
      await delay(backoff);
    }
  }
  throw new Error('Unexpected: getRelease exhausted retries.');
}

async function downloadWithRetries(url, destFile) {
  const maxAttempts = 3;
  const timeoutMs = 30_000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'debugmcp/adapter-javascript',
          ...(GH_TOKEN ? { 'Authorization': `Bearer ${GH_TOKEN}` } : {})
        },
        signal: controller.signal
      });

      if (!resp.ok) {
        const status = resp.status;
        const statusText = resp.statusText || '';
        if (status === 403) {
          throw new Error(
            `Download failed: HTTP 403 ${statusText} (${url}). Tip: set GH_TOKEN to increase rate limits.\n` +
            ` - Windows (cmd):  set GH_TOKEN=xxxxx && pnpm -w -F @debugmcp/adapter-javascript run build:adapter\n` +
            ` - Bash:           GH_TOKEN=xxxxx pnpm -w -F @debugmcp/adapter-javascript run build:adapter`
          );
        }
        throw new Error(`Download failed: HTTP ${status} ${statusText} (${url})`);
      }

      const buf = Buffer.from(await resp.arrayBuffer());
      const cl = resp.headers.get('content-length');
      if (cl && buf.length !== Number(cl)) {
        throw new Error(`Download size mismatch: expected ${Number(cl)}, got ${buf.length}`);
      }
      await fsp.writeFile(destFile, buf);

      clearTimeout(t);
      return;
    } catch (err) {
      clearTimeout(t);
      if (attempt === maxAttempts) {
        throw err;
      }
      const backoff = Math.floor(500 * Math.pow(2, attempt - 1));
      logWarn(`Download failed (attempt ${attempt}/${maxAttempts}): ${(err && err.message) || err}. Retrying in ${backoff}ms...`);
      await delay(backoff);
    }
  }
}

async function extractArchive(archiveFile, type, outDir) {
  await ensureDir(outDir);
  if (type === 'tgz') {
    await tar.x({
      file: archiveFile,
      cwd: outDir,
      // Keep structure; do not strip
      strict: true
    });
  } else if (type === 'zip') {
    await extractZip(archiveFile, { dir: outDir });
  } else {
    throw new Error(`Unsupported archive type: ${type}`);
  }
}


async function sampleFiles(rootDir, limit) {
  const out = [];
  const queue = [rootDir];
  while (queue.length && out.length < limit) {
    const dir = queue.shift();
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        queue.push(full);
      } else if (ent.isFile()) {
        out.push(full);
        if (out.length >= limit) break;
      }
    }
  }
  return out;
}
 
/**
 * Locate the DAP server entry within extracted or built contents and normalize to our canonical filename.
 * Prefers, in order:
 *  - js-debug/src/dapDebugServer.js (prebuilt js-debug-dap archives)
 *  - dist/src/dapDebugServer.js (built from source on newer tags)
 *  - extension/src/dapDebugServer.js (VSIX packaging)
 *  - dist/vsDebugServer.js (older tags)
 * Falls back to BFS search for any file named dapDebugServer.js or vsDebugServer.js.
 */
async function findServerEntry(rootDir) {
  const candidates = [
    // Prefer Node/CJS bundle first when available
    'dist/vsDebugServer.js',
    // Then look for built-from-source ESM entry that may still work under CJS wrapper
    'dist/src/dapDebugServer.js',
    // VSIX packaging
    'extension/src/dapDebugServer.js',
    // Fallback to source ESM (may require wrapper)
    'js-debug/src/dapDebugServer.js'
  ];
  for (const rel of candidates) {
    const abs = path.join(rootDir, rel);
    try {
      const st = await fsp.stat(abs);
      if (st.isFile()) {
        return { abs, rel: normalizePath(rel) };
      }
    } catch {
      // continue
    }
  }
 
  // Fallback: BFS for filenames
  const targetNames = new Set(['dapDebugServer.js', 'vsDebugServer.js']);
  const queue2 = [rootDir];
  while (queue2.length) {
    const dir = queue2.shift();
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        queue2.push(full);
      } else if (ent.isFile() && targetNames.has(ent.name)) {
        const rel = normalizePath(path.relative(rootDir, full));
        return { abs: full, rel };
      }
    }
  }
 
  const sample = await sampleFiles(rootDir, 30);
  throw new Error(
    'No DAP server entry found after extraction/build. Expected dapDebugServer.js (newer tags) or vsDebugServer.js (older tags).\n' +
    `Sample files under ${normalizePath(rootDir)}:\n` +
    sample.map(s => ` - ${normalizePath(s)}`).join('\n')
  );
}
 
async function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  await new Promise((resolve, reject) => {
    const rs = fs.createReadStream(filePath);
    rs.on('error', reject);
    rs.on('end', resolve);
    rs.on('data', (chunk) => hash.update(chunk));
  });
  return hash.digest('hex');
}

async function writeChecksum(filePath, checksumPath) {
  const sha = await sha256File(filePath);
  await fsp.writeFile(checksumPath, `${sha}\n`, 'utf8');
  return sha;
}

async function writeManifest({ source, repo, version, asset, sha256, original }) {
  const manifest = {
    source,
    repo,
    version,
    asset,
    sha256,
    ...(original ? { original } : {}),
    fetchedAt: new Date().toISOString()
  };
  await fsp.writeFile(MANIFEST_FILE, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

/**
 * Spawn a command cross-platform, returning stdout on success.
 * Falls back to shell=true on Windows when necessary and logs a short summary.
 */
function execCmd(cmd, args, opts = {}) {
  const useShellFallback = process.platform === 'win32' && opts.shellFallback;
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd || PKG_ROOT,
      stdio: opts.stdio || 'pipe',
      shell: useShellFallback || false
    });

    let stdout = '';
    let stderr = '';
    if (child.stdout) child.stdout.on('data', d => (stdout += d.toString()));
    if (child.stderr) child.stderr.on('data', d => (stderr += d.toString()));

    child.on('error', (err) => {
      if (useShellFallback) {
        reject(err);
      } else if (process.platform === 'win32') {
        // Try shell fallback automatically once on Windows
        execCmd(cmd + ' ' + (args || []).map(a => JSON.stringify(a)).join(' '), [], { ...opts, shellFallback: true })
          .then(resolve, reject);
      } else {
        reject(err);
      }
    });
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} ${args?.join(' ') || ''} failed with code ${code}\n${stderr}`));
    });
  });
}

async function isCmdAvailable(cmd) {
  try {
    await execCmd(cmd, ['--version']);
    return true;
  } catch {
    return false;
  }
}

async function detectRepoPackageManager(repoDir) {
  // Prefer yarn if yarn.lock present and yarn is available
  const hasYarnLock = fs.existsSync(path.join(repoDir, 'yarn.lock'));
  const yarnOk = await isCmdAvailable(process.platform === 'win32' ? 'yarn.cmd' : 'yarn');
  if (hasYarnLock && yarnOk) return 'yarn';

  // Next prefer pnpm if pnpm-lock.yaml present and pnpm is available
  const hasPnpmLock = fs.existsSync(path.join(repoDir, 'pnpm-lock.yaml'));
  const pnpmOk = await isCmdAvailable(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm');
  if (hasPnpmLock && pnpmOk) return 'pnpm';
 
  // Otherwise fall back to npm
  return 'npm';
}

/**
 * Build from source fallback. Only invoked when explicitly requested.
 */
async function buildFromSource(version) {
  const tmp = await makeTmpDir('js-debug-src-');
  logInfo(`Building from source in ${normalizePath(tmp)} ...`);
  try {
    const repoUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}.git`;
    const branchArg = version === 'latest' ? [] : ['--branch', version];
    await execCmd('git', ['clone', '--depth', '1', ...branchArg, repoUrl, tmp], { stdio: 'inherit' });

    const pm = await detectRepoPackageManager(tmp);
    logInfo(`Using package manager: ${pm}`);

    if (pm === 'yarn') {
      await execCmd(process.platform === 'win32' ? 'yarn.cmd' : 'yarn', ['install', '--frozen-lockfile'], { cwd: tmp, stdio: 'inherit', env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' } });
    } else if (pm === 'pnpm') {
      await execCmd(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['install'], { cwd: tmp, stdio: 'inherit', env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' } });
    } else {
      // Use npm ci if lockfile present; else npm install
      const useCi = fs.existsSync(path.join(tmp, 'package-lock.json'));
      await execCmd(process.platform === 'win32' ? 'npm.cmd' : 'npm', [useCi ? 'ci' : 'install', '--legacy-peer-deps'], { cwd: tmp, stdio: 'inherit', env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' } });
    }
 
    // Build bundle
    if (pm === 'yarn') {
      await execCmd(process.platform === 'win32' ? 'yarn.cmd' : 'yarn', ['gulp', 'vsDebugServerBundle'], { cwd: tmp, stdio: 'inherit' });
    } else {
      await execCmd(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['gulp', 'vsDebugServerBundle'], { cwd: tmp, stdio: 'inherit' });
    }

    // Locate built server entry and normalize
    const candidate = path.join(tmp, 'dist', 'vsDebugServer.js');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const found = await findServerEntry(tmp);
    return found.abs;
  } finally {
    await safeRmRf(tmp);
  }
}

async function findAllByBasename(rootDir, targetNames) {
  const found = [];
  const queue = [rootDir];
  while (queue.length) {
    const dir = queue.shift();
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        queue.push(full);
      } else if (ent.isFile() && targetNames.has(ent.name)) {
        found.push(full);
      }
    }
  }
  return found;
}

async function main() {
  // Idempotent skip only if artifact AND required sidecars exist
  const bootloaderRequired = path.join(VENDOR_DIR, 'bootloader.js');
  if (!FORCE && fs.existsSync(VENDOR_FILE) && fs.existsSync(bootloaderRequired)) {
    logInfo(`Artifact already present at ${normalizePath(VENDOR_FILE)} and bootloader present. Set JS_DEBUG_FORCE_REBUILD=true to rebuild.`);
    process.exitCode = 0;
    return;
  }
  if (!FORCE && fs.existsSync(VENDOR_FILE) && !fs.existsSync(bootloaderRequired)) {
    logWarn('Artifact present but bootloader.js missing; proceeding to re-vendor to restore sidecars.');
  }

  await ensureDir(VENDOR_DIR);

  const plan = determineVendoringPlan(process.env);
  if (plan.mode === 'local') {
    const localPath = plan.localPath;
    try {
      const stat = await fsp.stat(localPath);
      if (!stat.isFile()) {
        throw new Error(`JS_DEBUG_LOCAL_PATH does not point to a file: ${normalizePath(localPath)}`);
      }
      const base = path.basename(localPath);
      if (base !== 'vsDebugServer.js' && base !== 'dapDebugServer.js') {
        logWarn(`JS_DEBUG_LOCAL_PATH basename is '${base}'. Expected 'dapDebugServer.js' or 'vsDebugServer.js'. Proceeding to copy and normalize.`);
      }
    } catch (e) {
      logError(`Invalid JS_DEBUG_LOCAL_PATH: ${(e && e.message) || e}`);
      logError('Example usage:\n' +
        ' - Windows (cmd):  cmd /c "set JS_DEBUG_FORCE_REBUILD=true && set JS_DEBUG_LOCAL_PATH=C:\\\\path\\\\to\\\\vsDebugServer.js && pnpm -w -F @debugmcp/adapter-javascript run build:adapter"\n' +
        ' - Bash:           JS_DEBUG_FORCE_REBUILD=true JS_DEBUG_LOCAL_PATH=/abs/path/vsDebugServer.js pnpm -w -F @debugmcp/adapter-javascript run build:adapter');
      process.exitCode = 1;
      return;
    }

    await ensureDir(VENDOR_DIR);
    await fsp.copyFile(localPath, VENDOR_FILE);
    // Also emit a .cjs copy to force CommonJS execution regardless of parent package type
    try { await fsp.copyFile(VENDOR_FILE, VENDOR_FILE_CJS); } catch {}
    const sha = await writeChecksum(VENDOR_FILE, CHECKSUM_FILE);
    await writeManifest({
      source: 'local',
      repo: `${REPO_OWNER}/${REPO_NAME}`,
      version: 'local-override',
      asset: 'local-path',
      sha256: sha,
      original: normalizePath(localPath)
    });
    const size = (await fsp.stat(VENDOR_FILE)).size;
    logInfo(`Success (local override): vendored vsDebugServer.js (${size} bytes)`);
    logInfo(` - path: ${normalizePath(VENDOR_FILE)}`);
    logInfo(` - sha256: ${sha}`);
    process.exitCode = 0;
    return;
  }

  let tmpDir;
  let resolvedVersion = VERSION;
  try {
    // Attempt prebuilt path first
    tmpDir = await makeTmpDir('js-debug-dl-');
    logInfo(`Fetching GitHub release '${VERSION}' for ${REPO_OWNER}/${REPO_NAME} ...`);
    const release = await getRelease(VERSION);
    if (release?.tag_name) {
      resolvedVersion = release.tag_name;
    }

    const assets = Array.isArray(release?.assets) ? release.assets : [];
    const best = selectBestAsset(assets);
    const archiveFile = path.join(tmpDir, `asset.${best.type === 'tgz' ? 'tgz' : 'zip'}`);

    logInfo(`Selected asset: ${best.name} (${best.type}). Downloading...`);
    await downloadWithRetries(best.url, archiveFile);

    const extractDir = path.join(tmpDir, 'extract');
    await extractArchive(archiveFile, best.type, extractDir);

    logInfo('Locating DAP server entry in extracted contents...');
    const found = await findServerEntry(extractDir);
 
  // Copy artifact normalized to canonical filename
  await ensureDir(VENDOR_DIR);
  await fsp.copyFile(found.abs, VENDOR_FILE);
  // Also emit a .cjs copy to force CommonJS execution regardless of parent package type
  try { await fsp.copyFile(VENDOR_FILE, VENDOR_FILE_CJS); } catch {}
  // Copy known sidecar assets required by js-debug runtime (e.g., wasm, maps, json, native)
  try {
    const serverDir = path.dirname(found.abs);
    const baseName = path.basename(found.abs);
    const names = await fsp.readdir(serverDir);
    for (const name of names) {
      if (name === baseName) continue;
      const ext = path.extname(name).toLowerCase();
      // Copy required runtime sidecars:
      // - binary/metadata assets (.wasm/.map/.json/.node)
      // - critical JS sidecars used by js-debug node launcher (bootloader.js, watchdog.js)
      if (
        ext === '.wasm' ||
        ext === '.map' ||
        ext === '.json' ||
        ext === '.node' ||
        name === 'bootloader.js' ||
        name === 'watchdog.js'
      ) {
        await fsp.copyFile(path.join(serverDir, name), path.join(VENDOR_DIR, name));
      }
    }
  } catch {
    // ignore; missing sidecars will surface at runtime
    void 0;
  }

  // Ensure critical JS sidecars (bootloader/watchdog) are vendored to root
  try {
    const supportTargets = new Set(['bootloader.js', 'watchdog.js']);
    const hits = await findAllByBasename(extractDir, supportTargets);
    for (const src of hits) {
      const base = path.basename(src);
      try { await fsp.copyFile(src, path.join(VENDOR_DIR, base)); } catch (err) { logWarn(`Support sidecar copy failed: ${(err && err.message) || err}`); }
    }
  } catch (err) { logWarn(`Support sidecar search failed: ${(err && err.message) || err}`); }

  // Build-time hard check for bootloader.js
  try {
    await fsp.stat(path.join(VENDOR_DIR, 'bootloader.js'));
  } catch {
    throw new Error(
      'Vendoring error: bootloader.js was not found. ' +
      'Archive layout may have changed. ' +
      'Action items:\n' +
      ' - Inspect js-debug artifact; ensure src/bootloader.js exists.\n' +
      ' - Optionally set JS_DEBUG_BUILD_FROM_SOURCE=true or pin JS_DEBUG_VERSION.'
    );
  }
 
  // Copy 'vendor' subdirectory if present (contains acorn.js, etc.)
  try {
    const vendorSrc = path.join(path.dirname(found.abs), 'vendor');
    const st = await fsp.stat(vendorSrc).catch(() => null);
    if (st && st.isDirectory()) {
      await fsxCopy(vendorSrc, path.join(VENDOR_DIR, 'vendor'), { overwrite: true });
    }
  } catch {
    // ignore missing vendor dir
    void 0;
  }

  // Ensure local package.json forces CommonJS
  try {
    const pkgJsonPath = path.join(VENDOR_DIR, 'package.json');
    const pkgJson = {
      name: 'vendored-js-debug-runtime',
      private: true,
      type: 'commonjs',
      version: '0.0.0',
      description: 'Local boundary to force Node to treat js-debug as CommonJS'
    };
    await fsp.writeFile(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n', 'utf8');
  } catch {
    // ignore write errors
    void 0;
  }

  // Write checksum and manifest
    const sha = await writeChecksum(VENDOR_FILE, CHECKSUM_FILE);
    await writeManifest({
      source: 'prebuilt',
      repo: `${REPO_OWNER}/${REPO_NAME}`,
      version: resolvedVersion,
      asset: best.name,
      sha256: sha,
      original: normalizePath(found.rel)
    });

    const size = (await fsp.stat(VENDOR_FILE)).size;
    logInfo(`Success: vendored vsDebugServer.js (${size} bytes)`);
    logInfo(` - path: ${normalizePath(VENDOR_FILE)}`);
    logInfo(` - sha256: ${sha}`);
    logInfo(` - version: ${resolvedVersion}`);

    // If explicitly requested, build from source and override the prebuilt artifact.
    if (plan.mode === 'prebuilt-then-source') {
      logInfo('JS_DEBUG_BUILD_FROM_SOURCE=true detected: building from source and overriding prebuilt...');
      try {
        const builtPath = await buildFromSource(resolvedVersion);
        await ensureDir(VENDOR_DIR);
        await fsp.copyFile(builtPath, VENDOR_FILE);
        // Also emit a .cjs copy to force CommonJS execution regardless of parent package type
        try { await fsp.copyFile(VENDOR_FILE, VENDOR_FILE_CJS); } catch {}
        // Copy sidecar assets from the same directory as the built server file
        try {
          const serverDir = path.dirname(builtPath);
          const baseName = path.basename(builtPath);
          const names = await fsp.readdir(serverDir);
          for (const name of names) {
            if (name === baseName) continue;
            const ext = path.extname(name).toLowerCase();
            if (ext === '.wasm' || ext === '.map' || ext === '.json' || ext === '.node') {
              await fsp.copyFile(path.join(serverDir, name), path.join(VENDOR_DIR, name));
            }
          }
        } catch {
          // ignore; missing sidecars will surface at runtime
          void 0;
        }
        const sha2 = await writeChecksum(VENDOR_FILE, CHECKSUM_FILE);
        await writeManifest({
          source: 'source-override',
          repo: `${REPO_OWNER}/${REPO_NAME}`,
          version: resolvedVersion,
          asset: 'built-from-source',
          sha256: sha2,
          original: normalizePath(path.relative(PKG_ROOT, builtPath))
        });
        const size2 = (await fsp.stat(VENDOR_FILE)).size;
        logInfo(`Success (source override): vendored vsDebugServer.js (${size2} bytes)`);
        logInfo(` - path: ${normalizePath(VENDOR_FILE)}`);
        logInfo(` - sha256: ${sha2}`);
        logInfo(` - version: ${resolvedVersion}`);
      } catch (err3) {
        logWarn(`Source override failed, keeping prebuilt artifact: ${(err3 && err3.message) || err3}`);
      }
    }

    process.exitCode = 0;
  } catch (err) {
    logWarn(`Prebuilt path failed: ${(err && err.message) || err}`);

    if (plan.mode === 'prebuilt-then-source') {
      logInfo('JS_DEBUG_BUILD_FROM_SOURCE=true, attempting source build fallback...');
      try {
        const builtPath = await buildFromSource(resolvedVersion);
        await ensureDir(VENDOR_DIR);
        await fsp.copyFile(builtPath, VENDOR_FILE);
        // Also emit a .cjs copy to force CommonJS execution regardless of parent package type
        try { await fsp.copyFile(VENDOR_FILE, VENDOR_FILE_CJS); } catch {}
        // Copy sidecar assets from the same directory as the built server file
        try {
          const serverDir = path.dirname(builtPath);
          const baseName = path.basename(builtPath);
          const names = await fsp.readdir(serverDir);
          for (const name of names) {
            if (name === baseName) continue;
            const ext = path.extname(name).toLowerCase();
            if (ext === '.wasm' || ext === '.map' || ext === '.json' || ext === '.node') {
              await fsp.copyFile(path.join(serverDir, name), path.join(VENDOR_DIR, name));
            }
          }
        } catch {
          // ignore; missing sidecars will surface at runtime
          void 0;
        }
        const sha = await writeChecksum(VENDOR_FILE, CHECKSUM_FILE);
        await writeManifest({
          source: 'source',
          repo: `${REPO_OWNER}/${REPO_NAME}`,
          version: resolvedVersion,
          asset: 'built-from-source',
          sha256: sha
        });
        const size = (await fsp.stat(VENDOR_FILE)).size;
        logInfo(`Success (source build): vendored vsDebugServer.js (${size} bytes)`);
        logInfo(` - path: ${normalizePath(VENDOR_FILE)}`);
        logInfo(` - sha256: ${sha}`);
        logInfo(` - version: ${resolvedVersion}`);
        process.exitCode = 0;
        return;
      } catch (err2) {
        logError(`Source build failed: ${(err2 && err2.message) || err2}`);
        logError('Actionable tips:\n' +
          ' - Ensure git/node/npm/pnpm are installed and on PATH\n' +
          ' - Try pinning JS_DEBUG_VERSION to a specific tag (e.g., v1.95.0)\n' +
          ' - Check network/proxy settings (HTTPS_PROXY/HTTP_PROXY)\n');
        process.exitCode = 1;
        return;
      }
    }

    logError('Failed to vendor js-debug prebuilt artifact.');
    logError('Actionable tips:\n' +
      ' - If you hit rate limits (403), set GH_TOKEN to increase API limits\n' +
      '   Windows (cmd):  set GH_TOKEN=xxxxx && pnpm -w -F @debugmcp/adapter-javascript run build:adapter\n' +
      '   Bash:           GH_TOKEN=xxxxx pnpm -w -F @debugmcp/adapter-javascript run build:adapter\n' +
      ' - If tag not found (404), verify JS_DEBUG_VERSION or use "latest"\n' +
      ' - If no asset matched, try pinning a known version or enable JS_DEBUG_BUILD_FROM_SOURCE=true\n' +
      '   Windows (cmd):  cmd /c "set JS_DEBUG_BUILD_FROM_SOURCE=true && pnpm -w -F @debugmcp/adapter-javascript run build:adapter"\n' +
      '   Bash:           JS_DEBUG_BUILD_FROM_SOURCE=true pnpm -w -F @debugmcp/adapter-javascript run build:adapter\n' +
      ' - To bypass network, use a local override path to an existing vsDebugServer.js\n' +
      '   Windows (cmd):  cmd /c "set JS_DEBUG_FORCE_REBUILD=true && set JS_DEBUG_LOCAL_PATH=C:\\\\path\\\\vsDebugServer.js && pnpm -w -F @debugmcp/adapter-javascript run build:adapter"\n' +
      '   Bash:           JS_DEBUG_FORCE_REBUILD=true JS_DEBUG_LOCAL_PATH=/abs/path/vsDebugServer.js pnpm -w -F @debugmcp/adapter-javascript run build:adapter\n' +
      ' - If vsDebugServer.js not found after extraction, packaging may have changed; consider source fallback\n');
    process.exitCode = 1;
  } finally {
    if (tmpDir) await safeRmRf(tmpDir);
  }
}

await main();

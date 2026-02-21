# [PROVISIONAL] js-debug vendoring and bootloader.js runtime requirement

Status: PROVISIONAL (documented mitigation; implementation in progress)
Last Updated: 2025-10-02

This note documents a recurring startup failure with the JavaScript debug adapter (vscode-js-debug) when vendored into this monorepo, the underlying cause, and a robust vendoring strategy (including build-time checks) to avoid regression. Keep this under version control for future maintenance, especially if upstream packaging changes.

## Summary

- Symptom (Windows 11, Node 22):
  - Launching js-debug via the CommonJS entry (vsDebugServer.cjs) fails at process start with:
    - Error: Cannot find module '.../vendor/js-debug/bootloader.js'
    - Require stack: internal/preload
  - Downstream effect: No DAP events; E2E tests time out waiting for "stopped" etc.

- Root cause:
  - In recent js-debug distributions, support files (bootloader.js, watchdog.js) are shipped under `js-debug/src/`.
  - The standalone CommonJS launcher `vsDebugServer.cjs` lives at `js-debug/` and uses Node’s preload (`--require <bootloader.js>`) so it requires `bootloader.js` at a path relative to itself.
  - If we vendor only `vsDebugServer.cjs` (and binary sidecars) but do not place `bootloader.js` next to it, Node crashes during internal preload.

- Key takeaway:
  - For stable standalone use of `vsDebugServer.cjs`, ensure `bootloader.js` (and optionally `watchdog.js`) are co-located in the same directory as `vsDebugServer.cjs` in our vendor folder.

## Background and upstream layout

- Historically:
  - Older js-debug releases exposed the ESM entry `src/dapDebugServer.js`, with support files also under `src/`.
  - Newer releases provide a CJS wrapper `vsDebugServer.cjs` at top-level (e.g., `js-debug/`), while keeping support files under `src/`.

- Resulting mismatch:
  - The wrapper implicitly expects support files at a specific relative path (effectively as siblings).
  - Typical tarball layout (js-debug-dap-*.tar.gz):
    - `js-debug/vsDebugServer.cjs`
    - `js-debug/src/dapDebugServer.js`
    - `js-debug/src/bootloader.js`
    - `js-debug/src/watchdog.js`
    - other files/assets…

## Provisional vendoring strategy (search-and-copy + build-time check)

Applies to our vendoring script at:
- `packages/adapter-javascript/scripts/build-js-debug.js`

After extracting the js-debug artifact and selecting the server entry (the primary vendor file is `vsDebugServer.js` in the dist directory; `vsDebugServer.cjs` is also produced as a CommonJS mirror):

1) Search for support files in the extraction tree:
   - Look for filenames exactly:
     - `bootloader.js` (REQUIRED)
     - `hash.js` (REQUIRED — used by bootloader at runtime)
     - `watchdog.js` (OPTIONAL but recommended to copy if present)

2) Copy to vendor root (next to the launcher):
   - Destination directory: `packages/adapter-javascript/vendor/js-debug/`
   - Ensure the copied files sit alongside `vsDebugServer.cjs`.

3) Build-time existence check:
   - After copying, verify `vendor/js-debug/bootloader.js` exists.
   - If missing, fail the vendoring step with a clear, actionable message (see below).

4) Continue copying binary sidecars:
   - Keep existing logic to copy `.wasm`, `.map`, `.json`, `.node` from near the selected entry (and/or from known sidecar locations).
   - This is orthogonal to bootloader/watchdog and should remain intact.

### Pseudocode snippet (integration point)

Insert this after locating `found.abs` (the selected adapter entry) and before declaring success:

```js
import path from 'node:path';
import fsp from 'node:fs/promises';
import fs from 'node:fs';

async function findAllByBasename(rootDir, targetNames) {
  const found = [];
  const q = [rootDir];
  while (q.length) {
    const dir = q.shift();
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        q.push(full);
      } else if (ent.isFile() && targetNames.has(ent.name)) {
        found.push(full);
      }
    }
  }
  return found;
}

// After `const found = await findServerEntry(extractDir);`

// Ensure launcher and vendor dir exist already
await fsp.copyFile(found.abs, VENDOR_FILE);
try { await fsp.copyFile(VENDOR_FILE, VENDOR_FILE_CJS); } catch { /* optional CJS mirror */ }

// NEW: Search-and-copy support JS sidecars from anywhere in the extracted tree
const supportTargets = new Set(['bootloader.js', 'hash.js', 'watchdog.js']);
const supportFiles = await findAllByBasename(path.dirname(found.abs), supportTargets);

// Copy any found support files to the vendor root, preserving basename
for (const supportSrc of supportFiles) {
  const base = path.basename(supportSrc);
  await fsp.copyFile(supportSrc, path.join(VENDOR_DIR, base));
}

// Create a package.json CommonJS boundary so Node resolves CJS requires correctly
await fsp.writeFile(
  path.join(VENDOR_DIR, 'package.json'),
  JSON.stringify({ type: 'commonjs' }, null, 2) + '\n'
);

// Build-time hard check for bootloader.js and hash.js
const bootloaderPath = path.join(VENDOR_DIR, 'bootloader.js');
const hashPath = path.join(VENDOR_DIR, 'hash.js');
if (!fs.existsSync(bootloaderPath) || !fs.existsSync(hashPath)) {
  throw new Error(
    'Vendoring error: bootloader.js was not found in the js-debug artifact. ' +
    'This release layout may have changed. ' +
    'Action items:\n' +
    ' - Verify artifact contents; ensure bootloader.js is present under js-debug/src/ in the archive.\n' +
    ' - Consider setting JS_DEBUG_VERSION to a known-good tag.\n' +
    ' - Optionally enable JS_DEBUG_BUILD_FROM_SOURCE=true to build js-debug and re-vendor.\n'
  );
}
```

Notes:
- Keep logging around these steps so failures are easy to diagnose in CI logs.
- Prefer failing fast at vendoring time over a runtime crash in tests.

## Alternatives and fallbacks (if search-and-copy fails)

If upstream packaging changes and the simple search-and-copy cannot find the support files:

- Option A: Preserve src tree AND flatten
  - Keep `vendor/js-debug/src/*` intact (full copy of extracted `src/`) AND still attempt to copy `bootloader.js` to the vendor root.
  - This gives us a known path for ESM use and makes future troubleshooting easier, while preserving CJS expectations.

- Option B: Use ESM entry (`src/dapDebugServer.js`) instead of CJS wrapper
  - Update our adapter launch command to:
    - `node vendor/js-debug/src/dapDebugServer.js <port>`
  - This path expects a coherent `src/` tree; avoid flattening. Ensure node version supports ESM semantics used by js-debug.
  - Consider project-wide implications (we currently integrate assuming a CJS wrapper).

- Option C: Try alternate artifact sources while staying unpinned
  - Some integrations use the VSIX layout or a different prebuilt bundle variant.
  - Our script could support selecting artifact type (release tarball vs VSIX). Note: redistribution/licensing and network stability should be evaluated.

- Option D: Build-from-source fallback
  - Already supported by our script via `JS_DEBUG_BUILD_FROM_SOURCE=true`.
  - Building from source allows us to locate `vsDebugServer.js` or `src/dapDebugServer.js` deterministically and gather support files in one pass.
  - Adds build time and tooling requirements (git/node/pm), but is robust.

- Option E: As a last resort, pin
  - We do not pin by default per team decision, but if CI becomes unstable, pinning `JS_DEBUG_VERSION` to a release that we validated restores determinism while we investigate upstream changes.

## Operational guidance

- Where this logic lives:
  - `packages/adapter-javascript/scripts/build-js-debug.js`
  - It already handles downloading/extracting the artifact, selecting the server entry, copying sidecars, and writing a manifest. Add the search-and-copy + hard check as described.

- Post-vendoring verification:
  - Vendor dir should contain at least:
    - `vendor/js-debug/vsDebugServer.js` (primary entry)
    - `vendor/js-debug/vsDebugServer.cjs` (CJS mirror)
    - `vendor/js-debug/bootloader.js` (critical)
    - `vendor/js-debug/hash.js` (critical -- required by bootloader)
    - `vendor/js-debug/package.json` (CommonJS boundary)
    - (optional) `vendor/js-debug/watchdog.js`
    - plus any binary sidecars (`.node`, `.wasm`, `.json`, `.map`) copied per existing logic.

- Symptoms indicating this doc applies:
  - Immediate crash with `MODULE_NOT_FOUND: .../bootloader.js` and stack containing `internal/preload` while starting the adapter.
  - No DAP handshake or events; tests time out on first “stopped”.

## Testing checklist

- Local:
  - Run `pnpm -w -F @debugmcp/adapter-javascript run build:adapter` and verify vendor dir contents.
  - Launch adapter manually (or via tests) and confirm no bootloader error is emitted.

- CI:
  - Ensure logs include success lines from vendoring and explicit confirmation that `bootloader.js` exists.
  - Fail fast on missing bootloader with actionable message.

## Open items

- Confirm whether watchdog.js is required in all modes; keep copying it if present.
- Monitor upstream release notes for any packaging change involving `vsDebugServer.(c)js`, `src/`, or bootloader pathing.
- Revisit this document once the mitigation is fully implemented and the E2E tests pass across platforms. Remove PROVISIONAL when stable.

## Environment notes

- OS: Windows 11 x64 (repro)
- Node: v22.x
- Launch mode: DAP `pwa-node` via `node vendor/js-debug/vsDebugServer.cjs <port>`
- Current policy: Prefer not to pin `JS_DEBUG_VERSION` unless stability demands it.

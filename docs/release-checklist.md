# Release Checklist

Pre-release validation for mcp-debugger. Run `npm run release:dry-run` to automate most checks.

## Before Tagging

### Automated (via `npm run release:dry-run`)
- [ ] Package versions match (the dry-run script checks root plus **all 17** workspace packages, including the private/bundle-only `adapter-rust`, `adapter-cpp`, and `codelldb-common`; the five `codelldb-<platform>` payload packages are checked against the **CodeLLDB pin**, not the repo version)
- [ ] `CHANGELOG.md` has `[x.y.z] - YYYY-MM-DD` entry with date
- [ ] `CHANGELOG.md` has empty `[Unreleased]` section at top
- [ ] `npm run build` succeeds
- [ ] `npm run test:unit` passes
- [ ] `npm pack --dry-run` succeeds for packages in `PUBLISHED_PKGS` (see `scripts/release-dry-run.sh`)
- [ ] `release.yml` has `setup-java` (JDI bridge compiles with `--release 21`)
- [ ] `release.yml` has `setup-go` (Go adapter needs Delve)
- [ ] `release.yml` changelog extraction strips `v` prefix (`refs/tags/v}` not `refs/tags/}`)
- [ ] `release.yml` runs `scripts/resolve-workspace-deps.cjs` before publishing (published manifests must not contain `workspace:*`)

### Manual
- [ ] **Changelog fragments collated** — run `pnpm changelog:collate` **first**. It folds every `changelog.d/*.md` into `[Unreleased]`, creating category headings in Keep a Changelog order, and deletes the fragments. `pnpm run release:dry-run` fails if any fragment is left uncollated (#546)
- [ ] **CHANGELOG reconciled against git history** — run `git log --oneline v<prev>..HEAD --no-merges` and confirm every user-visible merge appears under `[Unreleased]` (dependency bumps and pure test/CI-internal changes may be omitted deliberately), and that the section has no duplicate `### Fixed`/`### Added` headers. Since #546 the CI gate requires a fragment on every user-visible PR, so this is now a verification rather than a catch-up — but entries merged **before** #546 are not covered by the gate (#462)
- [ ] **npm trusted publishing configured** — every *previously published* `@debugmcp/*` package must have a trusted publisher at npmjs.com → package Settings → Trusted Publisher (GitHub Actions; org/user: `debugmcp`, repo: `mcp-debugger`, workflow: `release.yml`, environment: blank). These packages publish token-free via OIDC; a publish without this config fails (404/permission error) — configure, then re-run via workflow_dispatch.
- [ ] **First-time packages** — any package that has never been on npm publishes via the `NPM_TOKEN` step in `release.yml` this once. After the release: configure its trusted publisher, then move it from the token step into the OIDC step. When no first-publishes remain, delete the token step and the `NPM_TOKEN` secret. (The five `@debugmcp/codelldb-<platform>` packages have their own token step and follow the same dance after their first release.)
- [ ] **Docker Hub credentials** — `DOCKER_USERNAME` and `DOCKER_PASSWORD` secrets are current
- [ ] **PyPI trusted publishing configured** — `debug-mcp-server-launcher` has a trusted publisher at pypi.org → project Settings → Publishing (GitHub Actions; owner: `debugmcp`, repo: `mcp-debugger`, workflow: `release.yml`, environment: blank). Publishing is token-free via OIDC with PEP 740 attestations; no `PYPI_TOKEN` secret is needed.
- [ ] `release.yml` default ref updated to current tag (for workflow_dispatch reruns)
- [ ] All new adapters have their toolchain in `release.yml` **both** `build-and-test` and `npm-publish` jobs
- [ ] New adapters intended for npm publishing have `publishConfig.access: "public"`, a `git+https` `repository.url` with `directory`, and appear in: `release.yml` (pack dry-run, publish, pack-artifacts) and `PUBLISHED_PKGS` in `scripts/release-dry-run.sh`. Bundle-only packages carry `"private": true`.
- [ ] Vendored-engine pins current: `packages/adapter-javascript/vendor-manifest.json` and `packages/codelldb-common/vendor-manifest.json` match the versions you intend to ship (digest verification fails the build on drift)
- [ ] **CodeLLDB bump procedure** (when bumping the CodeLLDB pin): update `vendor-manifest.json` (version + all five VSIX digests), update `DEFAULT_CODELLDB_VERSION` in `packages/codelldb-common/src/codelldb-resolver.ts`, run `node scripts/sync-versions.cjs` (it writes the pin into the five `packages/codelldb-<platform>/package.json` versions automatically), re-vendor, and run the rust + cpp + codelldb-common test suites (drift guards enforce manifest ↔ resolver ↔ package versions stay in sync). The next release then republishes exactly the five platform packages; at an unchanged pin the npm-view guards skip them.
- [ ] Contributors credited in CHANGELOG (check `git log --format="%an" | sort -u`)

## Common Failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| `E404`/permission error on OIDC `npm publish` | Trusted publisher not configured for the package | npmjs.com → package Settings → Trusted Publisher; re-run npm-publish via workflow_dispatch (per-package skip-guards make re-runs safe) |
| `E422` on `npm publish --provenance` | Missing/mismatched `repository.url` in package.json | Add `git+https://github.com/debugmcp/mcp-debugger.git` + `directory` |
| Published package uninstallable (`EUNSUPPORTEDPROTOCOL workspace:`) | Publish ran without workspace-dep resolution | Ensure `Resolve workspace deps for publish` step precedes publishing |
| Vendor script fails `Integrity check FAILED` | Upstream release asset changed since pinning | Investigate before bypassing; if a legitimate re-release, update the vendor-manifest digests in a reviewed PR |
| `release version 21 not supported` | JDK < 21 in workflow job | Add `actions/setup-java` with `java-version: '21'` |
| Changelog empty in GitHub Release | `release.yml` doesn't strip `v` from tag | Use `${RELEASE_REF#refs/tags/v}` |
| Build fails in `npm-publish` | Missing toolchain (Go/Java/etc.) | Mirror `build-and-test` toolchain setup in `npm-publish` job |
| `workspace:*` resolution error in CLI pack | pnpm pack without resolving workspace deps | Check `scripts/prepare-pack.js` handles new packages |

## After Tagging

- [ ] Monitor GitHub Actions → Release workflow (all **6** jobs: build-and-test, docker-publish, npm-publish, pypi-publish, **provenance**, create-release)
- [ ] GitHub Release has all expected assets: one `.tgz` per published package, `multiple.intoto.jsonl`, `multiple.sigstore.json`, `sbom.spdx.json`, `sbom.cyclonedx.json`
- [ ] GitHub Release body has the correct changelog content
- [ ] Verify provenance: `gh attestation verify debugmcp-mcp-debugger-x.y.z.tgz --repo debugmcp/mcp-debugger` (download the asset first)
- [ ] Verify npm: each published package shows the new version with `latest` dist-tag and a provenance badge on npmjs.com; `npm audit signatures` passes in a scratch project that installs them
- [ ] **Run the canary as the release gate**: `gh workflow run canary.yml -f version=x.y.z` and confirm every leg is green (Actions → "Canary (published artifacts)"). It installs the published npm package (default and `--omit=optional` + `CODELLDB_PATH` legs), runs npx, pulls the Docker image, and drives a breakpoint→variables→continue cycle in mock/python/rust on x64/arm64 Linux, arm64 macOS, and Windows — superseding the manual npx/docker spot checks below
- [ ] Fallback manual checks (when the canary can't run): `npx @debugmcp/mcp-debugger@x.y.z stdio` works (if the npx cache misbehaves, `npm install --prefix <tmp-dir>` is the reliable smoke path); `docker pull debugmcp/mcp-debugger:x.y.z` works
- [ ] Verify: PyPI has `debug-mcp-server-launcher==x.y.z`
- [ ] **Website content review** — audit https://debugmcp.io against what this release shipped (language matrix, tool count, feature claims, comparison table) and update `debugmcp/website`
- [ ] Update `SECURITY.md` supported-versions table if a new minor line started (should have happened pre-tag)
- [ ] First-publish follow-up: configure trusted publishers for any packages that just had their first release (see Manual section above)

# Release Checklist

Pre-release validation for mcp-debugger. Run `npm run release:dry-run` to automate most checks.

## Before Tagging

### Automated (via `npm run release:dry-run`)
- [ ] Package versions match (the dry-run script checks root plus the packages listed in its `PUBLISHED_PKGS`; adapter-go, adapter-java, and adapter-dotnet may not be included in the automated check yet)
- [ ] `CHANGELOG.md` has `[x.y.z] - YYYY-MM-DD` entry with date
- [ ] `CHANGELOG.md` has empty `[Unreleased]` section at top
- [ ] `npm run build` succeeds
- [ ] `npm run test:unit` passes
- [ ] `npm pack --dry-run` succeeds for packages in `PUBLISHED_PKGS` (see `scripts/release-dry-run.sh`)
- [ ] `release.yml` has `setup-java` (JDI bridge compiles with `--release 21`)
- [ ] `release.yml` has `setup-go` (Go adapter needs Delve)
- [ ] `release.yml` changelog extraction strips `v` prefix (`refs/tags/v}` not `refs/tags/}`)

### Manual
- [ ] **npm trusted publishing configured** — each `@debugmcp/*` package must have trusted publishing enabled at npmjs.com → package Settings → Configure Trusted Publishing (repo: `debugmcp/mcp-debugger`, workflow: `release.yml`). Note: the release dry-run script still checks for `NPM_TOKEN` as a repository secret.
- [ ] **Docker Hub credentials** — `DOCKER_USERNAME` and `DOCKER_PASSWORD` secrets are current
- [ ] **PyPI token** — `PYPI_TOKEN` secret is current
- [ ] `release.yml` default ref updated to current tag (for workflow_dispatch reruns)
- [ ] All new adapters have their toolchain in `release.yml` **both** `build-and-test` and `npm-publish` jobs
- [ ] Contributors credited in CHANGELOG (check `git log --format="%an" | sort -u`)

## Common Failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| `E404` on `npm publish` PUT | Trusted publishing not configured for the package | npmjs.com → package Settings → Configure Trusted Publishing |
| `release version 21 not supported` | JDK < 21 in workflow job | Add `actions/setup-java@v4` with `java-version: '21'` |
| Changelog empty in GitHub Release | `release.yml` doesn't strip `v` from tag | Use `${RELEASE_REF#refs/tags/v}` |
| Build fails in `npm-publish` | Missing toolchain (Go/Java/etc.) | Mirror `build-and-test` toolchain setup in `npm-publish` job |
| `workspace:*` resolution error | pnpm pack without resolving workspace deps | Check `scripts/prepare-pack.js` handles new packages |

## After Tagging

- [ ] Monitor GitHub Actions → Release workflow (all 5 jobs: build-and-test, docker-publish, npm-publish, pypi-publish, create-release)
- [ ] Verify: `npx @debugmcp/mcp-debugger@x.y.z stdio` works
- [ ] Verify: `docker pull debugmcp/mcp-debugger:x.y.z` works
- [ ] Verify: GitHub Release has correct changelog content

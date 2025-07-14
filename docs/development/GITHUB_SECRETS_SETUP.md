# GitHub Secrets Configuration for mcp-debugger

This document lists all the GitHub Secrets that need to be configured for the CI/CD workflows to function properly.

## Required Secrets

### 1. Docker Hub Credentials ✅

**Secret Names:**
- `DOCKER_USERNAME`
- `DOCKER_PASSWORD`

**Purpose:** Used by the release workflow to push Docker images to Docker Hub.

**Setup:**
1. Go to https://github.com/debugmcp/mcp-debugger/settings/secrets/actions
2. Click "New repository secret"
3. Add `DOCKER_USERNAME` with the Docker Hub username (debugmcp)
4. Add `DOCKER_PASSWORD` with the Docker Hub password or access token

**Used in:** `.github/workflows/release.yml`

**Status:** ✅ Configured

### 2. PyPI Token ✅

**Secret Name:** `PYPI_TOKEN`

**Purpose:** Used to publish the Python launcher package (mcp-debugger-launcher) to PyPI.

**Setup:**
1. Generate an API token at https://pypi.org/manage/account/token/
2. Scope the token to the `mcp-debugger` project (or use account-wide if project doesn't exist yet)
3. Add as `PYPI_TOKEN` in GitHub Secrets

**Used in:** `.github/workflows/release.yml`

**Status:** ✅ Configured

### 3. NPM Token (Optional)

**Secret Name:** `NPM_TOKEN`

**Purpose:** Used to publish the mcp-debugger package to npm registry.

**Setup:**
1. Generate a token at https://www.npmjs.com/settings/[username]/tokens
2. Choose "Automation" token type
3. Add as `NPM_TOKEN` in GitHub Secrets

**Used in:** `.github/workflows/release.yml`

**Note:** Only needed if you plan to publish to npm. The Docker image is the primary distribution method.

**Status:** ⏳ Not configured yet

### 4. Codecov Token (Optional) ✅

**Secret Name:** `CODECOV_TOKEN`

**Purpose:** Upload test coverage reports to Codecov for coverage badges.

**Setup:**
1. Add the repository at https://codecov.io/gh/debugmcp/mcp-debugger
2. Copy the upload token
3. Add as `CODECOV_TOKEN` in GitHub Secrets

**Used in:** `.github/workflows/ci.yml`

**Status:** ✅ Configured

## Verification

After adding secrets:
1. The CI workflow will run automatically on push (currently failing due to missing secrets)
2. Go to Actions tab: https://github.com/debugmcp/mcp-debugger/actions
3. Re-run the failed workflow to verify it passes
4. The release workflow will trigger when pushing tags (e.g., v0.9.0)

## Current Status

- ✅ Repository created: https://github.com/debugmcp/mcp-debugger
- ✅ Code pushed to main branch
- ✅ Tag v0.9.0-beta pushed
- ✅ Secrets configured (Docker, PyPI, Codecov)
- ⏳ CI workflow needs re-run with configured secrets
- ⏳ Release workflow ready (will trigger on version tags)

## Next Steps

1. Re-run the CI workflow to verify it passes with the configured secrets
2. Configure NPM token if npm publishing is desired
3. Consider creating a v0.9.0 final release once everything is verified

## Last Updated

2025-06-10 - Secrets configured, ready for CI re-run

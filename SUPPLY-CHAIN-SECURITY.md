# Supply Chain Security

This document describes the supply chain security controls for mcp-debugger. It covers how code changes are vetted, how packages are published, and how access is governed.

## Governance Model

mcp-debugger uses an **agent-first development model** where AI coding agents handle implementation while CI serves as the primary quality gate. Manual merge and release decisions remain with the project maintainers.

- Agents create pull requests but cannot merge independently
- All PRs must pass CI status checks before merging
- Branch protection rules enforce these constraints server-side

## Supply Chain Controls

### GitHub Actions Pinning

All GitHub Actions in CI and release workflows are pinned to immutable commit SHAs rather than mutable version tags. This prevents tag mutation attacks where a compromised action could be injected via a tag update.

Format: `actions/checkout@<full-sha>  # v4`

Dependabot automatically proposes SHA updates for GitHub Actions on a weekly schedule.

### Dependency Management

- **Lock file integrity**: `pnpm-lock.yaml` records SHA-512 hashes for every dependency. The lock file is committed and verified on every CI run.
- **Dependabot**: Configured for npm, pip, and GitHub Actions ecosystems with weekly update schedules.
- **Dependency audit**: `pnpm audit` runs in CI to flag known vulnerabilities in production dependencies.

### Static Analysis

- **CodeQL**: GitHub's CodeQL runs SAST on every push to main and on pull requests, analyzing TypeScript/JavaScript for security vulnerabilities.
- **OpenSSF Scorecard**: Automated security health assessment runs weekly, with results published to the OpenSSF dashboard and GitHub Security tab.

### Publishing Security

#### npm (`@debugmcp/*` packages)

- **OIDC trusted publishing**: npm packages are published using GitHub's OIDC token provider, eliminating long-lived npm tokens from CI.
- **Sigstore provenance**: All npm packages are published with `--provenance`, generating sigstore attestations that link each package version to its source commit and build workflow.
- **Verification**: `npm audit signatures @debugmcp/mcp-debugger` verifies provenance attestations.

#### PyPI (`debug-mcp-server-launcher`)

- Currently uses token-based authentication via repository secret.
- Migration to OIDC trusted publishing (via `pypa/gh-action-pypi-publish`) is planned to eliminate the long-lived PyPI token.

#### Docker Hub (`debugmcp/mcp-debugger`)

- Multi-platform images (linux/amd64, linux/arm64) built in CI.
- Published only after all tests pass.
- Credential-based authentication via repository secrets.

### CI Tool Pinning

All tools installed during CI are pinned to specific versions to ensure reproducible builds:
- Python packages (debugpy, build tools) pinned with `==` version specifiers
- Go tools (Delve) pinned to specific release tags
- Node.js, Python, Go, and Java runtime versions are fixed in workflow matrices

## Branch Protection

The `main` branch is protected with the following rules:

- Required status checks must pass before merging (CI jobs: Build and Test, Lint Code, Container Tests, Test Summary)
- Force pushes are blocked
- Branch deletion is blocked
- All changes must go through pull requests

## Process Isolation

Each debug session runs in a separate child process. The MCP server itself never executes user code directly -- it delegates to language-specific debug adapters (debugpy, js-debug, CodeLLDB, Delve, JDI, netcoredbg) which spawn and control the target process.

## Input Validation

- File paths are validated at the MCP server boundary via `SimpleFileChecker` before being passed to session management
- DAP messages are validated at the proxy layer
- The server does not store or manage user credentials

## Access Continuity

The project has multiple contributors to avoid single points of failure:

| System | Access Holders |
|--------|---------------|
| npm (`@debugmcp` scope) | Project maintainers with OIDC (no personal tokens needed) |
| Docker Hub (`debugmcp/mcp-debugger`) | Project maintainers via repository secrets |
| GitHub (admin) | Organization owners of `debugmcp` |
| PyPI (`debug-mcp-server-launcher`) | Project maintainers via repository secret (OIDC planned) |

If the primary maintainer becomes unavailable, organization-level access on GitHub ensures continuity. npm OIDC publishing is tied to the GitHub repository, not individual accounts.

## Incident Response

See [SECURITY.md](SECURITY.md) for vulnerability reporting process and response timelines.

## References

- [OpenSSF Scorecard](https://scorecard.dev/viewer/?uri=github.com/debugmcp/mcp-debugger)
- [npm provenance documentation](https://docs.npmjs.com/generating-provenance-statements)
- [Sigstore](https://www.sigstore.dev/)

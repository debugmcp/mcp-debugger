# Supply Chain Security

This document describes the supply chain security controls for mcp-debugger. It covers how code changes are vetted, how packages are published, how consumers can verify what they install, and how access is governed.

A companion [assurance case](docs/assurance-case.md) explains *why* these controls are considered sufficient for this project's threat model.

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
- **Dependabot**: Configured for the npm, pip (both the PyPI launcher and the hash-pinned CI requirements in `requirements/`), GitHub Actions, and Docker (digest-pinned base images) ecosystems, all on weekly schedules.
- **Cooldown windows**: Every Dependabot ecosystem uses an n-day cooldown (3 days by default, 7 for npm majors) so a compromised or broken upstream release has a public-exposure window before a PR is even opened here.
- **Dependency audit**: `pnpm audit --prod --audit-level=high` is a hard gate in CI **and** in the release workflow's build job — a tag cannot publish past a known high-severity advisory.
- **Hash-pinned CI installs**: Python tooling used by CI and the release workflow is installed with `pip --require-hashes` from committed hash manifests (`requirements/pip.txt`, `requirements/debugpy.txt`).

### Embedded Third-Party Components

Two upstream debug engines are vendored (as prebuilt artifacts) into distributed packages rather than expressed as npm dependencies. Because GitHub release assets are *mutable* — the same tag can serve different bytes over time — pinning a version alone is not an integrity guarantee. Both vendor pipelines therefore verify every download against **committed SHA-256 digest manifests** and fail the build on any mismatch:

| Component | Upstream | License | Pin manifest | Embedded in |
|-----------|----------|---------|--------------|-------------|
| js-debug (VS Code JavaScript debugger, DAP server build) | [microsoft/vscode-js-debug](https://github.com/microsoft/vscode-js-debug) | MIT | [`packages/adapter-javascript/vendor-manifest.json`](packages/adapter-javascript/vendor-manifest.json) | `@debugmcp/adapter-javascript`, `@debugmcp/mcp-debugger` CLI bundle, Docker image |
| CodeLLDB (LLDB-based DAP adapter) | [vadimcn/codelldb](https://github.com/vadimcn/codelldb) | MIT | [`packages/codelldb-common/vendor-manifest.json`](packages/codelldb-common/vendor-manifest.json) | `@debugmcp/codelldb-{win32-x64,darwin-x64,darwin-arm64,linux-x64,linux-arm64}` platform packages (optionalDependencies of `@debugmcp/mcp-debugger`, versioned by the CodeLLDB release, payload staged from the digest-pinned VSIXs by `scripts/stage-codelldb-packages.mjs`), Docker image |
| Rust LLDB formatter scripts (`lib/rustlib/etc` — pure-Python pretty-printers) | [rust-lang/rust](https://github.com/rust-lang/rust) | MIT/Apache-2.0 | Digest-pinned `rust:<ver>-slim` image reference in the `Dockerfile` (`rust-formatters` stage) | Docker image only (`/opt/rust-sysroot`, surfaced via `CODELLDB_RUST_SYSROOT`; issue #441) |

The manifests pin the upstream version, the SHA-256 of each release asset, and (for js-debug) the digest of the derived server file. Overriding the pinned version requires an explicit `*_ALLOW_UNPINNED=true` escape hatch intended for local experiments only; release builds always verify against the committed digests. Version bumps are deliberate PRs that update the manifest (the bump procedure is documented inside each manifest file).

Note: the SBOMs attached to releases are generated from the source tree and enumerate package-manager dependencies; the table above (plus the pin manifests) is the authoritative disclosure for these embedded binary components.

### Static Analysis

- **CodeQL**: GitHub's CodeQL runs SAST on every push to main and on pull requests, analyzing TypeScript/JavaScript for security vulnerabilities.
- **OpenSSF Scorecard**: Automated security health assessment runs weekly and on every push to main, with results published to the OpenSSF dashboard and GitHub Security tab.

### Publishing Security

#### npm (`@debugmcp/*` packages)

- **OIDC trusted publishing**: previously published packages are released via npm trusted publishing — CI exchanges its GitHub OIDC identity for a short-lived credential at publish time; no long-lived npm token is involved for these packages.
- **First-publish exception (transitional)**: npm's trusted-publisher configuration can only be attached to a package that already exists on the registry, so a package's *first* publish uses a granular, `@debugmcp`-scoped access token. As of v0.24.0 this applies to the four newly published adapter packages (`adapter-javascript`, `adapter-go`, `adapter-java`, `adapter-dotnet`); they move to trusted publishing immediately after, and the token is removed from CI once no first-publishes remain.
- **Sigstore provenance**: All npm packages are published with provenance, generating sigstore attestations that link each package version to its source commit and build workflow.
- **Workspace-dependency resolution**: `scripts/resolve-workspace-deps.cjs` rewrites pnpm `workspace:*` ranges to concrete pinned versions in the CI checkout before publishing, so published manifests contain only registry-resolvable, exact intra-project dependencies.

#### PyPI (`debug-mcp-server-launcher`)

- **OIDC trusted publishing** via `pypa/gh-action-pypi-publish`: CI exchanges its GitHub OIDC identity for a short-lived credential at publish time; no long-lived PyPI token is involved.
- **PEP 740 attestations**: the publish action generates and uploads digital attestations for every distribution, shown under "Verified details" on the PyPI project page.

#### Docker Hub (`debugmcp/mcp-debugger`)

- Multi-platform images (linux/amd64, linux/arm64) built in CI from digest-pinned base images.
- Published only after all tests pass.
- Credential-based authentication via repository secrets (Docker Hub does not support OIDC publishing).
- **Build-provenance attestation**: the pushed image digest is attested with `actions/attest-build-provenance` and the attestation is pushed to the registry, so the image is verifiable back to the tagged commit and workflow (see [Verifying a Release](#verifying-a-release)).

### SBOMs

Every GitHub release attaches two Software Bills of Materials generated from the exact release ref:

- `sbom.spdx.json` (SPDX 2.x)
- `sbom.cyclonedx.json` (CycloneDX)

These enumerate the package-manager dependency graph and support procurement processes (e.g. EO 14028) and downstream vulnerability scanners. Embedded binary components are disclosed separately (see [Embedded Third-Party Components](#embedded-third-party-components)).

### CI Tool Pinning

All tools installed during CI are pinned to specific versions to ensure reproducible builds:
- Python packages (debugpy, build tools) pinned with `==` version specifiers and, for CI/release installs, `--require-hashes` manifests
- Go tools (Delve) pinned to specific release tags
- Node.js, Python, Go, and Java runtime versions are fixed in workflow matrices

## Verifying a Release

What is attested: **every distributed artifact** — the npm package tarballs (the `.tgz` files published to npm and attached to the GitHub release), the Docker image, and the PyPI launcher. All are built by the same tag-triggered workflow. (Applies to releases after v0.24.2; earlier releases attest only the npm tarballs.)

**Verify a release asset's build provenance** (proves the tarball was built by this repository's release workflow from the tagged commit):

```bash
gh attestation verify debugmcp-mcp-debugger-<version>.tgz --repo debugmcp/mcp-debugger
```

**Verify the Docker image** (proves the pushed image digest was built and attested by the same release workflow):

```bash
gh attestation verify oci://index.docker.io/debugmcp/mcp-debugger:<version> --repo debugmcp/mcp-debugger
```

**Verify the PyPI launcher**: distributions carry [PEP 740](https://peps.python.org/pep-0740/) attestations, generated at upload by trusted publishing — see "Verified details" on the [PyPI project page](https://pypi.org/project/debug-mcp-server-launcher/), or verify locally with `pypi-attestations verify pypi ...`.

**Verify installed npm packages** (checks registry signatures and provenance attestations for everything in your lockfile):

```bash
npm audit signatures
```

**Inspect the release SBOMs**: download `sbom.spdx.json` / `sbom.cyclonedx.json` from the GitHub release and feed them to your scanner of choice (e.g. `grype sbom:./sbom.spdx.json`).

Each release also attaches the raw sigstore bundle as `multiple.sigstore.json` / `multiple.intoto.jsonl` (the same bundle under both names, covering all release tarballs) for tooling that consumes sigstore bundles directly.

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
- Variable and evaluation output passes through secret redaction by default (see the [tool reference](docs/tool-reference.md))

## Access Continuity

The project currently has a single lead maintainer (see [MAINTAINERS.md](MAINTAINERS.md)); continuity is provided by organization-level controls rather than headcount:

| System | Access Holders |
|--------|---------------|
| npm (`@debugmcp` scope) | Trusted publishing bound to this GitHub repository's release workflow (not to individual accounts); scoped token only for first-publishes |
| Docker Hub (`debugmcp/mcp-debugger`) | Project maintainers via repository secrets |
| GitHub (admin) | Organization owners of `debugmcp` |
| PyPI (`debug-mcp-server-launcher`) | Trusted publishing bound to this GitHub repository's release workflow (not to individual accounts) |

If the primary maintainer becomes unavailable, organization-level access on GitHub ensures continuity. npm trusted publishing is tied to the GitHub repository, not individual accounts.

## Incident Response

See [SECURITY.md](SECURITY.md) for vulnerability reporting process and response timelines.

## References

- [Assurance case](docs/assurance-case.md)
- [OpenSSF Scorecard](https://scorecard.dev/viewer/?uri=github.com/debugmcp/mcp-debugger)
- [npm provenance documentation](https://docs.npmjs.com/generating-provenance-statements)
- [npm trusted publishing](https://docs.npmjs.com/trusted-publishers)
- [Sigstore](https://www.sigstore.dev/)

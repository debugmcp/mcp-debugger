# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.20.x  | :white_check_mark: |
| < 0.20  | :x:                |

## Reporting a Vulnerability

**Do NOT file a public GitHub issue for security vulnerabilities.**

### Preferred: GitHub Security Advisories

Report vulnerabilities through [GitHub Security Advisories](https://github.com/debugmcp/mcp-debugger/security/advisories/new). This provides a private channel for discussion and coordinated disclosure.

### Alternative: Email

Send details to **debug@sycamore.llc** with subject line `[SECURITY] mcp-debugger: <brief description>`.

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Affected versions
- Impact assessment (if known)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 1 week
- **Resolution target**: Within 90 days

We will coordinate disclosure timing with the reporter. Credit is given to responsible reporters unless anonymity is requested.

## Scope

The following components are in scope for security reports:

- **MCP server** (`src/`) — protocol handling, tool routing, input validation
- **Language adapters** (`packages/adapter-*`) — debug adapter lifecycle, process spawning
- **CLI bundle** (`packages/mcp-debugger`) — command-line entry points
- **Docker image** (`Dockerfile`) — container security, base image vulnerabilities
- **CI/CD pipelines** (`.github/workflows/`) — supply chain integrity
- **Published packages** — npm (`@debugmcp/*`), PyPI (`debug-mcp-server-launcher`), Docker Hub (`debugmcp/mcp-debugger`)

### Out of Scope

- Vulnerabilities in upstream debug adapters (debugpy, js-debug, CodeLLDB, Delve, netcoredbg) — report these to their respective maintainers
- Denial of service via intentionally malformed DAP messages in a local-only deployment
- Issues requiring physical access to the host machine

## Security Design

mcp-debugger follows these security principles:

- **Process isolation**: Each debug session runs in a separate process
- **No credential storage**: The server does not store or manage user credentials
- **Input validation**: File paths and DAP messages are validated at system boundaries
- **Least privilege**: CI workflows use minimal GitHub token permissions
- **Supply chain hardening**: GitHub Actions are SHA-pinned, dependencies are audited, npm packages are published with sigstore provenance

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
- Reports that mcp-debugger can perform actions on the local filesystem or in spawned debuggees with the privileges of the invoking user. This is by design — see [Trust Model](#trust-model). Path checks in `get_source_context`, `set_breakpoint`, etc. are for usability (early validation feedback), not security.
- Reports that `evaluate_expression` can be used to read files, make network calls, or run arbitrary code inside the debuggee. This is the tool's intended behavior; the debuggee is already running with the user's privileges.

## Trust Model

mcp-debugger is a debugger, not a sandbox. It is intended to be run locally under a specific OS user, driven by an MCP client (such as an AI agent) that the operator has chosen to trust at that user's privilege level. **The trust boundary is the deployment, not the tool.**

This means:

- The MCP client can read any file the mcp-debugger process can read (`get_source_context`, DAP source requests).
- The MCP client can spawn arbitrary processes (`create_debug_session` + `start_debugging`, `attach_to_process`).
- The MCP client can execute arbitrary code inside a debuggee (`evaluate_expression`, `redefine_classes`).

These capabilities are intrinsic to being a debugger and cannot be removed without defeating the tool's purpose. In particular, `evaluate_expression` forwards a caller-supplied expression to the debug adapter, which evaluates it in the debuggee's runtime; deciding whether such an expression is "safe" is undecidable in general and not a property mcp-debugger attempts to enforce.

If you want to constrain what the MCP client can reach, constrain the mcp-debugger process:

- **Containers.** Run the published `debugmcp/mcp-debugger` image with the workspace mounted at `/workspace`. The container boundary is the filesystem boundary.
- **OS permissions.** Run mcp-debugger as a user with read access only to the source you want it to debug, and no access to secrets, SSH keys, credentials, etc. The kernel enforces the limits.
- **MCP client trust.** Do not expose mcp-debugger to an MCP client that you trust less than the OS user mcp-debugger runs under.

## Security Design

mcp-debugger follows these security principles:

- **Process isolation**: Each debug session runs in a separate process
- **No credential storage**: The server does not store or manage user credentials
- **UX-level path validation**: File paths are checked for existence at request boundaries to give the MCP client immediate feedback on bad inputs. This is not an access-control mechanism — see [Trust Model](#trust-model).
- **Least privilege**: CI workflows use minimal GitHub token permissions
- **Supply chain hardening**: GitHub Actions are SHA-pinned, dependencies are audited, npm packages are published with sigstore provenance

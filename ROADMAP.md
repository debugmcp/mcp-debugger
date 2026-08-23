# Roadmap

_Last updated: 2026-08-22 (v0.24.2). This file is refreshed at each release._

mcp-debugger gives AI agents step-through debugging over the Model Context Protocol: 28 tools across eight language adapters (Python, JavaScript/TypeScript, Ruby, Rust, Go, Java, .NET, C/C++), plus a mock adapter for testing. This roadmap answers two questions we hear from people evaluating the project: **is the tool surface stable enough to build on?** and **what's left before 1.0?**

## Path to 1.0

1.0 is defined by criteria, not dates. We cut 1.0 when all of the following hold:

- **Tool-schema freeze.** The 28-tool surface and its response shapes are declared stable under SemVer: breaking changes to tool names, parameters, or response shapes require a major version. Prerequisite work: complete full parameter/response documentation in the [tool reference](docs/tool-reference.md) for the four tools currently summarized without schemas (`list_supported_languages`, `attach_to_process`, `detach_from_process`, `list_threads`).
- **Per-platform CodeLLDB packages published and verified.** The five `@debugmcp/codelldb-*` platform packages (which let npm installs pull only the native debug engine for the current platform) are live on npm and verified across install channels (npx, global npm, Docker).
- **A full release cycle with no breaking behavioral changes.** One complete minor release soaks with no regressions that change documented tool behavior.
- **Supply-chain milestones.** OpenSSF Best Practices Silver, and build-provenance attestations covering every distributed artifact — npm tarballs (done), the Docker image, and the PyPI launcher ([#422](https://github.com/debugmcp/mcp-debugger/issues/422)).

## Near-term themes

- **Environment self-check** — ✅ shipped: the [`mcp-debugger doctor` command](docs/diagnostics.md) checks every adapter's runtime prerequisites in one pass, and the [diagnostics guide](docs/diagnostics.md) consolidates prerequisites and failure signatures ([#423](https://github.com/debugmcp/mcp-debugger/issues/423)).
- **Turnkey Kubernetes debugging** — a copy-paste recipe (docs + example manifests + attach presets) for debugging pods via ephemeral sidecar containers and port-forwarded attach ([#424](https://github.com/debugmcp/mcp-debugger/issues/424)).
- **Published-artifact canary** — ✅ shipped: the [Canary workflow](.github/workflows/canary.yml) runs a weekly (and on-demand, as the release gate) install-and-debug matrix over what users actually install (npx, global npm, Docker) across x64/arm64 Linux, arm64 macOS, and Windows, catching packaging regressions before users do ([#425](https://github.com/debugmcp/mcp-debugger/issues/425)).

## Non-goals

To set expectations, mcp-debugger is deliberately **not** heading toward:

- **An IDE-replacement UI.** This is infrastructure for agents (and the humans supervising them), not a visual debugger. The `expose_session` DAP mirror exists so your IDE can watch a live session; that's the extent of the UI ambition.
- **Languages without a maintained DAP backend.** Adapters wrap existing, actively maintained Debug Adapter Protocol implementations (debugpy, js-debug, CodeLLDB, Delve, …). We don't write or maintain debug engines.
- **Editing or refactoring tools.** This is a debugger. Code modification belongs to other tools in the agent's kit.

## Feedback

If a 1.0 criterion above seems wrong or missing, [open an issue](https://github.com/debugmcp/mcp-debugger/issues) — the criteria are meant to be argued with.

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.23.0] - 2026-07-09

### Added
- **`verifyTimeout` parameter** on `create_debug_session` and `attach_to_process` — controls how long (ms) attach mode waits for the debugger to report at least one thread before failing the attach (default: 5000, max: 600000). Increase for targets slow to become debuggable, e.g. a busy or warming JVM (#147, fixes #143)
- **`timeout` parameter** on `evaluate_expression` and `redefine_classes` — controls the max time (ms) to wait for the operation to complete (default: 30000, max: 600000) (#148, fixes #142)

### Fixed
- **Slow step/pause no longer reported as failure** — `step_over`, `step_into`, `step_out`, `pause_execution`, and `continue_execution` now return `pending: true` with a truthful "still running" message instead of `success: false` when the operation outlives its grace window (#144)
- **Python attach handshake** — attach-first DAP handshake sequencing for debugpy attach (#149, fixes #145)
- **DAP disconnect ordering** — send DAP disconnect before destroying the socket; Windows launch-mode tree-kill now runs first, with an already-exited PID guard (#157, fixes #156)
- **Dev proxy backend output** — line-buffered and sanitized before logging, matching the main proxy's handling (#158, fixes #154)

### Security
- **Comprehensive stderr/env secret-redaction audit** across the proxy and dev-proxy, closing gaps where adapter/backend output could leak into logs or tool errors unsanitized (#150, #152, #155, fixes #146, #151, #153)
- **All 23 open dependency advisories resolved** via `pnpm.overrides` (hono, fast-uri, vite, qs, ip-address, esbuild, brace-expansion); CI's `pnpm audit` step is no longer `continue-on-error` (#160)
- **CI workflow token permissions job-scoped**; the last unpinned GitHub Action (`dependabot/fetch-metadata`) SHA-pinned; a stray compiled Go example binary untracked (#161)
- **Dependency pinning sweep** — hash-pinned pip installs (`pip`, `debugpy`), pnpm installed via corepack instead of `npm install -g`, `ruby:3.3-slim` pinned by digest, Dependabot now covers the `docker` ecosystem (#163)
- **Signed release artifacts** — GitHub releases now ship the published npm tarballs alongside SLSA provenance (`multiple.intoto.jsonl`), verifiable with `slsa-verifier` (#164)
- **OpenSSF Scorecard 6.0 → 8.7** and an [OpenSSF Best Practices "passing" badge](https://www.bestpractices.dev/projects/13543) (#160–#164, #174)

### Changed
- Added `fast-check` property-based tests covering the log sanitizers, stream line-buffering, and DAP wire framing — caught and fixed a real bug where env vars named `__proto__` were silently dropped by the sanitizer (#162)

## [0.22.0] - 2026-07-06

### Added
- **Ruby debugging support** – launch and attach via `rdbg` (debug gem) DAP, including remote attach to containers and Kubernetes pods through port forwarding; conditional breakpoints, locals, repl-context expression evaluation, detach/re-attach (adapted from PR #88, contributed by [@Poyraxx](https://github.com/Poyraxx))
- **Direct-connect attach** – adapter policies can now return a `connect`-mode spawn config to attach straight to an already-listening DAP server without spawning an adapter process; policy selection is driven by the session language via a single shared `getPolicyForLanguage()` mapping instead of adapter-command sniffing
- **Ruby documentation** – `docs/ruby/README.md` user guide with verified launch/attach flows and Docker/Kubernetes remote-attach walkthroughs (`examples/ruby/remote-attach/`)

### Fixed
- **JavaScript attach mode** – establish the js-debug child session when attaching, so breakpoints, stepping, and inspection work for attached Node.js processes (#131, fixes #124)
- **Truthful attach failures** – `attach_to_process` now reports adapter/connection errors instead of returning an empty success (#129)
- **`pause_execution` state** – reports the correct session state instead of a stale one (#119)
- **Proxy lifecycle** – the per-session proxy process is stopped when a debuggee terminates naturally, eliminating leaked proxy processes (#127)
- **Server orphan self-defense** – a stdin watchdog shuts the server down when its MCP client disappears, and backend shutdown is graceful across stdio/http/sse commands (#130)
- **Proxy bootstrap heartbeat** – removed a one-sided heartbeat that could kill healthy proxies during slow startups (#126, fixes #123)
- **Logging** – per-process log files prevent multi-process rotation races, and a rotation-failure latch stops runaway retry loops (#128, fixes #121)
- **Python interpreter validation** – a configured `pythonPath` is validated for debugpy availability up front, with a clear error instead of a hang (#107, fixes #106)
- **Java adapter vendoring** – honors `SKIP_ADAPTER_VENDOR` and skips gracefully on a `javac` older than JDK 21 (#116)
- Attach sessions no longer apply host-side file existence checks to breakpoint paths — attach targets may run on a remote filesystem (container, pod, other machine)
- `test:unit` now actually runs the per-adapter unit suites on Windows (the `tests/adapters/*/unit` glob never expanded under cmd.exe)
- CLI bundle prepare-pack workspace list updated for new adapter packages

### Changed
- Test suite parallelized and hardened via Vitest projects — unit suite runtime dropped from ~12 minutes to ~10 seconds (#110)
- README refreshed with current capabilities and language matrix (#87)

### Dependencies
- Bumped `commander` 14 → 15. The CLI surface is unchanged; `commander` is bundled into the published CLI, so end-user installs are unaffected. (#92)

## [0.21.0] - 2026-05-30

### Changed
- **Minimum Node.js raised to 22.** All packages now declare `engines.node >=22.0.0`, and the Docker image builds on `node:22-slim`. Node 18 and 20 are no longer supported (Node 20 reached end-of-life April 2026).

### Dependencies
- Bumped `which` 6 → 7 (requires Node 22+). The API is unchanged, and `which` is bundled into the `@debugmcp/mcp-debugger` npx CLI, so end-user installs are unaffected. (supersedes #76)

## [0.20.0] - 2026-03-29

### Added
- **`redefine_classes` MCP tool** — hot-swap changed Java classes into a running JVM without restarting the debug session (21 MCP tools total) (PR #26, contributed by [@Finomosec](https://github.com/Finomosec))
- E2E tests for `redefine_classes` and Java ClassPrepareEvent/BreakpointEvent race condition
- `redefine_classes` documentation in `docs/java/README.md`

### Fixed
- **Attach-mode stopOnEntry** — restore default to preserve paused state; pass `stopOnEntry` through to attach and default to `false` in `create_debug_session`
- **Java event loop race** — prevent `ClassPrepareEvent` from resuming stopped threads (PR #27, contributed by [@Finomosec](https://github.com/Finomosec))
- **Java attach suspend** — suspend VM on attach when `stopOnEntry` is true
- Remove dead `ProcessAdapter` class and unrecognized `--no-wait` arg from debugpy E2E test

### Changed
- Comprehensive osoji sweeps — dead code removal, stale docs rewrite, test robustness improvements
- Replace istanbul ignore comments with real unit tests
- Fix comprehensive test matrix failures; add dotnet/java language coverage

## [0.19.0] - 2026-03-22

### Added
- **.NET/C# debug adapter** — full debugging via netcoredbg with launch/attach modes, conditional breakpoints, exception breakpoints, TCP-to-stdio bridge, and Portable PDB support (PR #24, contributed by [@bob7123](https://github.com/bob7123))
- **`list_threads` MCP tool** — list all threads in the debugged process (20 MCP tools total)
- **`pause_execution` enhanced** — optional `threadId` parameter to pause a specific thread
- **Java pause command** — `pause_execution` support for Java adapter
- **Java per-breakpoint suspend policy** — control thread suspension behavior per breakpoint (PR #25, contributed by [@Finomosec](https://github.com/Finomosec))
- **Batteries-included CLI bundle** — Rust, Java, and .NET adapters now bundled in `@debugmcp/mcp-debugger`
- Pause test programs for Go, .NET, Java
- Regression tests for Go and .NET pause fixes
- Adapter registry, server coverage, and Go policy unit tests
- Bridge fallback and bundle asset verification tests
- Disconnect/detach safety tests

### Fixed
- Go and .NET pause workflow failures
- Latent bugs in adapter loader, mock DAP parser, Java adapter, and Docker entrypoint
- Fail fast with clear error when Docker daemon is not running
- netcoredbg bridge path resolution for spaces in paths and NPX bundle variants
- `dapLaunchArgs.program` preservation for compiled languages
- Comprehensive osoji audit remediations (runtime bugs, dead code, stale docs)
- 0% coverage files addressed after Vitest 4 upgrade

### Changed
- Adapter loading, error handling, logging, and language-specific documentation updated
- Test robustness improvements and dead code removal

## [0.18.1] - 2026-03-11

### Added
- Java FQCN (Fully Qualified Class Name) support as breakpoint file parameter — pass class names like `com.example.MyClass` instead of file paths

### Fixed
- Multi-breakpoint aggregation and sourcePath-based breakpoint cleanup
- Moved `isJavaFqcn` into adapter policy layer following Open/Closed principle

## [0.18.0] - 2026-03-05

### Added
- **Go debugging support** – full Delve DAP adapter with debug, test, exec, replay, and core modes, goroutine-aware stack traces, and automatic `dlv` detection (contributed by [@swinyx](https://github.com/swinyx))
- **Java debugging support** – JDI bridge (`JdiDapServer.java`) with launch and attach modes, variable inspection, and deferred breakpoints via ClassPrepareRequest (contributed by [@roofpig95008](https://github.com/roofpig95008))
- **Java attach mode** – connect to running JVMs via JDWP agent for debugging servers and complex applications
- **Java expression evaluation** – full expression evaluator supporting field access, method calls, array indexing, arithmetic, string concatenation, casting, `instanceof`, ternary, and unary operators
- **Java conditional breakpoints** – conditions evaluated server-side via the expression evaluator
- **Java documentation** – `docs/java/README.md` user guide covering prerequisites, JDI bridge architecture, and troubleshooting
- **CI Go + Java toolchains** – workflow now installs Go 1.21, Delve, and JDK 21 for cross-platform E2E testing
- **Dev proxy** – lightweight MCP proxy for hot-reloading mcp-debugger during development without restarting Claude Code
- **Dev proxy STDIO backend transport mode** – STDIO transport option for the dev proxy

### Changed
- **Java backend** – replaced KDA (kotlin-debug-adapter) and stdio-tcp-bridge with a single JDI bridge (`JdiDapServer.java`) using `com.sun.jdi.*` directly; zero external dependencies, compiles on first use
- **Java minimum JDK** – recommended JDK 21+ to match `--release 21` bridge compilation target; the adapter warns (but does not error) when Java is below 21, and the runtime adapter warns when Java is below version 11
- Removed dead `sendConfigDoneWithAttach`/`sendConfigDoneWithLaunch` code paths

### Fixed
- **Java inner class breakpoints** – fixed JDWP ClassPrepareRequest filter patterns (`*ClassName$*` silently fails; changed to `ClassName$*`)
- **Java instanceof with interfaces** – `isSubtypeOf` now handles `InterfaceType` subjects and recursive interface-extends-interface chains
- **Java thread ID overflow** – changed from `int` to `long` thread IDs throughout the DAP bridge
- **Java frame ID collisions** – replaced arithmetic encoding (`threadId * 100000 + frameIndex`) with lookup-table approach
- **Java breakpoint IDs** – added unique, monotonically increasing breakpoint IDs per DAP spec
- **Java thread safety** – used `ConcurrentHashMap` and `AtomicInteger` for shared state; added `synchronized` blocks for frame cache access
- **Java boolean operators** – `&&` and `||` parsing now consumes tokens correctly; note that the RHS is still evaluated for JDI side effects before deciding the result value
- **Java thread discovery** – discover JVM threads via DAP threads request instead of hardcoding threadId=1
- **Java variable access** – document and enforce `javac -g` requirement for LocalVariableTable (JDI needs it for local variable inspection)
- Block EventSource phantom reconnection in SSE transport
- Coerce stringified tool arguments from SSE transport
- Docker Java support, crash safety, and continue-execution state race
- Auto-detach safety for attach sessions
- Prevent orphan child processes from holding ports after SSE crash
- Prevent SSE backend from crashing immediately after startup
- Two-phase initialized event handling for Delve on Windows
- Replace printf-generated Docker entry.sh with version-controlled script
- Downgrade missing debugpy to warning for virtualenv support
- Prevent Docker path double-prefixing with idempotent resolution
- Bundled Go adapter and mock-adapter-process for npx distribution
- Resolved `workspace:*` dependency resolution during `pnpm pack`
- Fixed cross-test pollution from `process.env.PATH` in Go/Python unit tests
- Added Go adapter to Dockerfile and fixed Windows volume mount paths

### Removed
- **Java jdb adapter** – jdb text-parsing approach proved too fragile; replaced by JDI bridge

## [0.17.0] - 2025-11-22

### Added
- **Rust adapter (Alpha)** – integrates CodeLLDB to support Cargo projects, async runtimes, and cross-platform execution with smart rebuild detection

### Improved
- **Stepping UX** – every `step_*` response now embeds current source context so agents see the active file/line instead of generic “success” acknowledgements

### Packaging
- **CodeLLDB footprint** – CLI bundle ships the Linux x64 CodeLLDB runtime by default (other platforms can point `CODELLDB_PATH` to an installed binary or re-run the vendor script) to stay within npm size limits

## [0.16.0] - 2025-11-09

### Added
- **JavaScript adapter (Alpha)** – full debugging loop backed by bundled `js-debug`, TypeScript detector, and adapter policy orchestration
- **Adapter documentation** – updated `docs/javascript/*` guides covering architecture, source maps, and usage
- **Proxy session analytics** – dry-run/handshake instrumentation persisted in logs for CI triage

### Changed
- **Build system** – migrated CLI bundling from esbuild to tsup (`noExternal: [/./]`) for deterministic workspace packaging
  - Produces self-contained `@debugmcp/mcp-debugger` bundles and trims install size
  - Simplifies npx execution by embedding adapter assets
- **Proxy bundling** – emitted dedicated `proxy-bundle.cjs` process with automatic runtime detection of bundled vs dev mode
- **Adapter wiring** – session manager now loads adapters via registry/policies, enabling future language additions

### Fixed
- Resolved missing dependency errors when running via `npx` (fs-extra, etc.)
- Ensured proxy bootstrap locates `js-debug` artifacts in bundled distributions
- Hardened Windows dry-run handling to avoid silent exits

### Improved
- **npx distribution** – zero-runtime dependencies; CLI bundle (~3 MB) includes all workspace packages, proxy bundle ships with required modules
- **Build performance** – faster incremental builds with tsup and shared cache
- **Deployment simplicity** – single command `npx @debugmcp/mcp-debugger stdio` “just works”; Docker image consumes same artifact layout
- **Documentation footprint** – refreshed build pipeline notes (`docs/development/build-pipeline.md`) and architecture overview

## [0.15.7] - 2025-09-27

### Added
- **Monorepo architecture** - Complete refactor to workspace-based monorepo structure, setting the foundation for multi-language adapter support
  - Extracted Python adapter into `@debugmcp/adapter-python` package
  - Extracted Mock adapter into `@debugmcp/adapter-mock` package  
  - Created shared types and interfaces in `@debugmcp/shared` package
  - Dynamic adapter loading system for extensibility
- **Pre-push lint validation** - ESLint now runs before push to prevent CI failures
- **Typed error system** - Replaced brittle string matching in tests with proper typed errors
- **Validation script** - Test in clean environment before release
- **npx distribution package** - Direct execution support via `npx @debugmcp/mcp-debugger`
- **pnpm workspace support** - Migrated from npm to pnpm for better monorepo management

### Fixed
- Removed unused `SessionNotFoundError` import that was blocking CI
- Docker container file operations now use relative paths
- Docker E2E test converted to use stdio transport for reliability
- Deprecated warnings resolved before release
- Build artifacts removed from git and prevented in CI tests
- Proxy bootstrap JavaScript file restored to fix CI failures
- TypeScript module resolution issues in CI/CD pipeline
- Workspace package type declarations and build order

### Changed
- **Architecture**: Modularized codebase into workspace packages for better maintainability and future language support
- Docker E2E tests now enabled locally by default
- Improved error handling with typed error classes for better reliability
- Enhanced pre-push hooks to match CI validation requirements
- Build system now uses TypeScript composite projects for proper inter-package dependencies

## [0.14.1] - 2025-01-16

### Fixed
- Resolved ESLint violations that were blocking CI/CD pipeline
- Fixed linting issues in proxy modules and test files

## [0.14.0] - 2025-01-15

### Added
- **`evaluate_expression` tool** - Execute expressions in the current debug context to inspect and modify program state dynamically
- **Proxy-ready handshake mechanism** - Ensures reliable proxy initialization and prevents race conditions
- **Orphan process detection** - Automatically terminates proxy processes that become orphaned

### Fixed
- Memory leak in DAP client buffer management - Improved from O(n²) to O(n) complexity
- Race condition in MinimalDapClient causing unhandled error events during connection phase
- Race condition in proxy initialization causing unhandled promise rejections
- Proxy processes becoming orphaned after test suite execution on Linux

### Changed
- Proxy initialization timeout reduced from 30s to 10s to prevent resource consumption
- Improved error handling in ProxyProcessAdapter with proper promise lifecycle management

## [0.13.0] - 2025-01-15

### Added
- Initial implementation of `evaluate_expression` tool for dynamic debugging capabilities

## [0.12.0] - 2025-07-28

### Added

- **Path validation** to prevent crashes from non-existent files - immediate feedback instead of cryptic "[WinError 267]" errors
- **Line context in `set_breakpoint` responses** - enables AI agents to make intelligent breakpoint placement decisions
- **`get_source_context` tool implementation** - previously unimplemented tool now provides source code exploration capabilities
- **Efficient line reading with LRU caching** - optimized file access for repeated operations on the same files

### Fixed

- Cryptic "[WinError 267] The directory name is invalid" crashes when debugging with non-existent files
- Silent acceptance of invalid breakpoints - now provides immediate validation feedback
- Missing implementation of `get_source_context` tool

### Changed

- `set_breakpoint` now returns immediate feedback for missing files with clear error messages
- Improved error messages throughout - all file-related errors now include resolved paths and helpful context
- `set_breakpoint` responses now include optional `context` field with line content and surrounding code

## [0.11.2] - 2025-01-14

### Fixed

- PyPI package deployment workflow - fixed invalid classifier format that was preventing successful uploads
- npm package deployment - added missing provenance configuration for trusted publishing

### Changed

- Updated Python package classifiers to use standard PyPI format
- Enhanced CI/CD workflows for more reliable multi-platform releases

## [0.11.1] - 2025-01-13

### Fixed

- Release workflow to use correct secret name for PyPI deployment
- Documentation references to old package names

## [0.11.0] - 2025-01-13

### Breaking Changes

- Package renamed from `debug-mcp-server` to `@debugmcp/mcp-debugger` on npm
- Python launcher renamed to `debug-mcp-server-launcher` on PyPI
- Docker image moved to `debugmcp/mcp-debugger` on Docker Hub

### Added

- Official organization structure under `debugmcp` namespace
- Multi-platform Docker builds (amd64, arm64)
- Comprehensive deployment documentation

### Fixed

- CI/CD workflows for seamless releases across all platforms

## [0.10.0] - 2025-06-24

### Added

- **Dynamic Tool Documentation**: Tool descriptions now adapt to runtime environment (host vs container), helping LLMs understand path requirements without trial and error
- **Structured JSON Logging**: All debugging operations emit structured JSON logs for visualization and monitoring
  - Tool invocations with sanitized parameters
  - Debug state changes (paused/running/stopped)
  - Breakpoint lifecycle events
  - Variable inspections with truncated values
- **Comprehensive Smoke Tests**: Added SSE and container transport smoke tests to complement existing stdio tests
  - Tests for all transport mechanisms (stdio, SSE, containerized)
  - Cross-platform volume mounting verification
  - Smart Docker image caching for faster tests
- **Path Translation System**: Improved dependency injection for container/host path flexibility
- **Test Utilities**: Enhanced test helpers for smoke tests including Docker utilities

### Changed

- **Docker Image Optimization**: Reduced image size by 64% (670MB → 240MB), improving deployment size and container startup time
  - Switched to Alpine Linux base image
  - Implemented esbuild bundling for JavaScript dependencies
  - Optimized multi-stage build process
- **Container Proxy Bundling**: Fixed proxy dependency issues in Alpine environments
- **Parameter Validation**: Improved validation with proper MCP error responses
- **Error Messages**: Enhanced error messages with clearer context for debugging

### Fixed

- Container proxy dependency resolution in Alpine Linux environments
- Test mocking issues in dynamic tool documentation
- Path handling edge cases in container mode
- Various test stability improvements

## [0.9.0] - 2025-01-09

### Breaking Changes

- SessionManager constructor changed to use dependency injection (backward compatibility maintained but deprecated)
- Removed ActiveDebugRun type in favor of ProxyManager architecture

### Added

- **Vitest Migration**: Complete migration from Jest to Vitest for native ESM support (10-20x faster test execution)
- **Dependency Injection**: Comprehensive dependency injection system with factories for all major components
- **Error Handling**: Centralized error messages module with user-friendly timeout explanations
- **Proxy Architecture**: Three-layer proxy architecture (core/worker/entry) for better separation of concerns
- **Functional Core**: Pure functional DAP handling logic with no side effects
- **Documentation**:
  - Comprehensive developer documentation in `docs/development/`
  - Architecture diagrams and patterns guide in `docs/architecture/` and `docs/patterns/`
  - LLM collaboration journey documentation
- **Test Utilities**: Extensive test helper functions and mock factories

### Changed

- **Test Coverage**: Increased from <20% to >90% with 657 passing tests (up from 355)
- **SessionManager**: Reduced complexity by 40% through ProxyManager delegation
- **Code Organization**: Improved separation of concerns with clear module boundaries
- **Event Management**: Proper lifecycle management with cleanup on session close

### Fixed

- Memory leak in event handlers (proper cleanup in closeSession)
- Race condition in dry run (replaced hardcoded timeout with event-based coordination)
- Unhandled promise rejections in tests
- Enhanced timeout error messages for better debugging

### Removed

- Jest test runner and all Jest-related dependencies
- Obsolete test files and configurations
- python-utils.ts from core (refactored and consolidated into `packages/adapter-python/src/utils/python-utils.ts`)
- Various deprecated provider and protocol files

## [0.1.0] - 2025-05-27

### Added

- Initial public release of `debug-mcp-server`.
- Core functionality for Python debugging using the Debug Adapter Protocol (DAP) via `debugpy`.
- MCP server implementation with tools for:
    - Creating and managing debug sessions (`create_debug_session`, `list_debug_sessions`, `close_debug_session`).
    - Debug actions: `set_breakpoint`, `start_debugging`, `step_over`, `step_into`, `step_out`, `continue_execution`.
    - State inspection: `get_stack_trace`, `get_scopes`, `get_variables`.
- Support for both STDIN/STDOUT and HTTP transport for MCP communication.
- Basic CLI to start the server with transport and logging options.
- Python "launcher" package (`debug-mcp-server-launcher`) for PyPI, to aid users in running the server and ensuring `debugpy` is available.
- Dockerfile for building and running the server in a containerized environment, including OCI labels.
- GitHub Actions CI setup for:
    - Building and testing on Ubuntu and Windows.
    - Linting with ESLint.
    - Publishing Docker image to Docker Hub on version tags.
    - Publishing Python launcher package to PyPI on version tags.
- Project structure including:
    - `LICENSE` (MIT).
    - `CONTRIBUTING.md` (basic template).
    - GitHub issue and pull request templates.
    - `README.md` with quick start, features, and usage instructions.
    - `docs/` directory with initial documentation (`quickstart.md`).
    - `examples/` directory with:
        - `python_simple_swap/`: A buggy Python script and a demo script showing how to debug it using MCP tools.
        - `agent_demo.py`: A minimal example of an LLM agent loop interacting with the server.
- Unit and integration tests for core functionality. (E2E tests for HTTP transport are currently skipped due to environment complexities).
- `pyproject.toml` for the Python launcher and `package.json` for the Node.js server.

### Changed

- Build output directory standardized to `dist/`.

### Known Issues

- E2E tests for HTTP transport (`tests/e2e/debugpy-connection.test.ts`) are temporarily skipped due to challenges with JavaScript environment setup (fetch/ReadableStream polyfills in Jest/JSDOM). These will be revisited.
- Placeholder URLs and names (e.g., for repository, Docker Hub user, author) in `package.json`, `pyproject.toml`, `Dockerfile`, `README.md`, and example scripts need to be updated with actual project details.

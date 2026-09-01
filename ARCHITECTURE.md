# Architecture

mcp-debugger is a Model Context Protocol (MCP) server that bridges MCP clients (like Claude) with language-specific debug adapters via the Debug Adapter Protocol (DAP). It enables AI agents to perform step-through debugging of multiple programming languages.

## Monorepo Structure

The project uses pnpm workspaces (`packages: ['packages/*']`): the root project plus 17 packages under `packages/`:

```
packages/
  shared/             Core interfaces, types and adapter policies (IDebugAdapter, IAdapterFactory)
  adapter-python/     Python debugging via debugpy
  adapter-javascript/ JavaScript/Node.js debugging via js-debug
  adapter-ruby/       Ruby debugging via rdbg
  adapter-rust/       Rust debugging via CodeLLDB
  adapter-go/         Go debugging via Delve
  adapter-java/       Java debugging via JDI bridge
  adapter-dotnet/     .NET/C# debugging via netcoredbg
  adapter-cpp/        C/C++ debugging via CodeLLDB
  codelldb-common/    Shared CodeLLDB infrastructure (vendoring, resolution, spawn glue) for the Rust and C/C++ adapters
  codelldb-darwin-arm64/  Prebuilt CodeLLDB binaries, one package per platform. Published with
  codelldb-darwin-x64/    `os`/`cpu` fields so an install pulls only the matching payload; the
  codelldb-linux-arm64/   resolver in codelldb-common probes a vendored copy first, then
  codelldb-linux-x64/     CODELLDB_PATH, then the installed platform package.
  codelldb-win32-x64/
  adapter-mock/       Mock adapter for testing
  mcp-debugger/       Self-contained CLI bundle (npx distribution)
```

Build order: `shared` -> `codelldb-common` -> adapters -> `mcp-debugger` CLI bundle.

## Data Flow

```
MCP Client (Claude, etc.)
    |  MCP Protocol (JSON-RPC over stdio or Streamable HTTP; legacy SSE deprecated)
    v
MCP Server (src/server.ts composition root + src/server/ tool layer)
    |  Tool routing, input validation, path resolution
    v
SessionManager (src/session/)
    |  Session lifecycle, breakpoint management, state machine
    v
ProxyManager (src/proxy/proxy-manager.ts)
    |  IPC messages to spawned child process
    v
ProxyWorker (src/proxy/dap-proxy-worker.ts)
    |  DAP Protocol, adapter policy selection
    v
Language Adapter (@debugmcp/adapter-*)
    |  Spawns and controls debug runtime
    v
Target Process (user's script or binary)
```

Each debug session runs in a **separate process** for isolation. The ProxyManager spawns a child process containing the ProxyWorker, which communicates with the debug adapter over DAP.

## Key Components

- **MCP Server** (`src/server.ts`): Composition root — dependency wiring, lifecycle, session validation and the facade methods the tool handlers call. It also discovers available language adapters dynamically. Transports are set up by the CLI (`src/cli/`): `stdio` (default), `http` (Streamable HTTP, recommended) and the deprecated `sse`
- **Tool layer** (`src/server/`): The 28 tool names and schemas (`TOOL_NAMES` and `buildToolDefinitions()` in `tool-schemas.ts`), argument coercion and validation (`tool-arguments.ts`, `tool-validation.ts`), and `registerToolHandlers()` in `tool-dispatch.ts`, which dispatches through the `TOOL_HANDLERS` record in `handlers/index.ts` — one module per tool family. Resource and prompt handlers sit alongside in `output-resources.ts` and `prompts.ts`
- **SessionManager** (`src/session/`): 4-class inheritance hierarchy (`session-manager-core` -> `session-manager-data` -> `session-manager-operations` -> `session-manager`) managing session lifecycle (`CREATED` -> `INITIALIZING` -> `READY` -> `RUNNING` <-> `PAUSED` -> `STOPPED`). `session-manager-operations.ts` is a facade of thin delegates over per-slice collaborators under `src/session/{launch,attach,breakpoints,execution,inspection,jvm,mirror}/`, wired through `OperationsContext` (`src/session/operations-context.ts`)
- **Adapter Registry** (`src/adapters/`): Dynamic loading of adapters on-demand via ES module imports; `adapter-lease.ts` owns one adapter instance for the duration of a launch/attach setup so a failed setup cannot strand a registry slot
- **Adapter Policies** (`packages/shared/src/interfaces/adapter-policy-*.ts`): Language-specific DAP behavior via the policy pattern (`PythonAdapterPolicy`, `JsDebugAdapterPolicy`, one per language, plus `DefaultAdapterPolicy` in `adapter-policy.ts`), selected by `getPolicyForLanguage()` in `adapter-policy-map.ts`. `src/proxy/` only consumes them — `DapProxyWorker.selectAdapterPolicy()` picks one per session
- **Dependency Injection** (`src/container/`): Constructor injection for all major components

## Adapter Plugin Pattern

Each language adapter implements two interfaces from `@debugmcp/shared`:

- **`IAdapterFactory`**: Creates adapter instances, reports supported languages and capabilities
- **`IDebugAdapter`**: Manages debug adapter lifecycle (initialize, launch/attach, shutdown)

Adapters are loaded dynamically by the `AdapterLoader`, which searches for `@debugmcp/adapter-{language}` packages at runtime. This allows adapters to be developed and deployed independently.

## Detailed Documentation

- [Adapter architecture and API reference](docs/architecture/README.md)
- [System overview with Mermaid diagrams](docs/architecture/system-overview.md)
- [Adapter development guide](docs/architecture/adapter-development-guide.md)
- [Testing architecture](docs/architecture/testing-architecture.md)

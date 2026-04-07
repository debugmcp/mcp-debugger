# Architecture

mcp-debugger is a Model Context Protocol (MCP) server that bridges MCP clients (like Claude) with language-specific debug adapters via the Debug Adapter Protocol (DAP). It enables AI agents to perform step-through debugging of multiple programming languages.

## Monorepo Structure

The project uses pnpm workspaces with 9 packages:

```
packages/
  shared/             Core interfaces and types (IDebugAdapter, IAdapterFactory)
  adapter-python/     Python debugging via debugpy
  adapter-javascript/ JavaScript/Node.js debugging via js-debug
  adapter-rust/       Rust debugging via CodeLLDB
  adapter-go/         Go debugging via Delve
  adapter-java/       Java debugging via JDI bridge
  adapter-dotnet/     .NET/C# debugging via netcoredbg
  adapter-mock/       Mock adapter for testing
  mcp-debugger/       Self-contained CLI bundle (npx distribution)
```

Build order: `shared` -> adapters -> `mcp-debugger` CLI bundle.

## Data Flow

```
MCP Client (Claude, etc.)
    |  MCP Protocol (JSON-RPC over STDIO or SSE)
    v
MCP Server (src/server.ts)
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

- **MCP Server** (`src/server.ts`): Registers 21 MCP tools, handles STDIO and SSE transports, dynamically discovers available language adapters
- **SessionManager** (`src/session/`): 4-class inheritance hierarchy managing session lifecycle (`CREATED` -> `INITIALIZING` -> `READY` -> `RUNNING` <-> `PAUSED` -> `STOPPED`)
- **Adapter Registry** (`src/adapters/`): Dynamic loading of adapters on-demand via ES module imports
- **Adapter Policies** (`src/proxy/`): Language-specific DAP behavior via the policy pattern (e.g., `PythonAdapterPolicy`, `JsDebugAdapterPolicy`)
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

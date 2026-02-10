# packages/shared/src/interfaces/adapter-policy-rust.ts
@source-hash: 32e092ec69552b0a
@generated: 2026-02-10T00:41:12Z

## Purpose
Implements adapter policy for Rust debugging using the CodeLLDB debug adapter. Provides Rust-specific behaviors, variable handling, and configuration for the DAP (Debug Adapter Protocol) client.

## Key Components

### RustAdapterPolicyInterface (L13-22)
Type interface defining Rust-specific capabilities:
- Compilation requirement with Cargo support
- Default build commands (`cargo build`, `cargo build --release`)
- Supported file extensions (`.rs`)
- Debug target configuration

### RustAdapterPolicy Object (L24-333)
Main adapter policy implementation containing:

**Core Configuration:**
- `name: 'rust'` (L25)
- No child session support (L27, L29-30)
- Uses `lldb` adapter type (L100)

**Variable Handling:**
- `extractLocalVariables()` (L39-89): Extracts local variables from top stack frame, filters LLDB internal variables (names starting with `$`, `__`, `_lldb`, `_debug`)
- `getLocalScopeName()` (L94-96): Returns `['Local', 'Locals']` scope names used by CodeLLDB

**Executable Resolution:**
- `resolveExecutablePath()` (L104-115): Checks provided path, then `CARGO_PATH` env var, falls back to adapter auto-detection
- `validateExecutable()` (L133-162): Validates CodeLLDB by checking file existence and running `--version` command

**Command Management:**
- `requiresCommandQueueing()` (L167): Returns false - CodeLLDB processes commands immediately
- `shouldQueueCommand()` (L172-179): Always returns no queueing needed

**State Management:**
- `createInitialState()` (L184-189): Creates state with `initialized: false, configurationDone: false`
- State update methods (L194-207) track initialization and configuration events
- Connection checking methods (L212-222)

**Adapter Matching:**
- `matchesAdapter()` (L227-236): Matches commands/args containing 'codelldb', 'lldb-server', or 'lldb'

**DAP Client Behavior:**
- `getDapClientBehavior()` (L248-275): Minimal reverse request handling, no child session routing, standard timeouts

**Adapter Spawning:**
- `getAdapterSpawnConfig()` (L280-333): Platform-aware CodeLLDB executable resolution with vendored fallback paths, Windows-specific PDB reader environment variable

## Dependencies
- `@vscode/debugprotocol`: DAP types
- `@debugmcp/shared`: SessionState enum
- Local interfaces: AdapterPolicy, DapClientBehavior, models

## Architecture Notes
- Single-session adapter (no child session support)
- Immediate command processing (no queueing)
- Platform-specific executable resolution with vendored CodeLLDB binaries
- LLDB internal variable filtering for cleaner debugging experience
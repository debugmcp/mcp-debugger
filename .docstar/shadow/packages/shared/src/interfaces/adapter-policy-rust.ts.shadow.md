# packages/shared/src/interfaces/adapter-policy-rust.ts
@source-hash: 32e092ec69552b0a
@generated: 2026-02-09T18:14:12Z

## Primary Purpose
Rust-specific adapter policy for debugging with CodeLLDB (LLDB-based debugger). Implements the `AdapterPolicy` interface to handle Rust/CodeLLDB debugging behaviors, variable extraction, and adapter lifecycle management.

## Core Components

### Interface Definition
- **RustAdapterPolicyInterface (L13-22)**: Defines Rust-specific debugging capabilities including Cargo support, `.rs` file extensions, compilation requirements, and build commands

### Main Policy Export  
- **RustAdapterPolicy (L24-333)**: Complete adapter policy implementation with 20+ methods handling all aspects of Rust debugging workflow

## Key Methods & Responsibilities

### Variable Management
- **extractLocalVariables (L39-88)**: Extracts local variables from top stack frame, filtering out LLDB internals (`$`, `__`, `_lldb`, `_debug` prefixes) unless `includeSpecial=true`
- **getLocalScopeName (L94-96)**: Returns scope names CodeLLDB uses for locals: `['Local', 'Locals']`

### Adapter Configuration
- **getDapAdapterConfiguration (L98-102)**: Returns `{type: 'lldb'}` for CodeLLDB adapter
- **getDebuggerConfiguration (L117-126)**: Configures CodeLLDB capabilities (supports variable types, value formatting, memory references)
- **getAdapterSpawnConfig (L280-333)**: Handles adapter spawning with platform-specific executable paths and CodeLLDB arguments

### Session Lifecycle
- **validateExecutable (L133-162)**: Validates CodeLLDB binary by checking file existence and executing `--version` command
- **createInitialState (L184-189)**: Creates adapter state tracking `initialized` and `configurationDone` flags
- **updateStateOnCommand/Event (L194-207)**: Updates state based on `configurationDone` commands and `initialized` events

### Command Handling
- **requiresCommandQueueing/shouldQueueCommand (L167-179)**: Returns false - CodeLLDB processes commands immediately without queueing
- **matchesAdapter (L227-236)**: Matches adapter commands containing `codelldb`, `lldb-server`, or `lldb` strings

### DAP Client Behavior
- **getDapClientBehavior (L248-275)**: Returns minimal DAP behavior since Rust doesn't use child sessions, handles basic `runInTerminal` reverse requests

## Dependencies
- `@vscode/debugprotocol`: Debug Adapter Protocol types
- `path`: Node.js path utilities for executable resolution  
- Local interfaces: `AdapterPolicy`, `StackFrame`, `Variable`, `DapClientBehavior`
- `@debugmcp/shared`: Session state management

## Key Characteristics
- **No child session support**: Throws errors for child session operations (L29-30)
- **Platform-aware**: Handles Windows, macOS (x64/arm64), Linux (x64/arm64) executable paths
- **Cargo integration**: Supports standard Cargo build workflows
- **LLDB-specific**: Tailored for CodeLLDB adapter behaviors and variable naming conventions
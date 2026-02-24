# packages\shared\src\interfaces\adapter-policy-go.ts
@source-hash: 28505b596e6592b6
@generated: 2026-02-24T01:54:16Z

## Purpose

GoAdapterPolicy defines the complete policy configuration for debugging Go applications using the Delve debugger (dlv) in DAP (Debug Adapter Protocol) mode.

## Core Implementation

**GoAdapterPolicy Constant (L13-338)**: Main policy object implementing the AdapterPolicy interface for Go/Delve debugging. Configures Delve-specific behaviors including:
- No child session support (`supportsReverseStartDebugging: false`)
- Direct command processing without queueing
- Delve executable path resolution with DLV_PATH environment variable fallback

## Key Variable Handling

**extractLocalVariables() (L28-77)**: Extracts local variables from the top stack frame's "Locals" scope, with optional filtering of Go internal variables (those starting with underscore). Handles Delve's specific scope naming conventions.

**getLocalScopeName() (L82-84)**: Returns Delve's standard scope names: "Locals" and "Arguments".

**filterStackFrames() (L275-296)**: Filters out Go runtime and testing framework frames unless explicitly requested, hiding internal implementation details from debugging sessions.

## Adapter Configuration

**resolveExecutablePath() (L92-106)**: Resolves Delve executable path with priority: provided path > DLV_PATH environment variable > default "dlv" command.

**validateExecutable() (L122-142)**: Validates dlv executable by spawning `dlv version` command and checking for successful exit code and output.

**getAdapterSpawnConfig() (L309-338)**: Builds spawn configuration for dlv DAP mode with logging enabled, supporting both custom adapter commands and default dlv dap setup.

## Session Management

**State Management (L164-202)**: Tracks adapter initialization and configuration state through `createInitialState()`, `updateStateOnCommand()`, and `updateStateOnEvent()` methods.

**Initialization Behavior (L226-238)**: Configures Delve-specific quirks:
- `defaultStopOnEntry: false` to avoid "unknown goroutine 1" error
- `sendLaunchBeforeConfig: true` for proper initialization sequence

**Command Handling (L147-159)**: Disables command queueing since Delve processes commands immediately without timing issues.

## Dependencies

- `@vscode/debugprotocol` for Debug Adapter Protocol types
- `./adapter-policy.js` for base policy interface
- `@debugmcp/shared` for SessionState enum
- `../models/index.js` for StackFrame and Variable types
- `./dap-client-behavior.js` for DAP client interfaces

## Notable Patterns

- Comprehensive error handling with graceful fallbacks for missing scopes/variables
- Environment variable support for custom Delve installation paths
- Platform-agnostic executable resolution
- Minimal DAP client behavior since Go doesn't use child debugging sessions
- Frame filtering to hide Go runtime internals from user debugging experience
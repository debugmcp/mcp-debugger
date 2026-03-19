# Python Dependencies in mcp-debugger

## Overview

The mcp-debugger codebase has evolved from a Python-only debugger to a multi-language system. The `DebugLanguage` enum now contains six values: `PYTHON`, `JAVASCRIPT`, `RUST`, `GO`, `JAVA`, and `MOCK`. Core components like SessionManager, ProxyManager, and DapProxyWorker are language-agnostic, using the Adapter Policy pattern and dynamic adapter loading. Python-specific logic has been moved into `packages/adapter-python/`. Some residual Python coupling still exists in peripheral files (test fixtures, interface methods like `launchPythonDebugTarget`).

## Coupling Heat Map (Post-Refactoring)

```
NONE (Fully Refactored):
├── src/session/session-manager*.ts    [Language-agnostic, delegates to adapters]
├── src/proxy/proxy-manager.ts         [Language-agnostic, uses IDebugAdapter]
├── src/proxy/dap-proxy-worker.ts      [Uses AdapterPolicy pattern]
├── src/proxy/dap-proxy-adapter-manager.ts [GenericAdapterManager, spawns any adapter]
└── src/server.ts                      [Dynamic language discovery via AdapterRegistry]

ISOLATED (Correct Separation):
├── packages/adapter-python/           [Python-specific logic properly isolated]
└── packages/shared/src/adapter-policies/ [Per-language policies]

LOW (Residual):
├── packages/shared/src/interfaces/process-interfaces.ts [launchPythonDebugTarget naming]
├── tests/* (50+ files)                [Test fixtures and runners]
├── examples/python/*                  [Example scripts]
└── docs/python/*                      [Documentation]
```

## Critical Path Components

### 1. src/session/session-manager.ts (thin facade over session-manager-core.ts + session-manager-operations.ts)
**Coupling Level: LOW (refactored)**

The SessionManager no longer imports `findPythonExecutable` or contains Python path resolution logic. Executable path resolution is delegated to the adapter via `IDebugAdapter.resolveExecutablePath()` in ProxyManager. The session-manager class hierarchy is:
- `SessionManagerCore` (lifecycle, state management, event handlers)
- `SessionManagerData` (variables, stack traces, scopes, local variables)
- `SessionManagerOperations` (start debugging, stepping, breakpoints, evaluate)
- `SessionManager` (thin facade extending `SessionManagerOperations`)

### 2. src/server.ts
**Coupling Level: LOW (refactored)**

The hardcoded `language !== 'python'` check has been removed. The server now dynamically discovers supported languages from the `AdapterRegistry` and validates against the available set. Default language is still `'python'` when not specified, and `DEFAULT_LANGUAGES` includes `['python', 'mock']`. Tool definitions use the dynamically built language list.

### 3. packages/adapter-python/src/utils/python-utils.ts
**Coupling Level: CRITICAL**

Entire file (167 lines) is Python-specific:
- `findPythonExecutable()` - Python discovery logic
- `isValidPythonExecutable()` - Windows Store alias detection
- `getPythonVersion()` - Version checking

**Note**: This is actually good separation - language-specific utils should be isolated

### 4. src/proxy/dap-proxy-adapter-manager.ts
**Coupling Level: NONE (refactored)**

This file is now `GenericAdapterManager` -- a fully language-agnostic component that spawns any debug adapter from a `GenericAdapterConfig` (command, args, logDir, cwd, env). The hardcoded debugpy command has been removed. Adapter spawn configuration is provided by the Adapter Policy pattern (`AdapterPolicy.getAdapterSpawnConfig()`).

## Configuration Components

### 1. Data Structures

**packages/shared/src/models/index.ts**
- `DebugLanguage` enum now has six values: PYTHON, JAVASCRIPT, RUST, GO, JAVA, MOCK
- `executablePath?: string` remains language-agnostic in SessionConfig

**src/proxy/proxy-config.ts**
- `executablePath?: string` -- optional; adapters can discover the path if not provided

**src/session/session-store.ts**
- No longer has `DEFAULT_PYTHON` constant
- Uses `AdapterPolicy.resolveExecutablePath()` for defaults

### 2. Interface Definitions

**packages/shared/src/interfaces/process-interfaces.ts**
- `IDebugTargetLauncher.launchPythonDebugTarget()` -- residual Python naming, still in use

**src/proxy/dap-proxy-interfaces.ts**
- `executablePath` in multiple interfaces (now language-agnostic)

## Peripheral Components

### Test Files (50+ occurrences)
- `tests/fixtures/python-scripts.ts` - Python test scripts
- `tests/fixtures/python/*.py` - Actual Python files
- `tests/integration/python-*.test.ts` - Python-specific tests
- `tests/e2e/debugpy-connection.test.ts` - debugpy integration

### Build System Dependencies

**package.json**
- No direct Python dependencies in scripts
- Test commands assume Python availability

**Docker configurations**
- Dockerfile doesn't install Python (assumes host Python)
- docker-compose.test.yml doesn't specify Python version

## Error Messages and Logging

### User-Facing Messages
1. **src/utils/error-messages.ts** -- now uses generic language:
   ```typescript
   `This may indicate that the debug adapter failed to start or is not properly configured. ` +
   `Check that the required debug adapter is installed and accessible.`
   ```

2. **src/server.ts** -- language-specific error messages are handled by adapters, not hardcoded

### Log Messages
- Core log statements are language-agnostic (e.g., "Adapter spawned", "Adapter configured")
- Adapter-specific log messages live in the respective adapter packages

## Configuration Files

### Default Configurations
- No hardcoded Python paths in config files
- Python-specific environment variables (`PYTHON_PATH`, `PYTHON_EXECUTABLE`) are handled inside `packages/adapter-python/`
- Platform-specific Python defaults (`python` on Windows vs `python3` on Unix) are in the Python adapter policy

## Multi-Language Support (Completed)

The following changes have been implemented:

1. **DebugLanguage enum expanded** (`packages/shared/src/models/index.ts`)
   ```typescript
   export enum DebugLanguage {
     PYTHON = 'python',
     JAVASCRIPT = 'javascript',
     RUST = 'rust',
     GO = 'go',
     JAVA = 'java',
     MOCK = 'mock',
   }
   ```

2. **Adapter interfaces created** (`packages/shared/`)
   - `IDebugAdapter` and `IAdapterFactory` interfaces in shared package
   - Implementations in `packages/adapter-python/`, `packages/adapter-javascript/`, `packages/adapter-go/`, `packages/adapter-rust/`, `packages/adapter-mock/`

3. **Adapter Policy pattern** (`packages/shared/src/adapter-policies/`)
   - `AdapterPolicy` interface with per-language policies (Python, JavaScript, Rust, Go, Java, Mock, Default)
   - Handles language-specific DAP initialization sequences, stack frame filtering, variable extraction

4. **Dynamic adapter loading** (`src/adapters/adapter-loader.ts`, `src/adapters/adapter-registry.ts`)
   - Adapters loaded on-demand by package name `@debugmcp/adapter-{language}`
   - Server validates language against available adapters from the registry

## Resolved Anti-Patterns

1. **Language-Specific Parameters in Core Interfaces**
   - Resolved: `executablePath` is language-agnostic; adapters resolve defaults via `IDebugAdapter.resolveExecutablePath()`

2. **Hardcoded Language Checks**
   - Resolved: Server validates against `AdapterRegistry.getRegisteredLanguages()` instead of hardcoded strings

3. **Mixing Business Logic with Language Logic**
   - Resolved: Session manager delegates to adapters; language-specific logic lives in adapter packages and adapter policies

4. **Assumptions in Error Messages**
   - Partially resolved: Core error messages (error-messages.ts) are now generic; some test files still reference Python-specific messages

## Gotchas

1. Platform-specific Python commands: Windows uses 'python' while Unix uses 'python3' by default (handled by `PythonAdapterPolicy.resolveExecutablePath()`)
2. Windows Store Python detection: Special logic in `packages/adapter-python/` to detect and skip Windows Store Python aliases
3. Test coupling: Some test files still directly import python-utils instead of mocking via the adapter interface
4. Residual naming: `IDebugTargetLauncher.launchPythonDebugTarget()` still uses Python-specific naming in the shared interfaces

## Current Status

The multi-language refactoring is complete at the architecture level:
- Core components (SessionManager, ProxyManager, DapProxyWorker) are language-agnostic
- Six adapter policies handle language-specific DAP behavior
- Dynamic adapter loading discovers adapters at runtime
- Remaining Python coupling is in peripheral code (test fixtures, some interface naming)

# Python Dependencies in mcp-debugger

## Overview

The mcp-debugger codebase has deep Python coupling across 99 files, with approximately 10 core files having critical dependencies and 50+ test files requiring Python runtime. The `DebugLanguage` enum contains only `PYTHON`, indicating the system was never truly multi-language but structured with that possibility in mind.

## Coupling Heat Map

```
CRITICAL (Must Change):
├── src/session/session-manager.ts     [Lines: 29, 114-196, 834]
├── src/proxy/proxy-manager.ts         [Lines: 35-36]
├── src/utils/python-utils.ts          [Entire file - 167 lines]
└── src/proxy/dap-proxy-*.ts           [All proxy components]

HIGH (Core Flow):
├── src/server.ts                      [Lines: 73-75, 246, 318-322]
├── src/session/models.ts              [Lines: 18-19, 48-49]
└── src/implementations/process-launcher-impl.ts [Lines: 74-88]

MEDIUM (Configuration):
├── src/session/session-store.ts       [Lines: 3, 46, 64]
├── src/interfaces/process-interfaces.ts [Lines: 21-28]
└── package.json scripts               [Python assumptions in tests]

LOW (Peripheral):
├── tests/* (50+ files)                [Test fixtures and runners]
├── examples/python/*                  [Example scripts]
└── docs/python/*                      [Documentation]
```

## Critical Path Components

### 1. src/session/session-manager.ts
**Coupling Level: CRITICAL**

- **Line 29**: Import of `findPythonExecutable` from python-utils
- **Lines 114-196**: Python path resolution logic
  ```typescript
  // Line 166-168: Hardcoded Python detection
  } else if (['python', 'python3', 'py'].includes(executablePathFromSession.toLowerCase())) {
    resolvedExecutablePath = await findPythonExecutable(undefined, this.logger);
  ```
- **Line 183**: Python-specific comment about container mode
- **Line 834**: Error messages mentioning Python/debugpy

**Anti-pattern**: Mixing language-specific logic with session management

### 2. src/server.ts
**Coupling Level: HIGH**

- **Lines 73-75**: Hard-coded Python check
  ```typescript
  if (params.language !== 'python') { 
    throw new McpError(McpErrorCode.InvalidParams, "language parameter must be 'python'");
  }
  ```
- **Line 246**: Tool definition with `enum: ['python']`
- **Lines 318-322**: Python-specific error messages in catch blocks

**Anti-pattern**: Language validation at API layer instead of adapter layer

### 3. src/utils/python-utils.ts
**Coupling Level: CRITICAL**

Entire file (167 lines) is Python-specific:
- `findPythonExecutable()` - Python discovery logic
- `isValidPythonExecutable()` - Windows Store alias detection
- `getPythonVersion()` - Version checking

**Note**: This is actually good separation - language-specific utils should be isolated

### 4. src/proxy/dap-proxy-process-manager.ts
**Coupling Level: CRITICAL**

- **Lines 26-32**: Hardcoded debugpy command
  ```typescript
  const args = [
    '-m', 'debugpy.adapter',
    '--host', host,
    '--port', String(port),
    '--log-dir', logDir
  ];
  ```
- **Line 40**: Log message mentioning debugpy
- **Line 65**: Error message about debugpy

**Anti-pattern**: Proxy manager knows about specific debugger implementation

## Configuration Components

### 1. Data Structures with Python Fields

**src/session/models.ts**
- Line 18: `DebugLanguage.PYTHON = 'python'` (only value!)
- Lines 48-49: `executablePath?: string` in SessionConfig

**src/proxy/proxy-manager.ts**
- Lines 35-36: `executablePath: string` in ProxyConfig

**src/session/session-store.ts**
- Line 3: `DEFAULT_PYTHON` platform-specific constant
- Line 46: `executablePath?: string` in CreateSessionParams
- Line 64: Default executable path logic

### 2. Interface Definitions

**src/interfaces/process-interfaces.ts**
- Lines 21-28: `IDebugTargetLauncher.launchPythonDebugTarget()`

**src/proxy/dap-proxy-interfaces.ts**
- `executablePath` in multiple interfaces

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
1. **src/server.ts:318-322**
   ```typescript
   "Please ensure:\n" +
   "1. Python 3.7+ is installed and in your PATH\n" +
   "2. The debugpy package is installed (pip install debugpy)\n"
   ```

2. **src/utils/error-messages.ts:5-8**
   ```typescript
   `Check that Python and debugpy are properly installed and accessible.`
   ```

### Log Messages
- Over 50 log statements mention "Python" or "debugpy"
- Session manager logs Python path resolution
- Proxy manager logs debugpy adapter spawning

## Configuration Files

### Default Configurations
- No hardcoded Python paths in config files
- Environment variables: `PYTHON_PATH`, `PYTHON_EXECUTABLE`
- Platform-specific defaults: `python` (Windows) vs `python3` (Unix)

## Choke Points for Multi-Language Support

### Minimal Changes Required:

1. **Expand DebugLanguage enum** (src/session/models.ts)
   ```typescript
   export enum DebugLanguage {
     PYTHON = 'python',
     // Add: NODE = 'node', GO = 'go', etc.
   }
   ```

2. **Create Adapter Interface** (new file)
   ```typescript
   interface IDebugAdapter {
     createSession(config: SessionConfig): Promise<DebugSession>;
     spawnAdapter(config: AdapterConfig): Promise<AdapterProcess>;
   }
   ```

3. **Adapter Selection Logic** (session-manager.ts)
   - Replace Python-specific logic with adapter.createSession()
   - Inject appropriate adapter based on language

4. **Remove Language Validation** (server.ts:73-75)
   - Let adapter handle unsupported languages

## Anti-Patterns to Avoid in Refactoring

1. **Language-Specific Parameters in Core Interfaces**
   - Current: `executablePath` in SessionConfig (now language-agnostic)
   - ✅ Already improved from previous `pythonPath`

2. **Hardcoded Language Checks**
   - Current: `if (language !== 'python')`
   - Better: `if (!adapters.has(language))`

3. **Mixing Business Logic with Language Logic**
   - Current: Session manager knows about Python discovery
   - Better: Adapter handles all language-specific concerns

4. **Assumptions in Error Messages**
   - Current: "Install debugpy"
   - Better: Adapter-provided error messages

## Surprises and Gotchas

1. **🎯 No Existing Multi-Language Code**: The `DebugLanguage` enum only has `PYTHON`, so we're not breaking existing functionality
2. **⚠️ Platform-Specific Python Commands**: Windows uses 'python' while Unix uses 'python3' by default
3. **🔍 Windows Store Python Detection**: Special logic to detect and skip Windows Store Python aliases
4. **📦 No debugpy in Docker**: The Dockerfile doesn't install Python or debugpy - relies on host
5. **🧪 Test Coupling**: Many tests directly import python-utils instead of mocking

## Summary Statistics

- **Total files with Python dependencies**: 99
- **Core files requiring refactoring**: 10
- **Test files affected**: 50+
- **Lines of Python-specific code in core**: ~500
- **Estimated refactoring complexity**: HIGH for core, MEDIUM for tests
- **Risk level**: HIGH (touches critical debugging flow)

## Recommendations

1. **Phase 1**: Extract adapter interface and implement PythonAdapter
2. **Phase 2**: Refactor session-manager to use adapters
3. **Phase 3**: Update API layer and tests
4. **Quick Win**: The enum expansion won't break anything
5. **Watch Out**: The proxy pattern already exists - leverage it!

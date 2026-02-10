# packages/shared/tests/unit/
@generated: 2026-02-10T01:19:40Z

## Purpose

This directory contains comprehensive unit tests for language-specific debug adapter policies within the shared debugging infrastructure. These tests validate the implementation of Debug Adapter Protocol (DAP) compliance for JavaScript/Node.js and Rust debugging environments.

## Key Components

### JavaScript Debug Adapter Tests (`adapter-policy-js.spec.ts`)
- Tests `JsDebugAdapterPolicy` class functionality
- Validates JavaScript/Node.js debugging session management
- Covers DAP command queueing, initialization flows, and session lifecycle
- Tests adapter process spawning and configuration

### Rust Debug Adapter Tests (`adapter-policy-rust.test.ts`)  
- Tests `RustAdapterPolicy` class functionality
- Validates Rust debugging with CodeLLDB adapter integration
- Covers executable resolution, validation, and platform-specific configuration
- Tests cross-platform adapter spawning strategies

## Core Testing Domains

### Debug Adapter Protocol (DAP) Compliance
Both test suites ensure proper DAP implementation:
- Command queueing and ordering (initialize → configure → launch flow)
- Stack frame processing and filtering
- Variable extraction from debug scopes
- Session state management and lifecycle tracking

### Platform and Environment Management
- Cross-platform adapter executable resolution
- Environment variable handling (`CARGO_PATH`, etc.)
- Platform-specific vendored adapter paths
- Process spawning configuration validation

### Variable and Stack Frame Processing
- Filtering of internal/system frames from user code
- Local variable extraction from debug scopes  
- Special variable handling (`this`, `__proto__`, debugger internals)
- Fallback behavior for edge cases (empty frames, all-internal stacks)

## Testing Infrastructure

### Mock Strategy
- **File System**: Mocked `fs/promises` for executable validation
- **Child Processes**: Mocked `child_process` with event simulation
- **Platform Detection**: Temporary platform/architecture overrides
- **DAP Protocol**: Mock DebugProtocol objects and contexts

### Test Utilities
- `createStackFrame()`: Generates mock DAP stack frames
- `setPlatform()`: Platform simulation helper
- `createChild()`: Child process mock factory
- Extensive use of vitest mocking with proper cleanup

## Integration Points

### Adapter Policy Interface
Tests validate consistent adapter policy behavior across languages:
- `matchesAdapter()`: Adapter process detection
- `extractLocalVariables()`: Variable scope processing  
- `validateExecutable()`: Binary validation workflows
- `getAdapterSpawnConfig()`: Process configuration generation

### State Management
Both test suites validate shared state management patterns:
- Session initialization tracking
- Configuration completion detection
- Connection status monitoring
- Command queue state transitions

## Key Patterns

### Comprehensive Edge Case Testing
- Empty data structures (frames, variables, scopes)
- All-internal frame scenarios with fallback behavior
- Process spawn failures and error conditions
- Missing executables and validation failures

### Language-Specific Concerns
- **JavaScript**: Node.js internal frame filtering, `pwa-node` adapter normalization
- **Rust**: Cargo executable resolution, CodeLLDB adapter integration

This test directory ensures robust, language-agnostic debugging infrastructure while accommodating the specific requirements and toolchains of different development environments.
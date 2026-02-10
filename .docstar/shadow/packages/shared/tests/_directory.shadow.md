# packages/shared/tests/
@generated: 2026-02-10T01:19:52Z

## Purpose

This directory contains the comprehensive test suite for the shared debugging infrastructure, validating language-specific debug adapter policies and their integration with the Debug Adapter Protocol (DAP). The tests ensure robust, cross-platform debugging capabilities for JavaScript/Node.js and Rust development environments.

## Key Components and Organization

### Language-Specific Adapter Policy Tests
- **JavaScript Tests** (`unit/adapter-policy-js.spec.ts`): Validates `JsDebugAdapterPolicy` with Node.js debugging workflows
- **Rust Tests** (`unit/adapter-policy-rust.test.ts`): Validates `RustAdapterPolicy` with CodeLLDB adapter integration

Both test suites follow consistent patterns while addressing language-specific debugging requirements and toolchain integration.

## Core Testing Domains

### Debug Adapter Protocol (DAP) Compliance
- Command queueing and proper initialization flow (initialize → configure → launch)
- Stack frame processing with internal frame filtering
- Variable extraction from debug scopes with special handling
- Session lifecycle and state management validation

### Cross-Platform Adapter Management
- Executable resolution and validation across platforms
- Environment-specific configuration (CARGO_PATH, vendored adapters)
- Process spawning strategies with platform detection
- Adapter process detection and matching logic

### Data Processing and Filtering
- Stack frame filtering to surface user code over internal frames
- Local variable extraction with debugger internal exclusion
- Fallback behaviors for edge cases (empty stacks, missing data)
- Language-specific frame normalization

## Public API Surface

The tests validate the core adapter policy interface that all language implementations must support:

### Primary Entry Points
- `matchesAdapter()`: Adapter process detection and identification
- `extractLocalVariables()`: Variable scope processing from debug contexts
- `validateExecutable()`: Binary validation and resolution workflows
- `getAdapterSpawnConfig()`: Process configuration generation for adapter launching

### State Management Interface
- Session initialization tracking and validation
- Configuration completion detection
- Connection status monitoring
- Command queue state transitions

## Internal Organization and Testing Strategy

### Mock Infrastructure
- Comprehensive mocking of file system, child processes, and platform detection
- DAP protocol object mocking with realistic data structures
- Event simulation for debugging session workflows
- Proper cleanup and teardown between test cases

### Test Utilities and Patterns
- Shared mock factories (`createStackFrame`, `createChild`, `setPlatform`)
- Consistent edge case testing across all implementations
- Language-agnostic test patterns with specific customization
- Integration point validation ensuring consistent behavior

## Integration with Larger System

This test suite validates the debugging infrastructure's ability to:
- Support multiple programming languages through unified interfaces
- Maintain DAP compliance across different adapter implementations
- Handle cross-platform deployment scenarios reliably
- Process debugging data consistently regardless of language runtime

The tests ensure that language-specific adapter policies integrate seamlessly into the broader debugging system while maintaining their specialized capabilities for their respective development environments.
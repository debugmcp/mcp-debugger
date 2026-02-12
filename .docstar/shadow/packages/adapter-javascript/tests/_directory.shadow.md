# packages\adapter-javascript\tests/
@generated: 2026-02-12T21:01:18Z

## Directory Purpose

The `packages/adapter-javascript/tests` directory contains the complete test suite for the JavaScript debug adapter package, providing comprehensive validation of all adapter functionality including DAP protocol compliance, configuration management, executable resolution, and cross-platform compatibility.

## Test Architecture

### Core Test Organization

**Unit Tests (`unit/`)**
- Comprehensive unit test coverage for all adapter components
- Mock-based testing with dependency injection for controlled environments
- Cross-platform testing patterns for Windows and POSIX systems
- Edge case validation for real-world deployment scenarios

### Key Testing Categories

**Adapter Protocol & Lifecycle**
- DAP (Debug Adapter Protocol) request/response handling validation
- State transition testing (UNINITIALIZED → INITIALIZING → READY → CONNECTED/DEBUGGING)
- Event emission patterns and connection management
- Error handling and graceful degradation

**Configuration & Project Analysis**
- JavaScript/TypeScript project detection and analysis
- Package.json and tsconfig.json parsing with fault tolerance
- ESM project detection and TypeScript path mapping resolution
- Output file pattern determination for debugging

**Environment & Executable Resolution**
- Cross-platform Node.js executable discovery in PATH
- TypeScript runtime tool detection (tsx, ts-node) with caching
- Platform-aware executable handling (.exe, .cmd on Windows)
- Build system integration and vendor strategy validation

## Test Infrastructure

### Mock System
- **MockFileSystem**: Configurable filesystem simulation for isolated testing
- **Environment isolation**: PATH and NODE_OPTIONS manipulation with cleanup
- **Dependency injection**: FileSystem and other dependencies injected for controlled testing
- **Event testing patterns**: For validating event-driven adapter behavior

### Cross-Platform Support
- Platform detection utilities (`isWindows()`) for environment-specific testing
- Path normalization for Windows/POSIX compatibility
- Executable suffix handling across different operating systems
- Environment variable parsing for various shell environments

### Performance & Reliability
- Cache behavior validation for executable detection systems
- Memory leak prevention through proper mock cleanup
- Idempotency testing for repeated operations
- Network failure simulation for build tooling

## Key Components Under Test

**JavascriptDebugAdapter**
- Main adapter class implementing DAP protocol
- Configuration transformation for JS/TS debugging scenarios
- Connection state management and error translation

**Configuration Analysis**
- `isESMProject()` - ES module project detection
- `hasTsConfigPaths()` - TypeScript path mapping detection  
- `determineOutFiles()` - Debug output file pattern resolution

**Executable Resolution**
- `findNode()` - Node.js binary location with intelligent fallbacks
- `detectBinary()` - TypeScript tooling detection with PATH precedence
- Cross-platform executable discovery and caching

**Build & Factory Systems**
- GitHub release asset selection and prioritization
- Environment-driven vendor strategy determination
- Adapter factory creation and validation logic

## Public Testing API

### Entry Points
- Standard Vitest test patterns with `describe()` and `it()` blocks
- Mock factories for filesystem, logger, and adapter dependencies
- Environment manipulation helpers (`withPath()`) for temporary configuration
- Platform utilities for cross-platform test execution

### Coverage Objectives
- **Functional**: All public methods and configuration pathways
- **Error Handling**: Exception safety and user-friendly error messages
- **Cross-Platform**: Windows and POSIX system compatibility validation
- **Edge Cases**: Malformed configurations, missing dependencies, network failures
- **Performance**: Caching mechanisms and resource management

The test suite ensures the JavaScript debug adapter is production-ready, handling diverse Node.js/TypeScript environments, development tooling variations, and real-world deployment scenarios with robust error handling and cross-platform compatibility.
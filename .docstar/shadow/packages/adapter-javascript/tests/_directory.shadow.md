# packages/adapter-javascript/tests/
@generated: 2026-02-10T01:19:56Z

## Purpose
This directory contains the comprehensive test suite for the JavaScript debug adapter package, providing extensive validation of all debugging capabilities, configuration handling, and platform-specific behaviors. The test suite ensures reliable JavaScript/TypeScript debugging across different environments and development setups.

## Key Components

### Unit Test Suite
The `unit/` subdirectory contains a complete test suite organized by functional areas:

- **Adapter Core**: Factory creation, lifecycle management, and capability validation
- **Configuration System**: Project detection, TypeScript support, and launch configuration transformation  
- **Runtime Resolution**: Cross-platform executable discovery and environment detection
- **Debug Protocol**: DAP communication, command building, and connection management
- **Build Integration**: Debug helper utilities and release asset management

### Test Infrastructure
- **Mock Framework**: Standardized MockFileSystem and dependency stubs for consistent test isolation
- **Cross-Platform Testing**: Windows/POSIX compatibility validation with platform-specific behaviors
- **Edge Case Coverage**: Comprehensive error handling, filesystem failures, and malformed configuration testing
- **Environment Management**: PATH manipulation and cleanup with environment variable isolation

## Test Organization & Integration

### Component Testing Strategy
Tests validate the complete adapter pipeline from configuration to debug session establishment:

1. **Factory & Initialization**: JavascriptAdapterFactory creation and adapter instantiation lifecycle
2. **Configuration Processing**: Project type detection, TypeScript path handling, and launch config transformation
3. **Runtime Discovery**: Node.js executable resolution with fallback mechanisms and caching
4. **Debug Session**: DAP protocol handling, command construction, and connection state management

### Mock Infrastructure Patterns
- **Filesystem Abstraction**: Controlled file existence and content simulation
- **Dependency Injection**: Standardized AdapterDependencies with logger interfaces
- **Platform Simulation**: Cross-platform behavior testing without environment dependencies

## Public API Testing Surface

### Primary Entry Points Validated
- **JavascriptAdapterFactory.create()**: Complete adapter instantiation with dependency injection
- **JavascriptDebugAdapter.initialize()**: Async initialization with comprehensive environment validation
- **transformLaunchConfig()**: Debug configuration transformation with TypeScript and ESM/CommonJS support
- **buildAdapterCommand()**: Command line construction with NODE_OPTIONS and runtime args handling

### Core Capabilities Coverage
- **Debug Features**: Breakpoints, evaluation, stepping, exception handling, and DAP capabilities
- **TypeScript Integration**: Runtime detection (tsx/ts-node), project type analysis, and path mapping
- **Environment Adaptation**: Executable resolution, platform detection, and fallback strategies
- **Error Handling**: User-friendly error translation and installation guidance

## Test Architecture Benefits

### Quality Assurance
The test suite provides confidence in adapter reliability through:
- **Comprehensive Coverage**: All functional areas with edge case validation
- **Platform Compatibility**: Cross-platform behavior verification
- **Error Resilience**: Fault tolerance and graceful degradation testing
- **Integration Validation**: End-to-end workflow testing from configuration to debug session

### Development Support
Tests enable safe refactoring and feature development through:
- **Regression Prevention**: Comprehensive validation of existing functionality
- **Behavioral Documentation**: Tests serve as executable specifications
- **Platform Verification**: Ensures consistent behavior across development environments
- **Mock Consistency**: Standardized testing patterns for reliable test execution

The test suite ensures the JavaScript debug adapter maintains high quality and reliability standards while supporting diverse JavaScript/TypeScript development scenarios.
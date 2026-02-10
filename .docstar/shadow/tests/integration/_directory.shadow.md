# tests/integration/
@generated: 2026-02-09T18:16:17Z

## Integration Testing Module

**Primary Purpose:** Comprehensive end-to-end integration testing for the debug session management system. This module validates the complete workflow of debug adapters across different programming languages, ensuring proper integration between core components and language-specific debugging capabilities.

### Module Organization & Components

The directory contains language-specific integration test suites organized by programming language:

- **Rust Testing Suite** (`rust/`): Complete integration testing for Rust debugging capabilities, including Cargo project handling, breakpoint management, and session lifecycle validation

Each language module follows consistent testing patterns while accommodating language-specific requirements and project structures.

### Public API Surface

**Test Entry Points:**
- Language-specific test suites accessible via standard test runners (Vitest)
- Integration validation for debug session lifecycle management
- End-to-end testing of debug adapter functionality

**Key Testing Capabilities:**
- Debug session creation, configuration, and termination
- Language-specific project integration (Cargo for Rust, etc.)
- Breakpoint setting and management across source files
- Resource cleanup and state management validation

### Architecture Integration

The integration tests validate interactions between core system components:

- **SessionManager Integration**: Tests the central session orchestrator with real debug adapters
- **Dependency Container**: Validates production dependency injection and configuration
- **Language Adapters**: Tests language-specific debug adapter implementations
- **File System Operations**: Validates cross-platform file and project handling

### Testing Strategy & Patterns

**Production Fidelity:** Uses actual production dependencies rather than mocks to ensure realistic integration testing and catch real-world compatibility issues.

**Isolation & Reliability:** 
- Temporary directories and separate logging prevent test interference
- Graceful degradation ensures tests pass even when example projects are unavailable
- Proper resource cleanup prevents state leakage between test runs

**Comprehensive Coverage:**
- Session lifecycle validation (creation → operation → cleanup)
- Language-specific project integration and debugging features
- Error handling and edge case scenarios
- Cross-platform compatibility testing

### Data Flow & Test Execution

1. **Environment Setup**: Creates isolated test environments with production-grade configurations
2. **Session Management**: Validates debug session creation and configuration through SessionManager
3. **Language Operations**: Tests language-specific debugging features and project integration
4. **Cleanup & Validation**: Ensures proper resource management and state cleanup

The module serves as the primary validation layer ensuring the debug session management system functions correctly across different programming languages and environments, providing confidence in production deployments.
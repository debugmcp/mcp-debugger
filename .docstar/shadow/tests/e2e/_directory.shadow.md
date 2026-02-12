# tests\e2e/
@generated: 2026-02-12T21:06:14Z

## Purpose

The `tests/e2e` directory contains comprehensive end-to-end testing infrastructure for the MCP (Model Context Protocol) debugger. This module validates that all debugging functionality works correctly across different environments, languages, and deployment scenarios - from development to production distribution.

## Architecture Overview

The testing infrastructure is organized into three main validation layers:

### 1. Core Functionality Testing
- **Language Matrix Tests**: Validates all 19 MCP debugger tools across 5 supported languages (Python, JavaScript, Rust, Go, Mock)
- **Transport Testing**: Tests both stdio and SSE (Server-Sent Events) transport mechanisms
- **Integration Validation**: Complete debugging workflows from session creation to variable inspection

### 2. Environment-Specific Testing  
- **Docker Container Testing**: Validates debugger functionality in containerized environments
- **Cross-Platform Testing**: Windows/Unix compatibility with proper path handling
- **Real vs Mock Environments**: Tests against actual language runtimes and mock adapters

### 3. Distribution Testing
- **NPX Package Validation**: Tests globally installed npm packages to ensure proper distribution
- **Build Pipeline Integration**: Validates packaging includes all required language adapters
- **Production Environment Simulation**: Tests mirror real-world usage scenarios

## Key Components & Data Flow

### Core Test Infrastructure
- **`comprehensive-mcp-tools.test.ts`**: Matrix testing engine - tests every tool against every language
- **`smoke-test-utils.ts`**: Shared utilities for MCP client operations, Docker management, and debug workflows
- **`test-event-utils.ts`**: State polling and event detection for debug session management

### Language-Specific Test Suites
- **`mcp-server-smoke-*.test.ts`**: Individual language smoke tests (JavaScript, Python, Rust, Go)
- **`debugpy-connection.test.ts`**: Python debugpy integration validation
- **`rust-example-utils.ts`**: Rust cross-compilation and binary management

### Environment Testing Modules
- **`docker/`**: Complete Docker containerization testing suite
- **`npx/`**: NPM package distribution and global installation validation
- **`*-sse.test.ts`**: Server-Sent Events transport testing

## Public API Surface

### Main Entry Points
- **Matrix Test Runner**: `comprehensive-mcp-tools.test.ts` - executes full tool/language compatibility matrix
- **Individual Language Tests**: `mcp-server-smoke-{language}.test.ts` - focused testing per language
- **Transport Tests**: `*-sse.test.ts` - validates SSE transport functionality
- **Environment Tests**: `docker/*.test.ts`, `npx/*.test.ts` - specialized environment validation

### Utility APIs
- **Debug Workflow**: `executeDebugSequence()` - standard debugging workflow orchestration
- **MCP Client Utilities**: `parseSdkToolResult()`, `callToolSafely()` - safe MCP tool interactions
- **Docker Management**: `buildDockerImage()`, `createDockerMcpClient()` - container lifecycle
- **Package Testing**: `buildAndPackNpmPackage()`, `createNpxMcpClient()` - distribution validation

## Integration Patterns

### Test Execution Flow
1. **Setup Phase**: Environment validation, server startup, client connection
2. **Debug Workflow**: Session creation, breakpoints, execution control, variable inspection
3. **Cleanup Phase**: Session closure, resource cleanup, process termination

### Error Handling Strategy
- **Graceful Degradation**: Tests skip when dependencies unavailable (Go/Rust toolchains)
- **Comprehensive Cleanup**: Multi-layered cleanup (afterEach/afterAll) prevents resource leaks
- **Defensive Programming**: Try-catch blocks prevent cascade failures during cleanup

### Cross-Platform Compatibility
- **Path Normalization**: Host-to-container path translation for Docker environments
- **Platform Detection**: Windows/Unix-specific handling for executable paths and process management
- **Dynamic Port Allocation**: Prevents port conflicts in CI environments

## Critical Test Scenarios

### Production Issue Validation
- **SSE IPC Corruption**: Tests console output silencing fix for JavaScript debugging
- **Adapter Packaging**: Validates all language adapters included in NPM distribution
- **Binary Compilation**: Cross-platform Rust builds with Docker isolation

### Comprehensive Validation Matrix
- **19 MCP Tools** × **5 Languages** = 95 individual test scenarios
- **Multiple Transports**: stdio and SSE communication validation
- **Environment Coverage**: Development, Docker, and NPM distribution testing

## Dependencies & Constraints

### Core Dependencies
- **MCP SDK**: Client/transport libraries for protocol communication
- **Language Runtimes**: Python, Node.js, Rust, Go toolchains for real debugging
- **Docker**: Container orchestration for isolated testing environments
- **npm/pnpm**: Package management for distribution testing

### Test Environment Requirements
- **Build Artifacts**: Requires `dist/index.js` for server testing
- **Example Scripts**: Language-specific test programs in `examples/` directory
- **Extended Timeouts**: 30-240 seconds for complex operations (compilation, Docker)
- **Resource Management**: Proper cleanup essential for test isolation

This directory serves as the definitive validation layer ensuring the MCP debugger works correctly across all supported scenarios, from development environments to production deployments.
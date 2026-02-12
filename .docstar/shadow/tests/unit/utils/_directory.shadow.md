# tests\unit\utils/
@generated: 2026-02-12T21:00:59Z

## Overview

The `tests/unit/utils` directory contains comprehensive unit test suites for core utility components that provide essential infrastructure services across the MCP debug server system. These utilities handle cross-cutting concerns including file operations, logging, error messaging, environment detection, and containerized deployment scenarios.

## Key Components and Architecture

### Container and Environment Utilities
- **container-path-utils.spec.ts**: Tests container-aware path resolution that adapts behavior based on deployment context (host vs container mode)
- **language-config.test.ts**: Tests environment-based language configuration parsing for debug feature toggles
- **simple-file-checker.spec.ts & .test.ts**: Two comprehensive test suites for file existence validation with path normalization

### System Infrastructure 
- **logger.test.ts**: Tests winston-based logging infrastructure with environment-specific transport configuration and error handling
- **line-reader.spec.ts**: Tests file content reading utility with caching, line context extraction, and binary file detection
- **error-messages.test.ts**: Tests standardized error message generation for timeout scenarios and error extraction utilities

## Testing Patterns and Integration

### Mock Strategy
All test suites employ comprehensive mocking patterns:
- **Filesystem abstraction**: Mock `IFileSystem` interface for isolated file operation testing
- **Environment isolation**: Mock environment variables to test configuration-driven behavior
- **External dependency mocking**: Winston logger, container utilities, and system resources

### Container-Aware Testing
Multiple utilities demonstrate container/host mode duality:
- Path resolution adapts based on `MCP_CONTAINER` environment variable
- Workspace root prefixing in container mode vs absolute path requirements in host mode
- Environment-specific logging destinations and configuration

### Error Handling Patterns
Consistent error handling testing across utilities:
- Graceful degradation when resources unavailable
- Standardized error message formatting
- Timeout scenario handling for async operations
- Input validation with type safety

## Public API Surface

### Primary Entry Points
- **File Operations**: `SimpleFileChecker` class and factory for file existence validation
- **Line Reading**: `LineReader` class for source code line extraction with context
- **Logging**: `createLogger()` and `getLogger()` functions for application logging
- **Error Handling**: `ErrorMessages` class for standardized timeout messages
- **Configuration**: `getDisabledLanguages()` and `isLanguageDisabled()` for feature toggles

### Container Integration
- Path resolution utilities handle deployment context automatically
- Environment-based configuration supports both development and production scenarios
- Workspace root resolution for containerized file access

## Internal Organization

### Test Structure
- Each utility has dedicated comprehensive test coverage
- Consistent use of Vitest framework with beforeEach/afterEach lifecycle management
- Mock isolation ensures test independence and reliability
- Edge case coverage for boundary conditions and error scenarios

### Cross-Component Dependencies
- Container path utilities are shared across file operations
- Logger utilities integrate with error message formatting
- Environment configuration affects multiple utility behaviors
- File system abstraction enables consistent testing across utilities

## Critical Infrastructure Role

These utilities form the foundation layer for the MCP debug server, providing:
- **Deployment flexibility** through container-aware path handling
- **Robust file operations** with caching and error recovery
- **Standardized logging** with environment-appropriate configuration
- **Consistent error messaging** across debug operations
- **Configuration management** for feature toggles and environment adaptation

The comprehensive test coverage ensures reliable operation across different deployment scenarios and provides confidence in the infrastructure layer that supports higher-level debug functionality.
# src/cli/error-handlers.ts
@source-hash: c90bdd6371d3cd4f
@generated: 2026-02-10T00:41:43Z

## Primary Purpose
Global error handling setup for CLI applications. Provides centralized configuration of Node.js process-level error handlers with structured logging and graceful shutdown capabilities.

## Key Components

**ErrorHandlerDependencies Interface (L3-6)**
- Defines dependency injection contract for error handler setup
- `logger`: Winston logger instance for structured error logging
- `exitProcess`: Optional process exit function (defaults to `process.exit`)

**setupErrorHandlers Function (L8-25)**
- Main setup function that registers global Node.js error handlers
- Takes dependencies via injection pattern for testability
- Configures two critical process event handlers:
  - `uncaughtException` handler (L11-18): Logs synchronous errors with origin context and structured error details
  - `unhandledRejection` handler (L20-24): Logs async promise rejections with reason and promise context
- Both handlers terminate the process with exit code 1 after logging

## Key Dependencies
- Winston logger for structured error output
- Node.js process events API
- Dependency injection pattern for testable process exit handling

## Architectural Patterns
- **Dependency Injection**: Accepts logger and exit function as parameters for testing
- **Centralized Error Handling**: Single point of configuration for all unhandled errors
- **Structured Logging**: Consistent error format with metadata fields
- **Fail-Fast**: Immediate process termination on unhandled errors

## Critical Behavior
- All unhandled errors result in process termination (exit code 1)
- Error details are logged before termination
- Default process.exit behavior can be overridden for testing scenarios
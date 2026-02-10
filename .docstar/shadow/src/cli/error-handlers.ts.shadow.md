# src/cli/error-handlers.ts
@source-hash: c90bdd6371d3cd4f
@generated: 2026-02-09T18:14:57Z

**Purpose:** Global error handling setup for CLI applications, providing centralized handling of uncaught exceptions and unhandled promise rejections.

**Core Components:**

- `ErrorHandlerDependencies` interface (L3-6): Defines required dependencies with Winston logger and optional process exit function (defaults to `process.exit`)
- `setupErrorHandlers()` function (L8-25): Main setup function that registers global error event handlers

**Key Functionality:**

- **Uncaught Exception Handler** (L11-18): Captures synchronous errors that bubble up to the process level, logs structured error details (name, message, stack), and exits with code 1
- **Unhandled Rejection Handler** (L20-24): Captures unhandled promise rejections, logs both the rejection reason and the promise object, and exits with code 1

**Dependencies:**
- Winston logger for structured error logging
- Node.js process events (`uncaughtException`, `unhandledRejection`)

**Architectural Patterns:**
- Dependency injection pattern for testability (injectable `exitProcess` function)
- Structured logging with error metadata extraction
- Fail-fast approach - both error types result in immediate process termination
- Defensive logging strategy with separate log entries for rejection details

**Usage Context:** Typically called once during CLI application startup to establish global error safety nets and ensure errors are logged before process termination.
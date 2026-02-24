# src\cli\error-handlers.ts
@source-hash: a33fbbcfbf8f3a43
@generated: 2026-02-24T18:26:31Z

Configures global Node.js error handlers for CLI applications with structured logging and graceful exit handling.

## Core Components

**ErrorHandlerDependencies interface (L3-6)**: Dependency injection contract requiring Winston logger and optional custom exit function (defaults to `process.exit`)

**setupErrorHandlers function (L8-26)**: Main setup function that registers two global process event handlers:
- `uncaughtException` handler (L11-18): Logs error details with structured metadata (name, message, stack) and exits with code 1
- `unhandledRejection` handler (L20-25): Logs promise rejection details but deliberately does NOT exit process to avoid killing long-running servers

## Architecture Patterns

- **Dependency injection**: Accepts logger and exit function as parameters for testability
- **Structured logging**: Uses Winston logger with metadata objects rather than string interpolation
- **Graceful degradation**: Different handling strategies for fatal vs non-fatal errors
- **Server-aware design**: Comments indicate this is optimized for long-running server processes (SSE mode mentioned)

## Key Invariants

- Uncaught exceptions always trigger process exit (fatal errors)
- Unhandled rejections are logged but don't kill the process (non-fatal in server context)
- All error logging includes structured metadata for observability
# tests\unit\cli\error-handlers.test.ts
@source-hash: 18fa95f287f2cedf
@generated: 2026-02-24T18:26:33Z

## Purpose

Unit test suite for the CLI error handlers module that validates global error handling behavior and logging.

## Test Structure

The test suite (L5-125) covers error handler setup and behavior validation for CLI applications:

**Test Setup (L11-42):**
- Creates mock Winston logger with standard methods (L13-19)
- Mocks process exit function to prevent actual termination (L22)
- Intercepts process event listeners via custom `process.on` mock (L29-35)
- Maintains listener map for handler verification (L26, L32-33)

**Core Test Cases:**

1. **Handler Registration (L44-54):** Verifies that `setupErrorHandlers` properly registers listeners for `uncaughtException` and `unhandledRejection` events

2. **Uncaught Exception Handling (L56-81):** Tests that uncaught exceptions are logged with structured error details and cause process exit with code 1

3. **Unhandled Rejection Handling (L83-104):** Validates that promise rejections are logged but do NOT terminate the process (critical for long-running servers)

4. **Default Exit Behavior (L106-124):** Confirms fallback to `process.exit` when no custom exit function is provided

## Key Testing Patterns

- **Process Event Mocking:** Custom `process.on` implementation captures registered handlers without affecting global process state
- **Handler Isolation:** Each test retrieves specific handlers from the listener map to test behavior independently
- **Exit Prevention:** Uses mock functions to prevent actual process termination during tests
- **Structured Assertion:** Validates both logging format and exit behavior patterns

## Dependencies

- **vitest:** Test framework and mocking utilities
- **winston:** Logger type definitions for mock creation
- **setupErrorHandlers:** Target function from CLI error handling module

## Critical Behaviors Tested

- Proper event listener registration on process object
- Structured error logging with name/message/stack extraction
- Differential handling: exceptions exit, rejections don't
- Fallback to native `process.exit` when no custom exit provided
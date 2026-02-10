# tests/unit/proxy/proxy-manager.branch-coverage.test.ts
@source-hash: 832af11d970ac1fc
@generated: 2026-02-10T00:41:36Z

## Purpose
Branch coverage test file for ProxyManager class, specifically testing edge cases and less common execution paths to achieve comprehensive test coverage. Focuses on command processing, status handling, DAP event management, and launch barrier lifecycle.

## Key Test Components

**StubProxyProcess (L16-30)**: Mock implementation of IProxyProcess interface with stubbed methods for testing proxy process interactions without actual process spawning.

**Test Setup (L39-61)**: Configures mock logger, file system, launcher, and ProxyManager instance with manually injected state for testing isolated behaviors.

## Core Test Categories

**Command Processing Tests (L67-96)**:
- Tests execution of `killProcess` commands from functional core (L67-80)
- Tests routing of `sendToProxy` commands back through sendCommand (L82-96)

**Error Handling Tests (L98-108)**: Tests graceful handling when DAP state is missing during message processing.

**Status Message Handling (L110-149)**:
- Tests proxy termination on `proxy_minimal_ran_ipc_test` status (L110-118)
- Tests initialization marking on `adapter_connected` status (L120-133)
- Tests preservation of dry-run snapshot when status data is empty/whitespace (L135-149)

**DAP Event Processing (L151-224)**:
- Tests handling of stopped events without thread information (L151-169)
- Tests thread ID capture and reason forwarding from stopped events (L171-201)
- Tests emission of continued and generic dap events (L203-224)

**Launch Barrier Management (L226-366)**:
- Tests barrier resolution when DAP response arrives (L226-279)
- Tests barrier disposal when sendCommand throws (L281-313)
- Tests early exit for mismatched barrier references (L315-345)
- Tests error handling during barrier disposal (L347-366)

## Testing Patterns

**Type Casting Pattern**: Extensively uses `(manager as unknown as { property: Type })` to access private members for state manipulation and verification.

**Mock Injection**: Manually injects mock objects into private properties to control test state and verify internal behavior.

**Event Testing**: Uses event listeners to verify proper event emission and data propagation.

## Dependencies
- Vitest testing framework with mocking capabilities
- ProxyManager from proxy subsystem
- DAP core functions and state management
- Shared interfaces from @debugmcp/shared package
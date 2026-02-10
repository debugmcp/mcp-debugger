# src/utils/error-messages.ts
@source-hash: 0485a35f63108ad2
@generated: 2026-02-09T18:15:02Z

## Purpose
Centralized error message factory for timeout-related errors in a debug server. Provides consistent, user-friendly error messages with contextual information across different debug operations.

## Key Components

### ErrorMessages Object (L6-55)
Exported constant containing factory functions for timeout error messages:

- **dapRequestTimeout** (L15-18): Creates error messages for Debug Adapter Protocol request timeouts
  - Parameters: command name and timeout duration
  - Default timeout: 35 seconds
  - Usage: `src/proxy/proxy-manager.ts`
  
- **proxyInitTimeout** (L27-30): Creates error messages for debug proxy initialization failures
  - Parameters: timeout duration
  - Default timeout: 30 seconds
  - Usage: `src/proxy/proxy-manager.ts`
  
- **stepTimeout** (L39-42): Creates error messages for step operation timeouts (stepOver, stepInto, stepOut)
  - Parameters: timeout duration
  - Default timeout: 5 seconds
  - Usage: `src/session/session-manager.ts`
  
- **adapterReadyTimeout** (L51-54): Creates error messages for adapter configuration timeouts
  - Parameters: timeout duration
  - Default timeout: 30 seconds
  - Usage: `src/session/session-manager.ts` (logged as warning)

## Architecture Pattern
- Factory function pattern for parameterized error messages
- Centralized message management for consistency between implementation and tests
- Each message includes diagnostic information and user guidance

## Dependencies
- Pure TypeScript utility module with no external dependencies
- Consumed by proxy-manager.ts and session-manager.ts

## Key Features
- Template literal interpolation for dynamic values
- Comprehensive error context and troubleshooting guidance
- Consistent message structure across all timeout scenarios
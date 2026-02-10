# src/utils/error-messages.ts
@source-hash: 0485a35f63108ad2
@generated: 2026-02-10T00:41:51Z

**Primary Purpose**
Centralized error message factory for timeout-related errors in the debug server. Provides consistent, descriptive error messages with contextual information to help diagnose timeout issues across different debug operations.

**Key Components**

**ErrorMessages Object (L6-55)**
Export object containing factory functions for timeout error messages:

- `dapRequestTimeout` (L15-18): Factory for Debug Adapter Protocol request timeouts
  - Parameters: `command` (string), `timeout` (number)
  - Usage: DAP requests that don't receive responses within timeout period
  - Default timeout: 35 seconds
  - Used in: `src/proxy/proxy-manager.ts`

- `proxyInitTimeout` (L27-30): Factory for debug proxy initialization timeouts
  - Parameters: `timeout` (number)
  - Usage: When debug proxy process fails to initialize
  - Default timeout: 30 seconds
  - Used in: `src/proxy/proxy-manager.ts`

- `stepTimeout` (L39-42): Factory for step operation timeouts
  - Parameters: `timeout` (number)
  - Usage: When step operations (stepOver, stepInto, stepOut) don't complete
  - Default timeout: 5 seconds
  - Used in: `src/session/session-manager.ts`

- `adapterReadyTimeout` (L51-54): Factory for adapter ready timeouts
  - Parameters: `timeout` (number)
  - Usage: When waiting for debug adapter configuration times out
  - Default timeout: 30 seconds
  - Used in: `src/session/session-manager.ts` (as warning)

**Architectural Patterns**
- Factory pattern: Each property returns a function that generates contextual error messages
- Centralized message management: Single source of truth for timeout errors
- Parameterized messages: Dynamic insertion of command names and timeout values
- Diagnostic guidance: Each message includes troubleshooting suggestions

**Dependencies**
- No external dependencies
- Pure TypeScript utility module
- Consumed by proxy and session management modules

**Key Design Decisions**
- Messages include diagnostic context and recovery suggestions
- Timeout values are parameterized for flexibility
- Comprehensive JSDoc documentation with usage locations
- Consistent message structure across all timeout scenarios
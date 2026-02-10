# tests/unit/proxy/proxy-manager-message-handling.test.ts
@source-hash: f20991d7dc282288
@generated: 2026-02-10T01:19:07Z

**Primary Purpose**: Comprehensive unit test suite for ProxyManager message handling, event propagation, cleanup scenarios, and edge cases in debug adapter communication.

**Test Framework**: Uses Vitest with TestProxyManager utility class to simplify async initialization and avoid complex proxy process management.

**Main Test Classes/Utilities**:
- `TestProxyManager` (L13): Simplified proxy manager for testing that avoids real process spawning
- `ProxyConfig` (L14): Configuration object for proxy sessions
- Mock factories for logger and filesystem (L16)

**Test Structure**:

**Setup & Teardown (L25-56)**:
- `beforeEach`: Creates mock logger, config, and TestProxyManager instance, starts proxy
- `afterEach`: Stops proxy if running and clears mocks
- Uses session ID 'test-session' and Python debug language as defaults

**Core Test Suites**:

1. **Message Handling (L58-264)**:
   - Status messages: adapter configured (L59-75), dry-run complete (L77-101)
   - DAP events: stopped (L103-116), continued (L118-128), terminated (L130-145), exited (L147-169)
   - DAP responses: setBreakpoints success (L171-196)
   - Error handling: error messages (L198-217), invalid formats (L219-239), wrong session ID (L247-263)

2. **Proxy Process Exit Handling (L266-325)**:
   - Clean exit (L267-277), exit with error code (L279-292), exit with signal (L294-307)
   - Error event propagation (L309-324)

3. **Cleanup Scenarios (L327-378)**:
   - Pending request cleanup on exit (L328-339)
   - Multiple concurrent requests (L341-356)
   - Timeout clearing during cleanup (L363-368)
   - Stop after already exited (L370-377)

4. **DAP Request Edge Cases (L380-433)**:
   - Requests when proxy not running (L381-389)
   - Concurrent requests with same command (L391-406)
   - Failed DAP responses (L415-432)

5. **State Management (L435-463)**:
   - Thread ID tracking from stopped/continued events (L436-449)
   - Dry-run mode state changes (L451-462)

6. **Resilience Scenarios (L465-825)**:
   - Invalid message logging (L470-481)
   - Request timeouts using real ProxyManager with fake timers (L483-510)
   - Missing bootstrap script error (L512-543)
   - Transport errors during command sending (L545-574)
   - Adapter validation failures (L576-609)
   - JavaScript adapter launch barrier handling (L611-824)

7. **Status & Lifecycle (L827-907)**:
   - Initialized event on adapter connection (L828-851)
   - Exit event on adapter termination (L853-878)
   - Pending request rejection on proxy exit (L880-906)

8. **IPC Smoke Test (L910-933)**:
   - Process termination on minimal proxy test status (L911-932)

**Key Testing Patterns**:
- Uses `simulateMessage()` and `simulateStoppedEvent()` methods for event injection
- Validates event emission with boolean flags and captured parameters
- Tests both successful and error scenarios
- Covers concurrent operations and cleanup edge cases
- Uses fake timers for timeout testing in resilience scenarios

**Mock Strategy**: 
- TestProxyManager for simplified proxy operations
- Real ProxyManager for complex resilience testing
- Fake timers for timeout simulation
- Mock process objects for event testing
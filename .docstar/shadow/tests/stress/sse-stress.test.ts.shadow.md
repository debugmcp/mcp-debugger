# tests/stress/sse-stress.test.ts
@source-hash: 45f4c63135c21859
@generated: 2026-02-10T00:41:59Z

**File Purpose**: SSE transport stress testing suite that validates SSE (Server-Sent Events) transport reliability under extreme conditions including rapid connections, burst load, long-running sessions, and server failure recovery.

**Test Control**: Stress tests are conditionally executed based on `RUN_STRESS_TESTS` environment variable (L19-20), using `describeStress` wrapper that skips tests if not enabled.

**Core Classes**:

**SSEStressTester (L34-182)**: Main orchestration class for stress testing scenarios
- **Server Management**: `startServer()` (L46-85) spawns Node.js SSE server process, `stopServer()` (L87-96) handles graceful/forceful termination
- **Client Management**: `connectClient()` (L98-122) creates MCP clients with SSE transport, tracks connection metrics; `disconnectClient()` (L124-134) handles cleanup
- **Metrics Collection**: Tracks connection success/failure rates, timing, memory usage, and errors via `TestMetrics` interface (L25-32)
- **Utilities**: Port availability checking (L159-177), sleep helper (L179-181)

**Test Scenarios (L184-365)**:

1. **Rapid Connect/Disconnect (L198-255)**: 20 cycles of 3 simultaneous connections each, validates 90% success rate and <50MB memory growth
2. **Burst Connections (L257-281)**: 10 simultaneous connection attempts, expects 80% success rate under load
3. **Long-Running Stability (L283-327)**: 15-second sustained connection with periodic tool calls, monitors memory leaks and operation success
4. **Server Recovery (L329-364)**: Tests graceful handling of server restarts and client reconnection

**Key Dependencies**:
- `@modelcontextprotocol/sdk/client/*` for MCP client and SSE transport
- `child_process.spawn` for server process management
- `net` module for port availability checking

**Configuration**:
- `TEST_TIMEOUT`: 120 seconds for all stress tests
- `BASE_PORT`: 4000 + random offset for test isolation
- Server launched with error-level logging to minimize noise during stress testing

**Architecture**: Uses promise-based async patterns throughout, with comprehensive error handling and metrics collection. Server process is spawned as separate Node.js instance running the main application in SSE mode.
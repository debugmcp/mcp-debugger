# tests/stress/sse-stress.test.ts
@source-hash: 45f4c63135c21859
@generated: 2026-02-09T18:15:17Z

## Purpose
Comprehensive stress testing suite for SSE (Server-Sent Events) transport implementation in MCP SDK. Tests transport reliability under extreme conditions including rapid connection cycles, concurrent sessions, long-running connections, and resource leak detection.

## Key Components

### Environment Control
- **Test Toggle** (L19-20): Uses `RUN_STRESS_TESTS` env var to conditionally run stress tests via `describeStress`
- **Configuration** (L22-23): 2-minute timeout and dynamic port allocation starting from port 4000

### Core Classes

#### TestMetrics Interface (L25-32)
Tracks comprehensive connection statistics:
- Connection attempt/success/failure counts
- Average connection time
- Memory usage samples
- Error collection

#### SSEStressTester Class (L34-182)
Main orchestration class managing server processes and client connections:

**Server Management** (L46-96):
- `startServer()`: Spawns Node.js server process with SSE transport, includes port availability polling
- `stopServer()`: Graceful SIGTERM followed by SIGKILL if needed

**Client Management** (L98-142):
- `connectClient()`: Creates MCP client with SSE transport, tracks timing metrics
- `disconnectClient()`: Handles individual client cleanup with error tolerance  
- `disconnectAllClients()`: Batch disconnection with Promise.all

**Utilities** (L144-181):
- Memory usage monitoring via `process.memoryUsage()`
- Port availability checking using net sockets
- Metrics calculation including rolling average for connection times

### Test Scenarios (L184-365)

#### Rapid Connect/Disconnect Test (L198-255)
- 20 cycles × 3 simultaneous connections per cycle
- Memory sampling every 10 cycles
- Validates 90% success rate and <50MB memory growth
- <1s average connection time requirement

#### Burst Connection Test (L257-281)
- 10 simultaneous connection attempts
- Tests concurrent connection handling
- Requires 80% success rate under load

#### Long-Running Connection Test (L283-327)
- 15-second sustained connection with periodic operations
- Calls `list_debug_sessions` tool every second
- Monitors memory growth (<20MB) and operation success (>12/15)

#### Server Recovery Test (L329-364)
- Simulates server crash and restart
- Validates connection failure detection and recovery
- Tests new connection establishment post-restart

## Architecture Patterns

### Resource Management
- Proper cleanup in `afterEach` hooks (L193-196)
- Error-tolerant disconnection with fallback handling
- Memory leak detection through heap usage monitoring

### Reliability Testing
- Promise.allSettled for handling partial failures in concurrent operations
- Timeout-based server startup validation
- Graceful degradation with error collection rather than test abortion

## Dependencies
- **MCP SDK**: Client and SSE transport classes
- **Node.js**: Child process spawning, networking, path utilities
- **Vitest**: Test framework with conditional execution support

## Critical Constraints
- Tests only run when `RUN_STRESS_TESTS=true` to prevent CI/CD impact
- Dynamic port allocation prevents conflicts in parallel test execution
- 2-minute timeout accommodates slower CI environments
- Memory growth thresholds prevent resource exhaustion detection
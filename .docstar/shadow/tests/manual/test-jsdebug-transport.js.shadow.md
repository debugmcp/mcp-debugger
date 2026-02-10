# tests/manual/test-jsdebug-transport.js
@source-hash: 73ef4d24652694c4
@generated: 2026-02-09T18:15:14Z

## Manual Test Script for JS-Debug Adapter Transport Modes

This is a diagnostic script that tests TCP transport modes for the js-debug adapter to identify IPv4/IPv6 compatibility issues. It systematically tests different connection approaches and provides recommendations for fixing transport problems.

### Core Purpose
Tests the vendored js-debug adapter's TCP transport capabilities by spawning the adapter process and attempting DAP (Debug Adapter Protocol) connections using different host configurations.

### Key Functions

**`sendDapMessage(stream, message)` (L30-35)**
- Formats and sends DAP messages with proper Content-Length headers
- Encodes JSON messages as DAP protocol requires

**`createInitializeRequest()` (L38-56)**
- Creates a standard DAP initialize request with test client configuration
- Uses 'pwa-node' adapter ID for Node.js debugging

**`testTcpMode()` (L59-179)**
- Tests TCP connection using IPv6 localhost (::1) on port 45635
- Spawns adapter with single port argument: `node adapter.cjs 45635`
- Monitors adapter stdout/stderr and attempts TCP connection
- Parses DAP responses and cleans up after 3 seconds

**`testStdioMode()` (L182-302)**
- Misleadingly named - actually tests TCP with explicit IPv4 host argument
- Uses IPv4 localhost (127.0.0.1) on port 45636  
- Spawns adapter with host+port: `node adapter.cjs 127.0.0.1 45636`
- Same connection logic as testTcpMode but with different host resolution

**`runTests()` (L305-349)**
- Orchestrates both test runs and analyzes results
- Provides diagnostic recommendations based on which transport mode succeeds
- Identifies IPv4/IPv6 mismatch issues between adapter binding and client connection

### Dependencies
- `child_process.spawn` for adapter process management
- `net.createConnection` for TCP client connections
- Path resolution to locate vendored adapter at `../../packages/adapter-javascript/vendor/js-debug/vsDebugServer.cjs`

### Architecture Notes
- Uses promise-based async testing with setTimeout-based coordination
- Implements basic DAP protocol parsing with Content-Length header handling
- Includes process cleanup with SIGTERM/SIGKILL fallback
- Fixed ports (45635, 45636) for reproducible testing

### Key Insights
The script diagnoses a common IPv6/IPv4 binding issue where the js-debug adapter may bind to IPv6 (::1) by default, causing connection failures when clients attempt IPv4 (127.0.0.1) connections. It provides specific remediation strategies for the parent debugging system.
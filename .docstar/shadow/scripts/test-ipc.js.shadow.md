# scripts/test-ipc.js
@source-hash: 0aacfd28ee6ca516
@generated: 2026-02-09T18:15:13Z

**Purpose**: Standalone test script to verify Inter-Process Communication (IPC) functionality between parent process and proxy-bootstrap child process.

**Core Functionality**:
- **Child Process Spawn** (L11-16): Spawns proxy-bootstrap.js as child with IPC stdio channel enabled
- **Test Message Send** (L24-39): Sends initialization command after 1-second delay to allow proxy startup
- **Event Handlers** (L18-56): Comprehensive logging of spawn, message, stdout, stderr, and exit events
- **Auto-termination** (L59-62): Kills child process after 10 seconds for testing cleanup

**Key Components**:
- **Test Message Structure** (L26-34): Predefined `init` command with session configuration (sessionId, executablePath, adapter details, paths)
- **Process Communication**: Bidirectional IPC setup with parent sending commands and listening for child responses
- **Diagnostic Logging**: Extensive console output with prefixed labels for debugging IPC flow

**Dependencies**:
- Node.js built-in modules: `child_process.spawn`, `path`, `url.fileURLToPath`
- Target: `../dist/proxy/proxy-bootstrap.js` (compiled proxy entry point)

**Architecture Pattern**: 
- Simple test harness pattern with event-driven child process management
- Timeout-based sequencing for async process coordination
- Comprehensive error/output capture for debugging

**Critical Constraints**:
- Hardcoded 1-second startup delay assumes proxy initialization time
- 10-second total test duration with forced termination
- Requires pre-built dist/proxy/proxy-bootstrap.js target
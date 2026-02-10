# src/proxy/dap-proxy-worker.ts
@source-hash: dfe66a3859588d01
@generated: 2026-02-09T18:15:16Z

## DapProxyWorker Core Implementation

This file implements the main worker class for a Debug Adapter Protocol (DAP) proxy system that routes debugging commands between parent processes and debug adapters using the Adapter Policy pattern to eliminate language-specific hardcoding.

### Key Classes and Functions

**DapProxyWorker (L54-852)** - Main worker class that manages the entire debugging session lifecycle:
- Handles initialization, DAP command forwarding, and termination
- Uses adapter policies to determine language-specific behavior
- Manages command queuing for adapters that require sequential processing
- Maintains state through ProxyState enum transitions

**DapProxyWorkerHooks (L40-52)** - Configuration interface providing:
- Custom exit handler for fatal errors (L45)
- Trace file factory for DAP frame logging (L51)

### Core Dependencies and Architecture

**External Dependencies:**
- Uses `@vscode/debugprotocol` for DAP types (L8)
- Imports adapter policies from `@debugmcp/shared` package (L30-38)
- Leverages several internal managers for specialized concerns (L22-24)

**Key Managers:**
- `CallbackRequestTracker` (L65) - Tracks DAP request timeouts
- `GenericAdapterManager` (L66) - Handles adapter process lifecycle
- `DapConnectionManager` (L67) - Manages DAP client connections

### State Management and Policy Pattern

**Adapter Policy System (L70-71, L102-123):**
- `selectAdapterPolicy()` (L102) chooses appropriate policy based on adapter command
- Supports JS Debug, Python, Java, Rust, and Mock adapters
- Falls back to DefaultAdapterPolicy for unknown adapters

**State Tracking:**
- `ProxyState` enum controls worker lifecycle (L60)
- `adapterState` (L71) stores adapter-specific state managed by policies
- Command queues for pre-connection (L73) and policy-based queuing (L72)

### Critical Command Handling

**Initialization Flow (L176-254):**
- Validates payload structure and selects adapter policy
- Creates logger, process manager, and connection manager
- Handles dry-run mode with Windows IPC flushing (L260-299)
- Spawns adapter process and establishes DAP connection

**DAP Command Processing (L532-640):**
- Implements policy-based command queuing decisions (L547)
- Handles pre-connection command queueing
- Tracks requests for timeout handling
- Updates adapter state based on commands and responses

**Event Handling (L414-476):**
- Sets up comprehensive DAP event forwarding
- Special handling for "initialized" event with deferred processing
- Manages adapter-specific initialization sequences

### Queue Management and Flow Control

**Command Queue Draining (L645-700):**
- Processes queued commands in policy-determined order
- Supports silent commands that don't send responses
- Handles errors gracefully with proper cleanup

**Pre-Connect Queue (L738-746):**
- Buffers commands received during initialization
- Drains after connection establishment

### Notable Patterns and Constraints

**Windows IPC Handling (L287-298):**
- Uses `setImmediate` and `setTimeout` for proper message flushing
- Critical for preventing message loss on process exit

**Initialization Sequencing:**
- Supports both launch and attach modes with different event timing
- Handles adapter-specific "initialized" event timing requirements
- Manages breakpoint setting during initialization

**Error Handling and Cleanup:**
- Comprehensive shutdown sequence (L775-806) with proper resource cleanup
- Request timeout handling with automatic response generation
- Graceful handling of adapter process exits

### Message Protocol

The worker communicates via structured messages:
- **StatusMessage** - Worker state updates
- **DapResponseMessage** - DAP command responses  
- **DapEventMessage** - DAP event forwarding
- **ErrorMessage** - Error notifications

All messages include session identification for multi-session support.
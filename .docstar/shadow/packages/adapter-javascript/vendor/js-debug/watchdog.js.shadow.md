# packages/adapter-javascript/vendor/js-debug/watchdog.js
@source-hash: 8ecf77fc534e2cda
@generated: 2026-02-09T18:14:11Z

# packages/adapter-javascript/vendor/js-debug/watchdog.js

## Primary Purpose
**Watchdog process for JavaScript debugging** - A Node.js inspector proxy/watchdog that manages communication between debugger clients and Node.js debugging targets. Acts as an intermediary that handles target lifecycle and message routing.

## Key Architecture Components

### Main Execution Context (L19-L26)
- **JSON Configuration**: Parses `NODE_INSPECTOR_INFO` environment variable containing inspector connection details
- **Process Lifecycle**: Sets up exit handlers and automatic cleanup when parent process dies
- **Target Management**: Creates and manages debugging target connection

### Target Class (L19)
Core debugging target management class that:
- **Connection Proxy**: Routes CDP (Chrome DevTools Protocol) messages between client and Node.js inspector
- **Target Info Management**: Maintains target metadata (ID, PID, URL, type)
- **Lifecycle Control**: Handles attach/detach operations and graceful shutdown

### Message Routing System
- **Bidirectional Proxy**: Forwards CDP messages between debugger frontend and Node.js process
- **Target Events**: Emits `Target.targetCreated` and `Target.targetDestroyed` events
- **WebSocket Communication**: Uses WebSocket connections for real-time message exchange

## Key Dependencies and Utilities

### Logging and Error Handling (L2-L5)
- **Logger**: Structured logging system with multiple severity levels
- **Error Handling**: Comprehensive error catching with stack trace preservation
- **Telemetry**: Built-in metrics and reporting system

### Network and IPC Communication (L6-L10)
- **WebSocket Client**: Custom WebSocket implementation for inspector protocol
- **Stream Processing**: Message framing and protocol handling
- **Connection Management**: Automatic reconnection and error recovery

### Source Map Processing (L11-L15)
- **VLQ Decoding**: Variable-length quantity decoding for source map data
- **Position Mapping**: Bidirectional mapping between original and generated code positions
- **Source Resolution**: URL resolution and path normalization utilities

## Notable Implementation Details

### Process Management
- **Graceful Shutdown**: Coordinates cleanup between watchdog and target processes
- **Parent Process Monitoring**: Automatically exits if parent process terminates
- **Signal Handling**: Proper handling of SIGINT, SIGTERM, and other process signals

### Protocol Handling
- **CDP Compliance**: Full Chrome DevTools Protocol message routing
- **Dynamic Attachment**: Supports both static and dynamic debugger attachment
- **Session Management**: Handles multiple debugging sessions and target switching

### Error Recovery
- **Connection Retry**: Automatic reconnection on network failures
- **Timeout Handling**: Configurable timeouts for various operations
- **Resource Cleanup**: Proper disposal of connections and event listeners

## Integration Points
- **VS Code Extension**: Primary consumer of this watchdog for Node.js debugging
- **Node.js Inspector**: Direct integration with Node's built-in debugging capabilities
- **Chrome DevTools**: Compatible with standard Chrome debugging frontend
# packages/adapter-javascript/vendor/js-debug/
@generated: 2026-02-09T18:16:38Z

## Overall Purpose and Responsibility

This directory contains the **JavaScript debugging infrastructure** for VS Code's JavaScript debug adapter. It provides a complete debugging runtime system that enables VS Code to attach to and debug Node.js processes through a combination of process injection, protocol communication, and code analysis capabilities.

## Key Components and Integration

### Debugging Bootstrap Layer
- **bootloader.js**: Auto-injection bootloader that gets embedded into Node.js processes to establish debugging connections. Handles environment variable parsing, auto-attachment validation, WebSocket communication via Chrome DevTools Protocol, and cross-process coordination.
- **watchdog.js**: Inspector proxy process that acts as an intermediary between VS Code and Node.js debugging targets. Manages CDP message routing, target lifecycle, and graceful process coordination.

### Performance and Security Layer  
- **hash.js**: High-performance content verification system using WebAssembly-accelerated hashing. Provides both chromehash and SHA256 implementations with encoding normalization, streaming file processing, and multi-threaded computation for integrity checking of debugged code.

### Code Analysis Layer
- **vendor/**: Vendored Acorn JavaScript parser ecosystem providing both strict and lenient parsing capabilities. Enables AST-based code inspection and handles malformed code during active debugging sessions.

## Public API Surface

### Debug Attachment Entry Points
- **Auto-attachment mechanism**: Environment-driven debugging activation via `VSCODE_INSPECTOR_OPTIONS` and `NODE_OPTIONS`
- **Inspector proxy interface**: CDP-compliant message routing between debugger clients and Node.js targets
- **Process lifecycle management**: Graceful attachment/detachment with cleanup coordination

### Code Analysis Interface
- **Content verification**: File and buffer hashing with encoding detection and normalization
- **JavaScript parsing**: Strict and fault-tolerant AST generation for syntax analysis
- **Source integrity**: Hash-based verification of executed code for debugging accuracy

### WebSocket Communication
- **CDP protocol handling**: Full Chrome DevTools Protocol message routing with compression support
- **Connection management**: Auto-reconnection, timeout handling, and error recovery
- **Multi-session support**: Concurrent debugging session coordination

## Internal Organization and Data Flow

### Process Architecture
1. **Injection Phase**: bootloader.js gets injected into target Node.js processes
2. **Validation Phase**: Environment and context validation determines attachment eligibility  
3. **Proxy Phase**: watchdog.js spawned as intermediary process for protocol communication
4. **Communication Phase**: WebSocket-based CDP message routing between VS Code and target

### Data Flow Patterns
- **Environment → Bootloader**: Configuration flows from environment variables to injection logic
- **Bootloader → Watchdog**: Process spawning and IPC setup for debugging coordination  
- **Watchdog ↔ VS Code**: Bidirectional CDP message proxy with target lifecycle management
- **Hash verification**: Content integrity checking throughout the debugging pipeline

### Security Model
- **Lease file validation**: Secure process attachment through file-based authorization
- **Protocol security**: WebSocket frame validation and masking for network security
- **Process isolation**: Spawned watchdog processes provide security boundaries
- **Content verification**: Hash-based integrity checking prevents code tampering

## Important Patterns and Conventions

### Memory Management
- **WebAssembly lifecycle**: Explicit `.free()` calls for WASM hash instances with FinalizationRegistry cleanup
- **Resource disposal**: Proper cleanup of WebSocket connections, file handles, and event listeners
- **Process coordination**: Graceful shutdown sequences between parent/child processes

### Error Recovery
- **Fault tolerance**: Lenient parser continues operation despite syntax errors in debugged code  
- **Connection resilience**: Automatic reconnection and retry logic for network failures
- **Graceful degradation**: Fallback mechanisms when debugging features unavailable

### Performance Optimization
- **Streaming operations**: Large file processing in configurable chunks to prevent memory exhaustion
- **Multi-threading**: Worker thread utilization for parallel hash computation
- **Bundled distribution**: Minified code reduces injection overhead and startup time

## Role in Debug Adapter Architecture

This directory serves as the **runtime debugging engine** that bridges VS Code's debug client with Node.js processes. It handles the complete debugging lifecycle from initial process injection through protocol communication to graceful shutdown, while providing essential services like code integrity verification and syntax analysis for robust debugging experiences.
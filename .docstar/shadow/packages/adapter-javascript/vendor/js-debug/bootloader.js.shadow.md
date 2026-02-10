# packages/adapter-javascript/vendor/js-debug/bootloader.js
@source-hash: 89acd4ebd4caff15
@generated: 2026-02-09T18:14:08Z

## Core Purpose
This file is a bundled bootloader for VS Code's JavaScript debugger that auto-attaches to Node.js processes. It's minified/bundled code that gets injected into Node.js runtime environments to enable debugging capabilities.

## Primary Functionality 
The bootloader establishes a debugging connection between VS Code and Node.js processes by:
- Reading inspector options from environment variables (L8-9)
- Validating conditions for auto-attachment (L1-35)  
- Opening Node.js inspector and connecting to VS Code's debug adapter (L1-35)
- Managing WebSocket connections for the Chrome DevTools Protocol (L1-35)

## Key Components

### Environment Configuration (L8-9)
- `_t` class manages `VSCODE_INSPECTOR_OPTIONS` and `NODE_OPTIONS` environment variables
- Parses JSON-encoded inspector configuration from process environment
- Handles option serialization/deserialization with `:::` separator

### Auto-Attachment Logic (L1-35)  
- Multiple validation functions check if debugging should be enabled
- Validates IPC server availability, lease files, execution context
- Pattern matching against script names using `waitForDebugger` regex
- Special handling for npm, electron, and other tool contexts

### WebSocket Infrastructure (L1-35)
- Complete WebSocket client/server implementation for CDP communication
- Handles permessage-deflate compression extension
- Frame parsing, masking, and protocol compliance
- Event-driven architecture with proper error handling

### Process Management (L1-35)
- Spawns watchdog processes for debugging coordination  
- Manages inspector URLs and port allocation
- Handles deferred vs immediate attachment modes
- Cross-process communication via named pipes/sockets

## Architecture Patterns
- Heavy use of Symbol properties for private state management
- Event emitter pattern for asynchronous operations
- Factory pattern for creating debugging components
- State machine approach for WebSocket connection lifecycle

## Critical Dependencies
- Node.js `inspector` module for debugging protocol access
- `child_process` for spawning helper processes
- Native crypto for random ID generation and hashing
- File system operations for temporary files and validation

## Security Considerations
- Validates WebSocket frames and prevents protocol attacks
- Proper masking/unmasking of WebSocket data
- Temporary file cleanup and secure random generation
- Process isolation through spawned watchdog processes

## Notable Invariants
- Only attaches to main thread (not worker threads)
- Requires valid IPC address for communication
- Enforces lease file validation for security
- Maintains backward compatibility with multiple Node.js versions
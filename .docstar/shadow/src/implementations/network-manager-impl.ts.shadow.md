# src/implementations/network-manager-impl.ts
@source-hash: c6db94993b8fa3f7
@generated: 2026-02-09T18:14:59Z

## NetworkManagerImpl

Concrete implementation of the `INetworkManager` interface using Node.js native `net` module for TCP server operations.

### Primary Responsibility
Provides platform-specific network server creation and port allocation functionality for the debugmcp system.

### Key Components

**NetworkManagerImpl class (L7-29)**
- Implements `INetworkManager` interface from `@debugmcp/shared`
- Encapsulates Node.js-specific networking operations

**createServer() method (L8-11)**
- Creates and returns a TCP server instance using `net.createServer()`
- Uses type assertion to bridge Node.js `Server` type to `IServer` interface
- Returns server immediately without configuration

**findFreePort() method (L13-28)**
- Asynchronously discovers available port by creating temporary server
- Binds to port 0 to let OS assign free port automatically (L18)
- Uses `server.unref()` to prevent process hanging (L16)
- Extracts port from server address and performs type guards (L19-21)
- Properly closes temporary server before resolving
- Handles both successful port discovery and error cases

### Dependencies
- `net` - Node.js native networking module
- `@debugmcp/shared` - Shared interfaces (`INetworkManager`, `IServer`)

### Architecture Notes
- Clean adapter pattern implementation bridging Node.js APIs to debugmcp interfaces
- Follows Promise-based async patterns for port discovery
- Uses OS-level port allocation for reliability
- Defensive programming with proper type checking and error handling
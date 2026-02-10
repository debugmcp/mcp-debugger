# src/implementations/network-manager-impl.ts
@source-hash: c6db94993b8fa3f7
@generated: 2026-02-10T00:41:44Z

## NetworkManagerImpl - Node.js Network Abstraction Layer

**Purpose**: Concrete implementation of the `INetworkManager` interface providing Node.js-specific networking capabilities for the debugmcp system.

### Key Components

- **NetworkManagerImpl class (L7-29)**: Main implementation class that wraps Node.js `net` module functionality
  - Implements `INetworkManager` interface from `@debugmcp/shared`
  - Provides server creation and port allocation services

### Methods

- **createServer() (L8-11)**: Factory method returning a Node.js server instance
  - Direct pass-through to `net.createServer()`
  - Uses type assertion to cast to `IServer` interface
  - Returns immediately without configuration

- **findFreePort() (L13-28)**: Async utility for discovering available network ports
  - Creates ephemeral server on port 0 (OS-assigned)
  - Uses `unref()` to prevent process hanging
  - Promise-based with comprehensive error handling
  - Validates address object structure before extracting port
  - Properly closes server after port discovery

### Dependencies

- **Node.js net module**: Core networking functionality
- **@debugmcp/shared**: Interface definitions (`INetworkManager`, `IServer`)

### Architecture Notes

- Clean adapter pattern implementation bridging Node.js APIs to domain interfaces
- Type-safe port discovery with runtime validation
- Proper resource cleanup in async operations
- Error-first callback pattern wrapped in Promise for modern async/await usage
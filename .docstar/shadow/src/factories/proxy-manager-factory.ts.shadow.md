# src/factories/proxy-manager-factory.ts
@source-hash: 146792866202bee7
@generated: 2026-02-10T00:41:46Z

Factory pattern implementation for creating ProxyManager instances, enabling dependency injection and test mocking within a debug MCP (Model Context Protocol) system.

## Purpose
Provides abstracted creation of ProxyManager instances with injected dependencies, supporting both production and testing scenarios through factory interfaces.

## Key Components

**IProxyManagerFactory Interface (L13-15)**
- Single method `create(adapter?: IDebugAdapter): IProxyManager`
- Defines contract for ProxyManager creation with optional debug adapter

**ProxyManagerFactory Class (L20-35)**
- Production implementation requiring three injected dependencies:
  - `proxyProcessLauncher: IProxyProcessLauncher` - handles proxy process lifecycle
  - `fileSystem: IFileSystem` - file operations abstraction  
  - `logger: ILogger` - logging functionality
- `create()` method (L27-34) instantiates ProxyManager with injected dependencies
- Passes `adapter || null` to handle optional debug adapter parameter

**MockProxyManagerFactory Class (L42-58)**
- Test implementation with tracking capabilities
- Properties for test inspection:
  - `createdManagers: IProxyManager[]` - tracks all created instances
  - `lastAdapter?: IDebugAdapter` - records last adapter passed
  - `createFn?: (adapter?: IDebugAdapter) => IProxyManager` - injectable creation function
- `create()` method (L47-57) delegates to `createFn` or throws error if not configured
- Designed to be configured by test code rather than providing default mock behavior

## Dependencies
- `ProxyManager` from `../proxy/proxy-manager.js` - the concrete class being created
- `@debugmcp/shared` interfaces: `IProxyProcessLauncher`, `IFileSystem`, `ILogger`, `IDebugAdapter`

## Architectural Patterns
- Factory pattern for object creation
- Dependency injection through constructor parameters
- Interface segregation with separate factory interface
- Test doubles through mock factory implementation

## Usage Context
Part of a debug MCP system where ProxyManager instances need to be created with varying debug adapter configurations and dependency sets.
# src/factories/proxy-manager-factory.ts
@source-hash: 146792866202bee7
@generated: 2026-02-09T18:15:00Z

**Primary Purpose**: Factory pattern implementation for creating ProxyManager instances, enabling dependency injection and test isolation through interface abstraction.

**Key Components**:
- `IProxyManagerFactory` (L13-15): Factory interface defining `create(adapter?: IDebugAdapter)` method
- `ProxyManagerFactory` (L20-35): Production factory implementation that constructs ProxyManager instances with injected dependencies
- `MockProxyManagerFactory` (L42-58): Test factory with tracking capabilities and customizable creation behavior

**Dependencies**:
- Imports `IProxyManager`, `ProxyManager` from local proxy module (L5)
- Imports shared interfaces: `IProxyProcessLauncher`, `IFileSystem`, `ILogger`, `IDebugAdapter` from `@debugmcp/shared` (L6-8)

**Architecture Patterns**:
- **Factory Pattern**: Abstracts ProxyManager instantiation behind interface
- **Dependency Injection**: ProxyManagerFactory receives dependencies via constructor (L21-25)
- **Adapter Pattern**: Optional IDebugAdapter parameter allows runtime behavior modification

**Key Implementation Details**:
- Production factory (L27-34) passes `adapter || null` to ProxyManager constructor, ensuring explicit null handling
- Mock factory provides test instrumentation:
  - `createdManagers` array tracks all created instances (L43)
  - `createFn` allows custom creation logic injection (L44)  
  - `lastAdapter` captures most recent adapter parameter for assertions (L45)
- Mock factory throws error if `createFn` not configured, preventing silent test failures (L56)

**Critical Constraints**:
- Mock factory requires explicit `createFn` setup in tests - no default stub behavior
- Production factory handles optional adapter parameter by converting undefined to null
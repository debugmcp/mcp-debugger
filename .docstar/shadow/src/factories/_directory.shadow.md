# src/factories/
@generated: 2026-02-09T18:16:06Z

## Factories Module

**Overall Purpose**: This module implements the Factory Pattern for creating core system components, providing a clean abstraction layer that enables dependency injection, test isolation, and polymorphic object creation. It serves as the primary instantiation point for ProxyManager and SessionStore components.

**Key Components**:

- **ProxyManagerFactory** (`proxy-manager-factory.ts`): Creates ProxyManager instances with dependency injection support
- **SessionStoreFactory** (`session-store-factory.ts`): Creates SessionStore instances following the same factory pattern
- **Mock Factories**: Test doubles with tracking capabilities and customizable behavior for comprehensive testing support

**Public API Surface**:

```typescript
// Factory Interfaces (main entry points)
interface IProxyManagerFactory {
  create(adapter?: IDebugAdapter): IProxyManager;
}

interface ISessionStoreFactory {
  create(): SessionStore;
}

// Production Implementations
class ProxyManagerFactory implements IProxyManagerFactory
class SessionStoreFactory implements ISessionStoreFactory

// Test Implementations  
class MockProxyManagerFactory implements IProxyManagerFactory
class MockSessionStoreFactory implements ISessionStoreFactory
```

**Internal Organization**:

The module follows a consistent architectural pattern across all factories:

1. **Interface Definition**: Each factory exposes a creation contract through an interface
2. **Production Implementation**: Concrete factory that creates real instances with proper dependency injection
3. **Mock Implementation**: Test factory with call tracking and behavioral customization
4. **Test Doubles**: Where applicable (SessionStore), mock objects that extend real components for behavioral compatibility

**Data Flow**:

1. Client code depends on factory interfaces (`IProxyManagerFactory`, `ISessionStoreFactory`)
2. Production code injects concrete factory implementations
3. Test code substitutes mock factories to control and observe creation behavior
4. Factories handle dependency injection, passing required services to created instances

**Important Patterns**:

- **Dependency Injection**: Production factories receive dependencies via constructor injection and pass them to created instances
- **Interface Segregation**: Each factory has a focused creation responsibility
- **Test Instrumentation**: Mock factories provide tracking arrays (`createdManagers`, `createdStores`) and parameter capture (`lastAdapter`, `createSessionCalls`)
- **Explicit Configuration**: Mock factories require explicit setup (`createFn` for ProxyManager) to prevent silent test failures

**Role in Larger System**: This module serves as the composition root for major system components, enabling clean architecture principles by decoupling object creation from business logic and providing comprehensive testing capabilities through mock implementations.
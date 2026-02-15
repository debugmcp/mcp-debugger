# src\factories/
@children-hash: 5363054a7f5efdaa
@generated: 2026-02-15T09:01:22Z

## Factories Module - Dependency Injection and Testing Infrastructure

The `factories` directory implements the Factory pattern to provide centralized object creation with dependency injection capabilities across the debug MCP (Model Context Protocol) system. This module enables clean separation of object construction from business logic while supporting comprehensive testing through mock implementations.

### Overall Purpose

Provides abstract factory interfaces and concrete implementations for creating key system components (`ProxyManager` and `SessionStore`) with injected dependencies. Enables runtime dependency swapping and comprehensive test coverage through dedicated mock factory implementations.

### Key Components and Organization

**Core Factory Interfaces**
- `IProxyManagerFactory` - Contract for creating ProxyManager instances with optional debug adapters
- `ISessionStoreFactory` - Contract for creating SessionStore instances

**Production Factories**
- `ProxyManagerFactory` - Creates ProxyManager instances with injected dependencies (proxy process launcher, file system, logger)
- `SessionStoreFactory` - Creates standard SessionStore instances

**Testing Infrastructure**
- `MockProxyManagerFactory` - Test factory with call tracking and configurable creation functions
- `MockSessionStoreFactory` - Test factory that creates MockSessionStore instances with spy capabilities
- `MockSessionStore` - Test double extending SessionStore with method call tracking

### Public API Surface

**Main Entry Points:**
- Factory interfaces (`IProxyManagerFactory`, `ISessionStoreFactory`) for dependency injection
- Production factories (`ProxyManagerFactory`, `SessionStoreFactory`) for application code
- Mock factories for test scenarios

**Key Methods:**
- `create()` - Primary factory method across all implementations
- Constructor dependency injection for production factories
- Call tracking properties for test factories

### Architectural Patterns

**Factory Pattern**: Abstracts object creation behind stable interfaces, enabling polymorphic usage and runtime configuration.

**Dependency Injection**: Production factories require dependencies through constructors, promoting loose coupling and testability.

**Test Double Strategy**: Mock factories create specialized test doubles that extend real classes while adding spy/tracking capabilities.

**Interface Segregation**: Clean separation between production and testing concerns through dedicated factory types.

### Data Flow and Integration

1. Application code depends on factory interfaces, not concrete implementations
2. Production factories inject real dependencies into created objects
3. Test factories substitute mock objects with tracking capabilities
4. Factory instances are configured at application startup or test setup
5. Created objects maintain their expected interfaces while enabling test verification

This module serves as the dependency injection backbone for the debug MCP system, enabling both robust production object creation and comprehensive testing capabilities.
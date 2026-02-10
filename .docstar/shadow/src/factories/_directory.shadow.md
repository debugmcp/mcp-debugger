# src/factories/
@generated: 2026-02-10T21:26:26Z

## Factory Pattern Module for Debug MCP System

This directory implements a centralized factory pattern module that provides abstracted object creation for core components in a debug MCP (Model Context Protocol) system. The factories enable dependency injection, test isolation, and polymorphic instantiation of critical system components.

## Overall Purpose

The factories module serves as the object creation layer, abstracting the instantiation of complex objects with their dependencies. This design supports both production deployment and comprehensive testing by providing swappable factory implementations and mock objects that maintain interface compatibility while enabling test verification.

## Key Components and Relationships

**Factory Interfaces**
- `IProxyManagerFactory` - Contract for creating ProxyManager instances with optional debug adapters
- `ISessionStoreFactory` - Contract for creating SessionStore instances

**Production Factories**
- `ProxyManagerFactory` - Creates ProxyManager instances with injected dependencies (proxy process launcher, file system, logger)
- `SessionStoreFactory` - Creates standard SessionStore instances

**Testing Infrastructure**
- `MockProxyManagerFactory` - Test double with creation tracking and configurable creation functions
- `MockSessionStoreFactory` - Creates MockSessionStore instances with call tracking capabilities
- `MockSessionStore` - Extended SessionStore with method call tracking for test verification

## Public API Surface

**Main Entry Points:**
- Factory interfaces (`IProxyManagerFactory`, `ISessionStoreFactory`) for dependency injection
- Production factories (`ProxyManagerFactory`, `SessionStoreFactory`) for application code
- Mock factories (`MockProxyManagerFactory`, `MockSessionStoreFactory`) for test environments

**Creation Methods:**
- `create(adapter?: IDebugAdapter): IProxyManager` - ProxyManager creation with optional debug adapter
- `create(): SessionStore` - SessionStore creation

## Internal Organization and Data Flow

1. **Production Flow**: Application code depends on factory interfaces, production factories inject dependencies and create concrete instances
2. **Testing Flow**: Test code swaps in mock factories, which create instrumented mock objects that track method calls and maintain behavioral compatibility
3. **Dependency Management**: Production factories handle complex dependency injection (file system, logging, process launchers), while mock factories focus on test verification

## Important Patterns and Conventions

- **Factory Pattern**: Consistent abstraction of object creation across different component types
- **Interface Segregation**: Clean separation between production and testing concerns through interfaces
- **Dependency Injection**: Constructor injection of dependencies in production factories
- **Test Double Strategy**: Mock objects extend real classes for drop-in replacement while adding test capabilities
- **Call Tracking**: Systematic recording of method invocations and parameters for test assertions

This module enables the debug MCP system to maintain clean separation between object creation, dependency management, and testing concerns while providing a consistent API for component instantiation.
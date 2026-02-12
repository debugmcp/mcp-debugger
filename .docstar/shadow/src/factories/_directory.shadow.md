# src\factories/
@generated: 2026-02-12T21:00:53Z

## Factory Pattern Module for Debug MCP System

This directory implements the **Factory pattern** for creating core system components with dependency injection support and comprehensive testing capabilities within a debug MCP (Model Context Protocol) system.

### Overall Purpose

Provides centralized, abstracted creation of key system components (`ProxyManager` and `SessionStore`) through factory interfaces that enable:
- Clean dependency injection in production code
- Easy mocking and testing through dedicated test factories
- Consistent object creation patterns across the system
- Runtime swapping of implementations for different environments

### Key Components and Architecture

The module follows a consistent pattern across both factories:

**Production Factories**
- `ProxyManagerFactory` - Creates `ProxyManager` instances with injected dependencies (proxy process launcher, file system, logger)
- `SessionStoreFactory` - Creates standard `SessionStore` instances

**Test Factories** 
- `MockProxyManagerFactory` - Configurable mock with call tracking and injectable creation functions
- `MockSessionStoreFactory` - Creates `MockSessionStore` instances with method call tracking

**Factory Interfaces**
- `IProxyManagerFactory` - Defines contract for ProxyManager creation with optional debug adapter
- `ISessionStoreFactory` - Defines contract for SessionStore creation

### Public API Surface

**Main Entry Points:**
- `ProxyManagerFactory.create(adapter?: IDebugAdapter): IProxyManager` - Production proxy manager creation
- `SessionStoreFactory.create(): SessionStore` - Production session store creation
- `MockProxyManagerFactory` / `MockSessionStoreFactory` - Test implementations with tracking capabilities

### Internal Organization

**Dependency Flow:**
1. Factories receive injected dependencies in constructors (production) or configuration (test)
2. `create()` methods instantiate target objects with appropriate dependencies
3. Mock factories track creation calls and parameters for test assertions
4. Test doubles extend real classes to maintain interface compatibility

### Important Patterns

**Factory Pattern Implementation:**
- Abstract interfaces enable polymorphic usage
- Concrete implementations handle production vs. test scenarios
- Consistent `create()` method signatures across all factories

**Testing Support:**
- Mock factories provide call tracking arrays (`createdManagers`, `createdStores`)
- Test doubles extend real classes for drop-in replacement
- Spy pattern captures method invocations with parameters

**Dependency Injection:**
- Production factories require dependencies in constructors
- Clean separation between object creation and business logic
- Enables runtime environment switching (production/test)

This module serves as the **creation layer** for the debug MCP system, abstracting instantiation complexity while providing robust testing infrastructure for component interactions.
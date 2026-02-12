# src\factories/
@generated: 2026-02-12T21:05:41Z

## Factory Module for Debug MCP System

This directory implements the factory pattern for creating key system components with dependency injection and comprehensive testing support. It serves as the primary object creation layer within a debug MCP (Model Context Protocol) system.

### Overall Purpose

The factories module provides abstracted instantiation of critical system components - `ProxyManager` and `SessionStore` - enabling:
- Dependency injection for production deployments
- Mock injection for testing scenarios
- Consistent object creation patterns across the application
- Clear separation between object creation and business logic

### Key Components Structure

**Factory Interfaces**
- `IProxyManagerFactory` - Contract for ProxyManager creation with optional debug adapters
- `ISessionStoreFactory` - Contract for SessionStore creation

**Production Factories**
- `ProxyManagerFactory` - Creates ProxyManager instances with injected dependencies (process launcher, file system, logger)
- `SessionStoreFactory` - Creates standard SessionStore instances

**Testing Infrastructure**
- `MockProxyManagerFactory` - Tracks created managers and supports injectable creation functions
- `MockSessionStoreFactory` - Creates MockSessionStore instances with call tracking
- `MockSessionStore` - Test double that extends real SessionStore with method invocation tracking

### Public API Surface

**Primary Entry Points:**
- `ProxyManagerFactory.create(adapter?: IDebugAdapter): IProxyManager` - Production proxy manager creation
- `SessionStoreFactory.create(): SessionStore` - Production session store creation

**Testing Entry Points:**
- `MockProxyManagerFactory.create()` - Configurable mock proxy manager creation  
- `MockSessionStoreFactory.create()` - Mock session store creation with tracking

### Internal Organization

The module follows a consistent pattern across both factories:
1. Interface definition establishing creation contracts
2. Production implementation handling real dependency injection
3. Mock implementation providing test doubles and call tracking
4. Extended mock classes (where applicable) maintaining API compatibility while adding test instrumentation

### Data Flow

Production flow: Interface → Production Factory → Real Component with injected dependencies
Testing flow: Interface → Mock Factory → Mock Component with tracking capabilities

### Architectural Patterns

- **Abstract Factory Pattern** - Interfaces enable polymorphic factory usage
- **Dependency Injection** - Production factories inject required dependencies
- **Test Double Pattern** - Mock factories create instrumented test versions
- **Call Tracking** - Mock components record method invocations for test verification
- **Interface Segregation** - Separate factory interfaces for each component type

This module serves as the foundation for testable, loosely-coupled object creation throughout the debug MCP system.
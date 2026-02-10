# src/factories/
@generated: 2026-02-10T01:19:34Z

## Factory Module for Debug MCP System

This directory implements factory pattern abstractions for creating core service instances within a debug Model Context Protocol (MCP) system. The module provides dependency injection capabilities and comprehensive testing support through mock implementations.

## Purpose & Responsibility

The factories module serves as the creation layer for key system components, abstracting object instantiation and enabling dependency injection for both production and testing scenarios. It ensures loose coupling between component creation and usage while providing test doubles for verification.

## Key Components

### Factory Interfaces
- `IProxyManagerFactory` - Contract for creating ProxyManager instances with optional debug adapters
- `ISessionStoreFactory` - Contract for creating SessionStore instances

### Production Factories
- `ProxyManagerFactory` - Creates ProxyManager instances with injected dependencies (process launcher, file system, logger)
- `SessionStoreFactory` - Creates standard SessionStore instances for session management

### Testing Infrastructure
- `MockProxyManagerFactory` - Test factory with call tracking and configurable creation behavior
- `MockSessionStoreFactory` - Test factory that creates mock session stores with verification capabilities
- `MockSessionStore` - Test double extending SessionStore with method call tracking

## Public API Surface

**Main Entry Points:**
- Factory interfaces for polymorphic usage in dependency injection
- Production factories for standard application flow
- Mock factories for test configuration and verification

**Key Methods:**
- `create()` methods across all factories for instance creation
- Tracking arrays and properties in mock implementations for test assertions

## Internal Organization & Data Flow

1. **Abstraction Layer**: Interfaces define creation contracts
2. **Production Path**: Concrete factories create instances with real dependencies
3. **Testing Path**: Mock factories create test doubles with verification capabilities
4. **Dependency Flow**: Production factories inject required services (launchers, file systems, loggers)

## Architectural Patterns

- **Abstract Factory**: Interface-based factory contracts
- **Dependency Injection**: Constructor-based dependency provision
- **Test Double**: Mock objects extending real implementations
- **Call Tracking**: Spy pattern for test verification
- **Factory Method**: Standardized `create()` method across implementations

## Integration Context

This module enables the debug MCP system to create proxy managers and session stores with different configurations and dependency sets, while providing comprehensive testing infrastructure for verifying component interactions and behaviors.
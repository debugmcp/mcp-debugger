# src/factories/
@generated: 2026-02-11T23:47:36Z

## Factory Pattern Implementation Hub

The `src/factories` directory provides a centralized factory pattern implementation for creating key system components with dependency injection support and comprehensive testing capabilities.

## Overall Purpose

This module serves as the primary object creation layer within a debug MCP (Model Context Protocol) system, implementing the factory pattern to abstract instantiation logic and enable flexible dependency management. It provides both production factories for runtime use and mock factories for testing scenarios.

## Key Components and Relationships

**Factory Interfaces**
- `IProxyManagerFactory` - defines contract for ProxyManager creation with optional debug adapter
- `ISessionStoreFactory` - defines contract for SessionStore creation

**Production Factories**
- `ProxyManagerFactory` - creates ProxyManager instances with injected dependencies (process launcher, file system, logger)
- `SessionStoreFactory` - creates standard SessionStore instances

**Test Factories and Mocks**
- `MockProxyManagerFactory` - provides test doubles with call tracking and configurable creation behavior
- `MockSessionStoreFactory` - creates MockSessionStore instances for test isolation
- `MockSessionStore` - test double extending SessionStore with method call tracking

## Public API Surface

**Main Entry Points:**
- Factory interface contracts (`IProxyManagerFactory`, `ISessionStoreFactory`)
- Production factory implementations for dependency injection
- Mock factory implementations for testing

**Key Methods:**
- `create()` methods on all factories for object instantiation
- Mock factories provide additional test inspection properties (`createdManagers`, `createdStores`, call tracking arrays)

## Internal Organization and Data Flow

The factories follow a consistent pattern:
1. Interface definition establishing creation contract
2. Production implementation requiring dependency injection
3. Mock implementation with test tracking capabilities
4. Object creation delegates to concrete classes with proper dependency wiring

Dependencies flow from external systems → factories → created instances, with factories serving as the composition root for complex object graphs.

## Important Patterns and Conventions

**Factory Pattern**: Centralizes object creation logic and abstracts instantiation complexity
**Dependency Injection**: All production factories require dependencies via constructor injection
**Test Doubles**: Mock factories extend real behavior while adding test observability
**Interface Segregation**: Separate interfaces for each factory type maintain clean contracts
**Call Tracking**: Mock implementations record method invocations for test verification

## Architectural Role

This directory serves as the system's composition root, responsible for wiring together complex object dependencies in a testable manner. It enables the larger debug MCP system to maintain loose coupling between components while providing comprehensive testing support through injectable mock implementations.
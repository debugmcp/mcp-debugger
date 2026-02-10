# tests/core/unit/factories/
@generated: 2026-02-09T18:16:12Z

## Purpose
Comprehensive unit test suite for the factory pattern implementation in the core debug system, validating both production factories and their corresponding mock/testing counterparts. Tests ensure proper dependency injection, instance creation, state isolation, and mock functionality for critical debugging infrastructure components.

## Key Components and Architecture

### Factory Pattern Testing Framework
The directory tests two primary factory pairs that implement the factory pattern for core debugging components:

- **ProxyManagerFactory & MockProxyManagerFactory** - Creates ProxyManager instances for debug adapter proxy management
- **SessionStoreFactory & MockSessionStoreFactory** - Creates SessionStore instances for debugging session management

Each factory pair follows a consistent pattern:
- Production factory creates actual instances with proper dependency injection
- Mock factory extends functionality with call tracking and testing utilities
- Both implement shared interfaces for consistent API contracts

### Mock Infrastructure Components
Supporting mock implementations that extend base functionality while preserving original behavior:
- **MockProxyManager** - Tracked proxy manager instances
- **MockSessionStore** - Session store with createSession call tracking
- **Mock Debug Adapter** - Fully stubbed IDebugAdapter for isolation testing

## Public API Surface

### Core Test Entry Points
- **ProxyManagerFactory Tests** - Validates proxy manager creation, dependency injection, and instance independence
- **SessionStoreFactory Tests** - Tests session store creation, state isolation, and functional operation
- **MockProxyManagerFactory Tests** - Validates mock factory error handling, creation function integration, and state tracking
- **MockSessionStoreFactory Tests** - Tests mock store creation, tracking capabilities, and factory isolation

### Key Testing Patterns
- **Instance Independence Validation** - Ensures factory.create() returns distinct instances without shared state
- **Dependency Injection Testing** - Validates proper dependency wiring and consistency
- **Mock State Tracking** - Tests tracking of created instances and method calls for testing utilities
- **Interface Compliance** - Verifies all factories implement required interfaces correctly

## Internal Organization and Data Flow

### Test Structure Hierarchy
```
Factory Tests
├── Production Factory Behavior
│   ├── Instance Creation & Interface Compliance
│   ├── Independence & Memory Management
│   └── Dependency Management
└── Mock Factory Behavior
    ├── Error Handling & Configuration
    ├── State Tracking & Instance Management
    └── Testing Utility Access
```

### Critical Test Invariants
- Factory instances must not retain references to created objects (memory safety)
- Mock factories must track all created instances in arrays for test access
- Each factory.create() call must return independent instances
- Mock implementations must preserve base functionality while adding tracking
- Dependencies must remain consistent across multiple create() calls

## Integration Points
Tests validate integration with broader debugging system:
- **Debug Adapter Protocol (DAP)** - Through IDebugAdapter interface testing
- **Debug Language Support** - Via DebugLanguage enum integration
- **File System & Process Management** - Through dependency injection testing
- **Session Management** - Via SessionStore functional testing

## Testing Framework Dependencies
- **Vitest** - Primary testing framework with mocking capabilities
- **Mock Utilities** - Comprehensive interface stubbing and call tracking
- **Type Safety** - TypeScript interface compliance validation
- **Behavioral Verification** - Mock function call and state verification patterns

This directory serves as the testing foundation ensuring the factory pattern implementation provides reliable, isolated, and properly dependency-injected instances for the core debugging infrastructure.
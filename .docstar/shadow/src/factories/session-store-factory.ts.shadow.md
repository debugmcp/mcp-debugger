# src/factories/session-store-factory.ts
@source-hash: d9739a93268d6058
@generated: 2026-02-10T00:41:44Z

## Factory Pattern for SessionStore Creation

Implements the factory pattern to create `SessionStore` instances with dependency injection support and testing capabilities.

### Core Components

**ISessionStoreFactory Interface (L10-12)**
- Abstract factory interface with single `create()` method
- Returns `SessionStore` instances
- Enables polymorphic factory usage

**SessionStoreFactory Class (L17-21)**
- Production factory implementation
- Creates standard `SessionStore` instances via constructor
- Primary entry point for application code

**MockSessionStoreFactory Class (L26-34)**
- Testing-focused factory implementation
- Creates `MockSessionStore` instances instead of production ones
- Tracks all created stores in `createdStores` array for test verification
- Enables test isolation and mock injection

**MockSessionStore Class (L40-55)**
- Test double that extends real `SessionStore` for compatibility
- Adds call tracking for `createSession()` method (L51-54)
- Stores method invocations in `createSessionCalls` array with parameters
- Maintains behavioral consistency while enabling test assertions

### Dependencies

- `SessionStore` and `CreateSessionParams` from `../session/session-store.js`

### Architectural Patterns

- **Factory Pattern**: Abstracts object creation behind interface
- **Dependency Injection**: Enables runtime factory swapping
- **Test Double**: Mock extends real class for drop-in replacement
- **Call Tracking**: Spy pattern for testing method invocations

### Usage Context

Production code uses `SessionStoreFactory`, tests inject `MockSessionStoreFactory` to control and verify session store interactions.
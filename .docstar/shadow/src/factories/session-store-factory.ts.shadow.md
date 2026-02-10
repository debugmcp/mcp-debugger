# src/factories/session-store-factory.ts
@source-hash: d9739a93268d6058
@generated: 2026-02-09T18:14:58Z

**Purpose**: Factory pattern implementation for SessionStore dependency injection and testing support.

**Key Components**:

- **ISessionStoreFactory (L10-12)**: Interface defining factory contract with single `create()` method returning SessionStore instances
- **SessionStoreFactory (L17-21)**: Production factory implementation that instantiates real SessionStore objects
- **MockSessionStoreFactory (L26-34)**: Test factory that creates MockSessionStore instances and tracks all created stores in `createdStores` array
- **MockSessionStore (L40-55)**: Test double extending SessionStore with call tracking for `createSession()` method via `createSessionCalls` array

**Dependencies**: 
- Imports SessionStore and CreateSessionParams from '../session/session-store.js' (L5)

**Architecture Pattern**: 
- Factory Method pattern enabling polymorphic SessionStore creation
- Dependency injection support through interface abstraction
- Test doubles with call recording for verification

**Testing Support**:
- MockSessionStoreFactory tracks all created instances for test inspection
- MockSessionStore records createSession() calls with parameters for assertion
- Maintains behavioral compatibility by extending real SessionStore

**Usage Pattern**: Clients depend on ISessionStoreFactory interface, allowing runtime substitution of production vs mock implementations without code changes.
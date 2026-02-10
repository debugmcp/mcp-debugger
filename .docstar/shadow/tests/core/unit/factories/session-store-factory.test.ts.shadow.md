# tests/core/unit/factories/session-store-factory.test.ts
@source-hash: c0e50c8ea7fcf9af
@generated: 2026-02-10T00:41:20Z

## Session Store Factory Test Suite

Comprehensive unit tests for session store factory pattern implementation, verifying factory behavior for both production and mock implementations.

### Test Structure

**Main Test Groups:**
- `SessionStoreFactory` tests (L11-135): Production factory implementation
- `MockSessionStoreFactory` tests (L137-226): Mock factory for testing
- `MockSessionStore` tests (L228-390): Mock store with call tracking

### Dependencies

**Core Imports:**
- `SessionStoreFactory`, `MockSessionStoreFactory`, `MockSessionStore`, `ISessionStoreFactory` (L2-7): Factory classes under test
- `SessionStore`, `CreateSessionParams` (L8): Core session management types
- `DebugLanguage` (L9): Enum for supported debug languages
- Vitest testing framework (L1): Test runner and assertions

### SessionStoreFactory Tests (L16-135)

**Factory Instance Creation (L17-37):**
- Verifies factory creates `SessionStore` instances
- Confirms all required interface methods exist
- Tests method signatures and types

**Instance Independence (L39-74):**
- Validates each `create()` call returns unique instances
- Ensures factory maintains no internal state
- Confirms proper isolation between created stores

**Functional Verification (L75-99):**
- Tests created stores work with real session operations
- Uses Python debug language for realistic scenarios
- Validates session creation, retrieval, and storage

**Interface Compliance (L101-107):**
- Ensures `SessionStoreFactory` implements `ISessionStoreFactory`
- Type-checks factory interface methods

**State Isolation (L109-134):**
- Verifies stores created by same factory maintain independent state
- Tests session isolation between different store instances

### MockSessionStoreFactory Tests (L137-226)

**Mock Instance Creation (L138-150):**
- Verifies factory creates `MockSessionStore` instances
- Confirms inheritance from both `MockSessionStore` and `SessionStore`
- Validates mock-specific tracking properties

**Store Tracking (L152-168):**
- Tests `createdStores` array maintenance
- Verifies chronological tracking of created instances
- Ensures proper reference management

**Factory Independence (L186-201):**
- Confirms separate factory instances maintain independent state
- Tests isolation of `createdStores` arrays

### MockSessionStore Tests (L228-390)

**Inheritance Structure (L229-244):**
- Verifies `MockSessionStore` extends `SessionStore`
- Confirms type compatibility and method availability
- Tests initial state of tracking arrays

**Call Tracking (L246-267):**
- Tests `createSessionCalls` array for method invocation tracking
- Verifies parameter capture and chronological ordering
- Ensures accurate parameter preservation

**Functional Integration (L269-292):**
- Confirms base `SessionStore` functionality remains intact
- Tests simultaneous operation and tracking
- Validates session management while monitoring calls

**Independence Testing (L294-320):**
- Ensures separate `MockSessionStore` instances maintain independent tracking
- Tests isolation of call history arrays

**Parameter Handling (L322-388):**
- Tests tracking with various parameter configurations
- Verifies minimal and complex parameter scenarios
- Confirms exact parameter preservation without modification

### Key Test Patterns

**Verification Strategy:**
- Instance type checking with `toBeInstanceOf()`
- Method existence validation with `toBeTypeOf('function')`
- Reference inequality testing with `not.toBe()`
- Array length and content validation
- Parameter deep equality comparison

**Test Data:**
- Uses `DebugLanguage.PYTHON` and `DebugLanguage.MOCK` for realistic scenarios
- Employs varying session names and executable paths
- Tests both minimal and comprehensive parameter sets
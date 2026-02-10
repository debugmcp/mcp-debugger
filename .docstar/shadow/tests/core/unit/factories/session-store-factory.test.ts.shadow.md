# tests/core/unit/factories/session-store-factory.test.ts
@source-hash: c0e50c8ea7fcf9af
@generated: 2026-02-09T18:14:21Z

## Purpose
Unit test suite for session store factory components, validating factory pattern implementation and mock functionality for debugging session management.

## Test Structure

### SessionStoreFactory Tests (L16-135)
Tests the main production factory that creates SessionStore instances:
- **Instance Creation (L17-37)**: Validates factory creates proper SessionStore instances with all required methods
- **Independence Verification (L39-55)**: Ensures each factory.create() call returns distinct instances  
- **Memory Management (L57-73)**: Confirms factory doesn't retain references to created instances
- **Functional Testing (L75-99)**: Tests created stores work with actual session creation/retrieval
- **Interface Compliance (L101-107)**: Verifies ISessionStoreFactory interface implementation
- **State Isolation (L109-134)**: Confirms stores created by same factory maintain independent state

### MockSessionStoreFactory Tests (L137-226) 
Tests the testing/mock factory with tracking capabilities:
- **Mock Instance Creation (L138-150)**: Validates creation of MockSessionStore instances
- **Store Tracking (L152-168)**: Tests factory's createdStores array functionality
- **Independence (L170-184)**: Ensures mock stores have independent tracking arrays
- **Factory Isolation (L186-201)**: Confirms different factory instances maintain separate state
- **Interface Compliance (L203-209)**: Verifies ISessionStoreFactory interface implementation
- **Test Utility Access (L211-225)**: Tests ability to access all created stores for testing

### MockSessionStore Tests (L228-389)
Tests the mock store implementation with call tracking:
- **Inheritance (L229-244)**: Validates MockSessionStore extends SessionStore properly
- **Call Tracking (L246-267)**: Tests createSessionCalls tracking functionality
- **Dual Functionality (L269-292)**: Ensures base functionality works while tracking calls
- **Instance Independence (L294-320)**: Confirms independent tracking between instances
- **Order Preservation (L322-342)**: Tests calls tracked in correct order
- **Parameter Handling (L344-357)**: Tests tracking with minimal parameters
- **Method Preservation (L359-372)**: Validates all SessionStore methods available
- **Parameter Fidelity (L374-388)**: Ensures exact parameter tracking

## Key Dependencies
- **Vitest Framework**: Testing utilities (describe, it, expect, vi, beforeEach, afterEach)
- **Source Factories**: SessionStoreFactory, MockSessionStoreFactory, MockSessionStore, ISessionStoreFactory
- **Session Components**: SessionStore, CreateSessionParams
- **Debug Language**: DebugLanguage enum from @debugmcp/shared

## Architecture Patterns
- **Factory Pattern**: Both production and mock factories implement create() method
- **Mock/Spy Pattern**: MockSessionStore tracks method calls while preserving base functionality  
- **Interface Segregation**: All factories implement ISessionStoreFactory interface
- **Independent Instance Creation**: Factories create isolated instances without shared state

## Critical Invariants
- Factory instances must not retain references to created stores (production factory)
- Mock factory must track all created stores in createdStores array
- MockSessionStore must preserve all base SessionStore functionality while adding tracking
- Each factory.create() call must return a new, independent instance
- Mock stores must track createSession calls with exact parameters in order
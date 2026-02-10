# packages/adapter-javascript/tests/unit/factory-export.test.ts
@source-hash: 786ca48da74d1d61
@generated: 2026-02-09T18:13:58Z

**Primary Purpose:** Integration test file verifying that the JavascriptAdapterFactory exports correctly and creates functional adapter instances that conform to the IDebugAdapter interface contract.

**Test Structure:**
- **Package Export Test (L7-11):** Validates JavascriptAdapterFactory is properly exported and instantiable
- **Interface Compliance Test (L13-27):** Ensures factory.createAdapter() returns object with required IDebugAdapter methods (initialize, dispose, getState)
- **State Transition Test (L29-49):** Verifies adapter initialization behavior - state transitions to READY and 'initialized' event emission

**Key Dependencies:**
- **JavascriptAdapterFactory (L2):** Main factory class being tested from package index
- **@debugmcp/shared (L3-4):** Provides AdapterState enum and type definitions (AdapterDependencies, IFileSystem, ILogger, IEnvironment, IProcessLauncher)
- **vitest (L1):** Test framework providing describe/test/expect functions

**Test Patterns:**
- **Mock Dependencies (L15-20, L31-36):** Uses type assertions to create minimal mock objects for required dependencies
- **Event-driven Testing (L40-42):** Promise-based pattern to verify asynchronous event emission
- **State Verification (L47-48):** Validates both boolean state check and enum state value

**Critical Constraints:**
- Tests assume adapter follows event emitter pattern with 'initialized' event
- Requires adapter to implement state management (READY state, isReady() method)
- Dependencies must be fully provided even if mocked for factory instantiation
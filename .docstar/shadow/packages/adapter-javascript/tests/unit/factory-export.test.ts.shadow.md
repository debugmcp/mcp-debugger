# packages/adapter-javascript/tests/unit/factory-export.test.ts
@source-hash: 786ca48da74d1d61
@generated: 2026-02-10T00:41:04Z

**Purpose**: Unit test file verifying the factory export and adapter creation functionality for the JavaScript debug adapter package.

**Test Structure**:
- Primary test suite: `@debugmcp/adapter-javascript package` (L6)
- Tests basic factory export, adapter creation, and initialization lifecycle

**Key Tests**:
1. **Factory Export Test** (L7-11): Verifies `JavascriptAdapterFactory` is properly exported and instantiable
2. **Adapter Creation Test** (L13-27): Validates factory creates adapter with correct IDebugAdapter interface methods (`initialize`, `dispose`, `getState`)
3. **Initialization Test** (L29-49): Tests adapter state transitions from creation to READY state and event emission

**Dependencies**:
- `JavascriptAdapterFactory` from `../../src/index.js` (L2)
- `@debugmcp/shared` types: `AdapterState`, `AdapterDependencies`, `IFileSystem`, `ILogger`, `IEnvironment`, `IProcessLauncher` (L3-4)
- Vitest testing framework (L1)

**Mock Dependencies Pattern** (L15-20, L31-36):
Creates mock `AdapterDependencies` with stubbed implementations:
- Empty objects for filesystem, environment, and process launcher
- Minimal logger with no-op methods
- Uses type assertions to satisfy TypeScript interface requirements

**Adapter Lifecycle Validation**:
- Tests adapter interface compliance (L24-26)
- Validates state management: transitions to `AdapterState.READY` (L48)
- Verifies event emission: `initialized` event with Promise-based verification (L40-45)
- Confirms `isReady()` method returns true after initialization (L47)

**Testing Patterns**:
- Factory pattern validation
- Interface compliance checking
- Asynchronous state transition testing
- Event-driven architecture verification
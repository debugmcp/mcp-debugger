# tests\core\unit\session\session-manager-edge-cases.test.ts
@source-hash: 5c85a664a7eea780
@generated: 2026-02-19T23:47:39Z

## Test Suite for SessionManager Edge Cases and Error Scenarios

**Purpose:** Comprehensive test coverage for SessionManager error handling, edge cases, and failure scenarios to ensure robustness and graceful degradation.

**Test Structure:** 
- Uses Vitest testing framework with mock dependencies
- Fake timers for time-sensitive operations (L15, L29)
- Mock proxy manager reset between tests (L31)
- Consistent test session setup with MOCK language and python executable

**Test Categories:**

### Session Creation Edge Cases (L34-66)
- **Executable Path Handling (L35-43):** Verifies provided executable paths are properly stored
- **Unique ID Generation (L45-55):** Ensures concurrent session creation produces unique identifiers
- **Default Naming (L57-65):** Tests automatic session name generation pattern `session-<uuid>`

### Continue Method Error Handling (L68-87)
- **DAP Request Failures (L69-86):** Tests error propagation when continue DAP requests fail, specifically targeting line 595 in SessionManager implementation

### DAP Operation Error Scenarios (L89-258)
Comprehensive error handling tests for core debugging operations:

- **getVariables Error Handling (L90-136):**
  - Network errors return empty array with logging (L105-107, references lines 653-655)
  - Missing response body handling with warnings (L129-131, references lines 650-651)

- **getStackTrace Error Handling (L138-207):**
  - Request failures return empty array (L153-155, references lines 690, 692)
  - Missing response body scenarios (L177-179, references lines 687-688)
  - No effective thread ID handling (L201-206)

- **getScopes Error Handling (L209-257):**
  - Request errors with logging (L224-226, references lines 728-730)
  - Missing scopes in response (L250-252, references lines 725-726)

### Session Closing Error Cases (L260-303)
- **Proxy Stop Failures (L261-281):** Tests graceful handling when proxy manager stop() fails
- **Non-existent Session Handling (L283-290):** Verifies proper false return and warning for invalid session IDs (references lines 751-754)
- **Undefined Proxy Scenarios (L292-302):** Tests closing sessions without active proxy managers

**Key Dependencies:**
- `SessionManager` and `SessionManagerConfig` from session-manager.js
- `DebugLanguage`, `SessionState` from @debugmcp/shared
- `createMockDependencies` test utility for consistent mocking

**Testing Patterns:**
- All error scenarios verify both return values and logging behavior
- Mock proxy manager provides controlled failure simulation
- Tests reference specific line numbers in implementation for targeted coverage
- Consistent use of fake timers for async operation testing
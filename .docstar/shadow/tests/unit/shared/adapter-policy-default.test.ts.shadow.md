# tests/unit/shared/adapter-policy-default.test.ts
@source-hash: 9d0687523d58f921
@generated: 2026-02-09T18:14:42Z

**Purpose:** Unit test suite for the DefaultAdapterPolicy class, ensuring it provides safe no-op behaviors as a fallback adapter policy implementation.

**Test Structure:**
- Main test file for DefaultAdapterPolicy from shared interfaces package
- Uses Vitest testing framework (L1)
- Two primary test cases covering different aspects of the default policy

**Test Coverage:**

**Safe No-op Behaviors Test (L5-19):**
- Verifies default policy properties and methods return safe defaults
- Tests static properties: name='default', supportsReverseStartDebugging=false, childSessionStrategy='none'
- Validates method behaviors:
  - `shouldDeferParentConfigDone()` returns false (L9)
  - `buildChildStartArgs()` throws exception for safety (L10)
  - `isChildReadyEvent()` returns false (L11)
  - Configuration methods return minimal objects (L12-18)
  - Path resolution passes through unchanged (L13)

**State Management Test (L21-33):**
- Tests initial state creation and tracking via `createInitialState()` (L22)
- Verifies default state: initialized=false, configurationDone=false (L23-24)
- Tests state query methods return false for uninitialized state (L25-26)
- Confirms optional state update methods are no-ops when called (L28-32)

**Key Dependencies:**
- DefaultAdapterPolicy from '../../../packages/shared/src/interfaces/adapter-policy.js' (L2)
- Vitest testing utilities (L1)

**Test Pattern:**
- Comprehensive coverage of all public methods and properties
- Focuses on safety guarantees - no destructive operations
- Uses type assertion (`as any`) for event testing (L11)
- Tests both synchronous returns and exception throwing behavior
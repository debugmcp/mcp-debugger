# packages/adapter-mock/tests/unit/mock-adapter-factory.test.ts
@source-hash: 80bbaaacb041fb51
@generated: 2026-02-10T00:41:08Z

## Test Suite for MockAdapterFactory

**Purpose:** Unit tests validating the MockAdapterFactory class functionality and its factory helper function. Tests the creation, configuration, and validation behavior of mock debug adapters.

**Key Components:**

- **`createDependencies()` (L7-22):** Helper function that creates mock AdapterDependencies object with stubbed implementations for file system, process launcher, environment, and logger interfaces. Returns type-extended interface including logger methods.

- **MockAdapterFactory Creation Test (L25-35):** Validates that factory properly instantiates MockDebugAdapter with custom configuration (supportedFeatures, defaultDelay) and respects feature flags.

- **Metadata Validation Test (L37-47):** Verifies factory returns correct adapter metadata including language type (MOCK), display name, version, author, and supported file extensions.

- **Default Validation Test (L49-56):** Confirms factory validation succeeds with empty configuration and returns clean validation result structure.

- **High Error Probability Warning Test (L58-65):** Tests validation warning system when errorProbability exceeds threshold (0.8), ensuring proper warning message generation.

- **High Delay Warning Test (L67-74):** Validates warning generation for excessive defaultDelay values (2500ms), providing performance guidance for test scenarios.

- **Helper Function Test (L76-85):** Verifies `createMockAdapterFactory` convenience function properly forwards configuration and creates functional factory instances.

**Dependencies:**
- Vitest testing framework for test structure and assertions
- `@debugmcp/shared` types (AdapterDependencies, DebugFeature, DebugLanguage)
- MockAdapterFactory and MockDebugAdapter from local source modules

**Test Patterns:**
- Uses object type casting (`{} as unknown`) for dependency mocking
- Tests both direct constructor usage and factory helper function
- Validates both positive cases and configuration warning scenarios
- Focuses on interface compliance and configuration propagation
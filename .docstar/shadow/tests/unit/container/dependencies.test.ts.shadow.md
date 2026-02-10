# tests/unit/container/dependencies.test.ts
@source-hash: 0da1d12238b5e363
@generated: 2026-02-09T18:14:45Z

## Purpose
Unit test file for the production dependency container initialization and wiring. Tests the `createProductionDependencies` function to ensure proper service instantiation, configuration passing, bundled adapter registration, and environment-based adapter filtering.

## Test Structure
- **Mock Setup (L3-65)**: Comprehensive mocks for all external dependencies including logger, implementations, factories, and adapter registry
- **Test Environment Management (L68-86)**: BeforeEach/afterEach hooks managing process.env and global state cleanup
- **Core Test Suite (L88-186)**: Three main test scenarios covering dependency wiring, async adapter registration, and environment-based filtering

## Key Mock Objects
- **createLoggerMock (L3-6)**: Mock logger factory returning logger with info/warn methods
- **Service Instance Mocks (L8-15)**: Tagged mock objects for FileSystem, ProcessManager, NetworkManager, ProcessLauncher variants
- **Factory Instance Mocks (L14-15)**: ProxyManagerFactory and SessionStoreFactory mocks
- **AdapterRegistryMock Class (L47-54)**: Full mock class with register/getSupportedLanguages methods
- **isLanguageDisabledMock (L60)**: Mock for language configuration checking

## Test Scenarios

### Dependency Wiring Test (L89-124)
Verifies that `createProductionDependencies` correctly:
- Passes configuration to logger creation (logLevel, logFile, loggerOptions)
- Returns properly wired dependency object with all expected services
- Configures AdapterRegistry with correct settings (validateOnRegister: false, allowOverride: false, enableDynamicLoading: true)

### Bundled Adapter Registration Test (L126-165)
Tests async adapter registration behavior:
- Uses global `__DEBUG_MCP_BUNDLED_ADAPTERS__` key for adapter definitions
- Mock factory constructors (FirstFactory L130-134, SecondFactory L135-139)
- Verifies successful registration and error handling for failed registrations
- Confirms async error logging without blocking initialization

### Environment-based Filtering Test (L167-185)
Tests container environment adapter filtering:
- Sets `MCP_CONTAINER=true` environment variable
- Mocks `isLanguageDisabled` to return true
- Verifies disabled adapters are skipped with info logging
- Ensures no register calls for disabled adapters

## Key Dependencies
- **Vitest**: Testing framework with mocking capabilities
- **Logger Utils**: `../../../src/utils/logger.js` for logging infrastructure
- **Implementations**: `../../../src/implementations/index.js` for core service implementations
- **Factories**: ProxyManagerFactory and SessionStoreFactory for service creation
- **Language Config**: `../../../src/utils/language-config.js` for adapter filtering logic

## Critical Constants
- **BUNDLED_ADAPTERS_KEY (L69)**: Global key `__DEBUG_MCP_BUNDLED_ADAPTERS__` for bundled adapter registration
- **originalEnv (L68)**: Backup of process.env for test isolation
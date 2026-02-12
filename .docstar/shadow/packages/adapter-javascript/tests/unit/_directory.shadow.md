# packages\adapter-javascript\tests\unit/
@generated: 2026-02-12T21:05:48Z

## Purpose
Unit test directory for the JavaScript debug adapter package, providing comprehensive test coverage for adapter functionality, configuration transformation, executable resolution, and build utilities. Tests validate the adapter's integration with the Debug Adapter Protocol (DAP), TypeScript support, environment validation, and cross-platform compatibility.

## Key Test Categories

### Core Adapter Testing
- **`javascript-adapter-factory.*.test.ts`**: Factory pattern validation, environment validation, and adapter creation lifecycle
- **`javascript-debug-adapter.*.test.ts`**: Comprehensive adapter functionality including capabilities, connection management, DAP protocol handling, configuration transformation, and lifecycle events
- **`factory-export.test.ts`**: Package export validation and adapter instantiation

### Configuration & Environment
- **`config-transformer.*.test.ts`**: Project configuration detection (ESM vs CommonJS, TypeScript paths, output file patterns) with extensive edge case and error handling coverage
- **`executable-resolver.*.test.ts`**: Cross-platform Node.js executable discovery with PATH resolution, fallback logic, and error recovery
- **`typescript-detector.*.test.ts`**: TypeScript runtime detection (tsx, ts-node) with caching, precedence rules, and platform-specific executable handling

### Build & Deployment Utilities
- **`build-js-debug.helpers.test.ts`**: GitHub release asset selection and path normalization for build tools
- **`vendor-strategy.test.ts`**: Environment-driven vendoring strategies for debug server deployment

## Testing Infrastructure

### Mock Architecture
- **MockFileSystem pattern**: Consistent filesystem mocking across test files enabling controlled file existence/content simulation
- **Environment isolation**: PATH and NODE_OPTIONS manipulation with cleanup to prevent test pollution
- **Cross-platform testing**: Platform-aware executable extensions (.exe/.cmd on Windows)

### Edge Case Coverage
Extensive edge case testing with dedicated `.edge.test.ts` and `.throw.edge.test.ts` files covering:
- Malformed JSON configuration handling
- Filesystem operation failures with graceful degradation
- Error message translation and user guidance
- Branch padding for comprehensive code coverage

## Key Public APIs Tested

### JavascriptAdapterFactory
- `validate()`: Environment validation with Node.js version checks and dependency verification
- Adapter creation and initialization lifecycle

### JavascriptDebugAdapter
- DAP protocol integration (`sendDapRequest`, `handleDapEvent`)
- Configuration transformation (`transformLaunchConfig`) with TypeScript support
- Connection management and state transitions
- Error handling and user guidance methods

### Utility Functions
- **Config detection**: `isESMProject`, `hasTsConfigPaths`, `determineOutFiles`
- **Executable resolution**: `findNode`, `whichInPath` with caching
- **TypeScript tooling**: `detectBinary` for tsx/ts-node discovery
- **Path utilities**: Cross-platform normalization and asset selection

## Data Flow Patterns
1. **Environment validation** → adapter factory creation → adapter instantiation
2. **Configuration transformation** → executable resolution → DAP command building
3. **TypeScript detection** → runtime argument injection → launch configuration
4. **Error handling** → user-friendly message translation → installation guidance

## Test Organization
- Main functionality in `.test.ts` files
- Edge cases in `.edge.test.ts` files
- Error conditions in `.throw.edge.test.ts` files
- Consistent setup/teardown patterns with mock restoration
- Event-driven testing for adapter lifecycle and DAP events
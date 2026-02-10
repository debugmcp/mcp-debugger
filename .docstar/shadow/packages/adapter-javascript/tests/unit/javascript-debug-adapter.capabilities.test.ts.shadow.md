# packages/adapter-javascript/tests/unit/javascript-debug-adapter.capabilities.test.ts
@source-hash: ac3b99d24fd9d21b
@generated: 2026-02-10T00:41:09Z

## Purpose
Unit test suite for JavascriptDebugAdapter's capability reporting and error handling functionality. Validates debug feature support, DAP capabilities exposure, installation guidance, and error message translation.

## Test Structure
**Main describe block (L17-121)**: `JavascriptDebugAdapter capabilities and error helpers`
- **Setup (L18-24)**: Creates adapter instance with mocked dependencies before each test
- **Dependencies stub (L8-15)**: Minimal AdapterDependencies with mocked logger methods

## Key Test Cases

### Feature Support Validation (L26-56)
- **Supported features (L27-39)**: Tests 8 debug features including conditional breakpoints, function breakpoints, exception breakpoints, hover evaluation, variable setting, log points, exception info, and loaded sources
- **Unsupported features (L41-55)**: Verifies 10 features return false including data breakpoints, disassembly, reverse debugging, and restart requests

### Capability Reporting (L58-77)
Tests `getCapabilities()` method exposes proper DAP flags:
- **Core capabilities (L59-68)**: Configuration done, function/conditional breakpoints, hover evaluation, loaded sources, log points, exception info, terminate, breakpoint locations
- **Exception filters (L70-77)**: Validates `uncaught` (default: true) and `userUnhandled` (default: false) filters

### Feature Requirements (L79-84)
Tests `getFeatureRequirements()` for LOG_POINTS returns version requirement information.

### Installation Instructions (L86-91)
Validates `getInstallationInstructions()` contains:
- Node.js download reference (nodejs.org)
- Vendor build command with pnpm
- TypeScript runner tools (tsx, ts-node, tsconfig-paths)

### Error Handling (L93-120)
- **Missing executable (L93-98)**: Tests generic Node.js not found guidance
- **Error translation (L100-120)**: Maps specific error patterns:
  - ENOENT → Node.js runtime not found
  - EACCES → Permission denied  
  - Missing ts-node/tsx modules → Install guidance
  - Other errors → passthrough

## Dependencies
- **Test framework**: Vitest with describe/it/expect/beforeEach/vi
- **Target class**: JavascriptDebugAdapter from `../../src/index.js`
- **Shared types**: DebugFeature, AdapterDependencies from `@debugmcp/shared`

## Test Patterns
- Mock restoration and clearing in beforeEach
- Feature enumeration testing with arrays
- String pattern matching with regex for installation/error messages
- Error object creation and translation validation
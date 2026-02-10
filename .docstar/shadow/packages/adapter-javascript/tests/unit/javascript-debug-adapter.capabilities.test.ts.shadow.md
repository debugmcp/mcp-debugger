# packages/adapter-javascript/tests/unit/javascript-debug-adapter.capabilities.test.ts
@source-hash: ac3b99d24fd9d21b
@generated: 2026-02-09T18:14:02Z

## Primary Purpose
Unit test file for JavascriptDebugAdapter capabilities and error handling functionality. Tests feature support, capability reporting, installation instructions, and error message translation.

## Key Test Structure
- **Test suite** (L17): Tests `JavascriptDebugAdapter` capabilities and error helpers
- **Dependencies stub** (L8-15): Minimal logger mock using Vitest spies
- **Setup** (L20-24): Creates fresh adapter instance with mocked dependencies before each test

## Feature Support Testing (L26-56)
- **Supported features test** (L26-40): Validates 8 supported debug features including conditional breakpoints, function breakpoints, exception handling, evaluation, variable setting, log points, and source requests
- **Unsupported features test** (L41-56): Confirms 10 unsupported features like data breakpoints, disassembly, reverse debugging, and step-back functionality

## Capabilities Testing (L58-77)
- **Core capabilities** (L58-69): Verifies standard DAP capabilities flags are properly exposed
- **Exception filters** (L70-77): Tests that 'uncaught' (default: true) and 'userUnhandled' (default: false) exception breakpoint filters are correctly configured

## Feature Requirements & Documentation (L79-91)
- **Requirements test** (L79-84): Validates that log points feature returns version requirements
- **Installation instructions** (L86-91): Confirms documentation includes Node.js URL, vendor build command, and TypeScript runner tools

## Error Handling & Translation (L93-121)
- **Missing executable error** (L93-98): Tests user-friendly error message for missing Node.js runtime
- **Error translation** (L100-120): Maps specific error codes:
  - ENOENT → Node.js runtime not found
  - EACCES → Permission denied 
  - Missing ts-node/tsx modules → Install guidance
  - Other errors → Passthrough original message

## Dependencies
- Vitest testing framework for mocks and assertions
- `@debugmcp/shared` for DebugFeature enum and AdapterDependencies interface
- JavascriptDebugAdapter from main source (L2)

## Key Patterns
- Comprehensive feature enumeration testing with explicit supported/unsupported lists
- Error message translation with specific error code handling
- Mock-based testing with proper cleanup between tests
# packages/adapter-javascript/tests/unit/javascript-debug-adapter.command.edge.test.ts
@source-hash: ccfc0a560f315720
@generated: 2026-02-09T18:14:01Z

## Purpose
Unit test file for JavascriptDebugAdapter's `buildAdapterCommand` method, specifically testing edge cases and environment stability to ensure consistent behavior across repeated calls with different NODE_OPTIONS configurations.

## Key Test Components

### Test Setup (L1-46)
- **Dependencies**: Vitest testing framework with minimal AdapterDependencies stub (L4-12)
- **Utility Function**: `isVendorPath()` (L14-16) validates that adapter path ends with expected vendor debug server path
- **Platform-Aware Config**: `baseConfig` (L22-30) with Windows/Unix conditional paths using `process.platform` detection (L19-20)
- **Environment Management**: beforeEach/afterEach hooks (L34-46) preserve and restore NODE_OPTIONS environment variable

### Core Test Suite (L48-94)
Tests three critical stability scenarios for `buildAdapterCommand()`:

1. **Existing Memory Flag Test** (L48-66): Verifies that when NODE_OPTIONS already contains max-old-space-size, repeated calls normalize whitespace without duplication and preserve original process.env
2. **Missing Memory Flag Test** (L68-82): Ensures memory flag is appended exactly once when missing, with consistent whitespace normalization across calls  
3. **Empty NODE_OPTIONS Test** (L84-94): Confirms stable behavior when NODE_OPTIONS is undefined, adding only the required memory flag

## Testing Patterns
- **Stability Focus**: Each test calls `buildAdapterCommand()` multiple times to verify idempotent behavior
- **Environment Isolation**: Tests manipulate NODE_OPTIONS but verify original process.env remains unchanged
- **Cross-Platform**: Uses conditional paths for Windows vs Unix systems
- **Assertion Strategy**: Validates both adapter path correctness and NODE_OPTIONS normalization

## Dependencies
- `@debugmcp/shared` types for AdapterConfig and AdapterDependencies
- JavascriptDebugAdapter from main package source (L2)
- Vitest testing utilities for mocking and environment management
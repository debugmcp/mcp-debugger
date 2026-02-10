# tests/test-utils/mocks/fs-extra.ts
@source-hash: 492f3e084e15adce
@generated: 2026-02-10T00:41:26Z

## Purpose
Mock implementation for the `fs-extra` library used in Vitest test environments. Provides stubbed filesystem operations to avoid actual file system interactions during testing.

## Key Components

**fsExtraMock object (L3-7)**
- Mock object containing stubbed implementations of fs-extra functions
- `ensureDir`: Mock function returning resolved void promise (L4)
- `pathExists`: Mock function returning resolved true promise (L5)
- Designed for easy extension with additional fs-extra methods as needed

**Mock Configuration (L10-11)**
- Explicit configuration of mock return values using Vitest's `mockResolvedValue`
- `ensureDir` configured to resolve with `undefined` (L10)
- `pathExists` configured to resolve with `true` (L11)

## Dependencies
- **vitest**: Testing framework providing `vi.fn()` mock utilities (L1)

## Usage Pattern
This mock follows the common pattern of:
1. Creating mock functions with default implementations
2. Explicitly setting resolved values for async operations
3. Exporting as default for module replacement in test environments

## Architectural Notes
- Async-first design - all mocked functions return promises
- Optimistic defaults - `pathExists` always returns `true`, `ensureDir` always succeeds
- Extensible structure - comment indicates easy addition of other fs-extra functions (L6)
- Uses Vitest's mock system rather than manual function stubs
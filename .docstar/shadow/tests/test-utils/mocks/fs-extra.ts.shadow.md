# tests/test-utils/mocks/fs-extra.ts
@source-hash: 492f3e084e15adce
@generated: 2026-02-09T18:14:35Z

## Purpose
Mock module for the `fs-extra` library used in Vitest test environments. Provides stubbed implementations of filesystem operations to avoid actual file system interactions during testing.

## Key Components
- **fsExtraMock object (L3-7)**: Main mock object containing stubbed fs-extra functions
- **ensureDir mock (L4)**: Async function mock that simulates directory creation, returns resolved void promise
- **pathExists mock (L5)**: Async function mock that simulates path existence checking, always returns true
- **Mock setup (L10-11)**: Explicit configuration of mock return values using Vitest's mockResolvedValue

## Dependencies
- **vitest**: Uses `vi.fn()` for creating function mocks
- **fs-extra**: Target library being mocked (implicit dependency)

## Architecture Notes
- Uses Vitest's mocking system with `vi.fn()` for creating spy functions
- Follows pattern of creating mock object first, then configuring return values
- Designed for import/export as default module replacement
- Extensible structure (comment L6 indicates more functions can be added)

## Key Characteristics
- All mocked functions are async and return resolved promises
- `pathExists` always returns `true` (optimistic mocking)
- `ensureDir` returns `undefined` (standard void promise resolution)
- Ready for ES module replacement in test environments
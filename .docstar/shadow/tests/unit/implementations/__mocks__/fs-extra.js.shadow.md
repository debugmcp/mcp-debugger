# tests/unit/implementations/__mocks__/fs-extra.js
@source-hash: f78c204afdcadf12
@generated: 2026-02-09T18:14:22Z

## Purpose
Manual Vitest mock for the `fs-extra` library, providing mocked filesystem operations for unit tests. This file replaces the real `fs-extra` module during testing to enable controlled testing of filesystem interactions without actual file system operations.

## Key Exports
- **Individual mocked functions (L4-23)**: All major `fs-extra` functions as Vitest mock functions (`vi.fn()`):
  - File operations: `access`, `readFile`, `writeFile`, `stat`, `unlink` 
  - Directory operations: `ensureDir`, `mkdir`, `rmdir`, `readdir`, `ensureDirSync`
  - Stream operations: `createReadStream`, `createWriteStream`
  - Utility operations: `pathExists`, `existsSync`, `remove`, `copy`, `move`
  - JSON operations: `outputJson`, `readJson`
  - Enhanced operations: `outputFile`

- **Default export object (L26-49)**: `mockFsExtra` object containing all the same mocked functions for compatibility with different import styles

## Architecture
Uses Vitest's `vi.fn()` to create mock functions that can be programmatically controlled in tests. Supports both named imports (`import { readFile } from 'fs-extra'`) and default imports (`import fs from 'fs-extra'`) through dual export pattern.

## Dependencies
- `vitest`: Testing framework providing the `vi.fn()` mock utility (L2)

## Usage Context
Located in `__mocks__` directory following Jest/Vitest convention for manual mocks. Automatically replaces `fs-extra` imports in test files when mocking is enabled.
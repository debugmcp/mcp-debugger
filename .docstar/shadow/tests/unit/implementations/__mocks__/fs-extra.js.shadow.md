# tests/unit/implementations/__mocks__/fs-extra.js
@source-hash: f78c204afdcadf12
@generated: 2026-02-10T00:41:18Z

## Purpose
Manual mock implementation of the `fs-extra` library for Vitest testing framework. Provides comprehensive filesystem operation mocking capabilities to isolate unit tests from actual filesystem interactions.

## Architecture
- **Mock Functions (L4-23)**: Individual Vitest mock functions (`vi.fn()`) for each fs-extra method
- **Default Export Object (L26-47)**: Aggregated object containing all mock functions for compatibility with different import styles

## Key Mock Functions
- **File Operations**: `readFile`, `writeFile`, `outputFile` (L6,7,16)
- **Directory Operations**: `ensureDir`, `mkdir`, `rmdir`, `ensureDirSync` (L8,20,21,23)
- **Path Utilities**: `access`, `pathExists`, `existsSync`, `stat` (L4,5,19,12)
- **File Management**: `remove`, `unlink`, `copy`, `move` (L9,22,14,15)
- **Stream Operations**: `createReadStream`, `createWriteStream` (L10,11)
- **JSON Operations**: `outputJson`, `readJson` (L17,18)
- **Directory Listing**: `readdir` (L13)

## Import Compatibility
Supports both named imports (`import { readFile } from 'fs-extra'`) and default imports (`import fsExtra from 'fs-extra'`) through dual export pattern.

## Dependencies
- `vitest`: Testing framework providing `vi.fn()` mock function factory (L2)

## Testing Integration
Located in `__mocks__` directory following Jest/Vitest convention for automatic mock resolution. When tests import `fs-extra`, this mock will be used instead of the actual library, enabling predictable test behavior without filesystem side effects.
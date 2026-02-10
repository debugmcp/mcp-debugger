# packages/shared/src/interfaces/filesystem.ts
@source-hash: ad700ed7abc5419c
@generated: 2026-02-09T18:14:10Z

## Purpose and Responsibility

This file provides a filesystem abstraction layer designed for dependency injection, enabling filesystem operations to be mocked during testing. It follows a similar pattern to CommandFinder for the Python adapter, providing a clean interface for file system interactions.

## Key Interfaces and Classes

**FileSystem Interface (L23-38)**: Core abstraction defining two essential filesystem operations:
- `existsSync(path: string): boolean` - Synchronous path existence checking
- `readFileSync(path: string, encoding: string): string` - Synchronous file reading with encoding support

**NodeFileSystem Class (L43-68)**: Production implementation of FileSystem interface
- Uses dynamic `require('fs')` through constructor injection (L46-48)
- Implements defensive programming with try-catch blocks that return safe defaults (false for existence checks, empty string for read failures)
- Handles TypeScript BufferEncoding casting requirement (L62)

## Key Functions

**setDefaultFileSystem(fileSystem: FileSystem) (L79-81)**: Dependency injection setter for testing scenarios
**getDefaultFileSystem(): FileSystem (L87-89)**: Getter for current filesystem implementation

## Important Dependencies

- `createRequire` from Node.js 'module' for ES module compatibility (L9, L14-18)
- `pathToFileURL` from Node.js 'url' as fallback mechanism (L10, L17)
- Dynamic `require('fs')` loaded at runtime rather than static import (L47)

## Notable Architectural Decisions

1. **ES Module Compatibility**: Uses `createRequire` with robust fallback handling when `import.meta.url` is unavailable (L14-18)
2. **Error Resilience**: All filesystem operations use try-catch with sensible defaults rather than throwing errors
3. **Singleton Pattern**: Maintains a default instance (L73) with getter/setter for dependency injection
4. **Late Binding**: Filesystem module loaded in constructor rather than at module level, enabling better testability

## Critical Invariants

- `readFileSync` always returns a string (empty on error, never throws)
- `existsSync` always returns a boolean (false on error, never throws) 
- Default filesystem instance is always available and non-null
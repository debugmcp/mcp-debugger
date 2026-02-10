# packages/shared/src/interfaces/filesystem.ts
@source-hash: ad700ed7abc5419c
@generated: 2026-02-10T00:41:08Z

**Purpose**: Provides filesystem abstraction interface for dependency injection, enabling filesystem operations to be mocked in tests while maintaining a production implementation using Node.js fs module.

**Key Components**:

- `FileSystem` interface (L23-38): Defines contract for basic filesystem operations
  - `existsSync(path: string): boolean` (L29): Synchronous path existence check
  - `readFileSync(path: string, encoding: string): string` (L37): Synchronous file reading with text encoding

- `NodeFileSystem` class (L43-68): Production implementation of FileSystem interface
  - Constructor (L46-48): Initializes with Node.js fs module via require
  - `existsSync()` (L50-57): Wraps fs.existsSync with error handling, returns false on any error
  - `readFileSync()` (L59-67): Wraps fs.readFileSync with BufferEncoding cast and error handling, returns empty string on failure

**Global State Management**:
- `defaultFileSystem` variable (L73): Module-level singleton holding current FileSystem instance
- `setDefaultFileSystem()` (L79-81): Setter for dependency injection, primarily for testing
- `getDefaultFileSystem()` (L87-89): Getter for current default implementation

**Dependencies**:
- Node.js `module` and `url` modules for ES module compatibility (L9-10)
- Dynamic require setup (L14-18) with fallback for environments lacking import.meta.url
- Node.js `fs` module loaded dynamically in NodeFileSystem constructor

**Architectural Patterns**:
- Dependency injection pattern enabling test mocking
- Error-safe operations with graceful fallbacks (false/empty string)
- ES module compatibility layer for CommonJS interop
- Singleton pattern for default filesystem instance

**Error Handling Strategy**: All filesystem operations catch exceptions and return safe default values rather than propagating errors, prioritizing robustness over error reporting.
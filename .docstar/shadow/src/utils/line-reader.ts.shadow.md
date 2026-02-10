# src/utils/line-reader.ts
@source-hash: 3d0c0bd5074725c7
@generated: 2026-02-09T18:15:07Z

## Purpose
Provides efficient file line reading with LRU caching for debugging operations like breakpoint context and source analysis. Handles binary file detection, size limits, and surrounding context extraction.

## Key Interfaces
- **LineContext** (L11-17): Container for line content and surrounding context lines with line numbers
- **LineReaderOptions** (L22-26): Configuration for context lines (default: 2), max file size (default: 10MB), and encoding (default: utf8)

## Core Class
**LineReader** (L31-204): Main utility class for cached line reading
- Constructor (L38-41): Takes IFileSystem and optional logger
- File cache (L32-36): LRU cache storing up to 20 files for 5 minutes

### Private Methods
- **isBinaryContent** (L46-66): Detects binary files via null bytes and non-printable character ratio (>30% threshold)
- **readFileLines** (L71-115): Core caching method that reads, validates, and caches file content as line arrays

### Public Methods
- **getLineContext** (L120-159): Returns specific line with surrounding context based on contextLines option
- **getMultiLineContext** (L164-186): Extracts line ranges for stack traces and multi-line debugging
- **clearCache** (L191-194): Clears LRU cache
- **getCacheStats** (L199-204): Returns cache size and item count

## Key Dependencies
- `@debugmcp/shared/IFileSystem`: File system abstraction for reading files and stats
- `lru-cache`: Provides TTL-based LRU caching with configurable limits

## Architectural Decisions
- 1-based line numbering in public API, 0-based internally
- Handles various line endings (`\r?\n`)
- Rejects files over size limit or binary content
- Validates line number bounds before access
- Comprehensive error handling with null returns

## Critical Invariants
- Line numbers are 1-based in all public APIs
- Cache key is file path string
- Binary files and oversized files return null
- Empty files are treated as invalid (return null)
- Context calculations ensure bounds safety
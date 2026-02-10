# src/utils/line-reader.ts
@source-hash: 3d0c0bd5074725c7
@generated: 2026-02-10T00:41:56Z

## Purpose
File reading utility optimized for source code context operations with LRU caching and binary file detection. Primary use case is extracting line context for breakpoints and stack trace visualization in debugging scenarios.

## Core Interfaces
- **LineContext (L11-17)**: Encapsulates target line content plus surrounding context lines with line numbers
- **LineReaderOptions (L22-26)**: Configuration for context window size (default: 2 lines), max file size (10MB), and encoding (utf8)

## Main Class: LineReader (L31-205)
Central utility class with LRU cache (20 files, 5min TTL) for performance optimization.

### Key Methods
- **getLineContext() (L120-159)**: Primary method returning line content with surrounding context. Handles 1-based line numbering, validates bounds, returns null for invalid requests
- **getMultiLineContext() (L164-186)**: Extracts contiguous line ranges, useful for stack traces. Auto-clamps to valid bounds
- **readFileLines() (L71-115)**: Private cached file reader with size limits and binary detection
- **isBinaryContent() (L46-66)**: Heuristic binary detection using null bytes and non-printable character ratio (>30%)

### Cache Management
- **clearCache() (L191-194)**: Manual cache invalidation
- **getCacheStats() (L199-204)**: Cache inspection for monitoring

## Dependencies
- **IFileSystem**: Abstraction for file operations (stat, readFile)
- **LRUCache**: Performance optimization for repeated file access
- Optional logger for debugging file operations

## Key Behaviors
- 1-based line numbering for external API, 0-based internally
- Graceful degradation: returns null for binary files, oversized files, or read errors
- Preserves empty lines in content splitting
- Automatic encoding detection with utf8 default
- Size-based rejection (configurable, 10MB default)

## Critical Constraints
- Files exceeding maxFileSize are rejected without caching
- Binary files detected via null bytes or >30% non-printable chars are rejected
- Line numbers outside file bounds return null rather than throwing
- Cache TTL prevents stale content issues in long-running processes
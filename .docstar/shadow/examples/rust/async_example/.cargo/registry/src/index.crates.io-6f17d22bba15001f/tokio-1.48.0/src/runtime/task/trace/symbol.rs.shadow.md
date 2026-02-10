# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/task/trace/symbol.rs
@source-hash: bde671f445b351d3
@generated: 2026-02-09T17:58:19Z

## Purpose
Provides a hashable wrapper around `backtrace::BacktraceSymbol` for use in Tokio's async task tracing system. Enables backtrace symbols to be stored in hash-based collections while maintaining position context within traces.

## Key Components

### Symbol struct (L19-22)
Wrapper around `BacktraceSymbol` with additional `parent_hash` field for unique identification within trace hierarchy. The `parent_hash` distinguishes between recursive function calls at different stack depths.

### Hash implementation (L24-42)
Custom hash implementation that combines:
- Symbol name bytes (L29-31)
- Symbol address via `ptr::hash` (L33-35)  
- Filename, line number, column number (L37-39)
- Parent hash for trace position (L40)

### PartialEq implementation (L44-61)
Comprehensive equality checking across all symbol attributes:
- Parent hash equality (L46)
- Name comparison via byte arrays (L47-51)
- Address comparison via pointer equality (L52-56)
- Filename, line, and column equality (L57-59)

### Display implementation (L65-92)
Formats symbol for human-readable output:
- Extracts and displays function name, removing module path if present (L67-75)
- Appends file location with "at filename:line:col" format (L77-88)

## Dependencies
- `backtrace::BacktraceSymbol` - core symbol representation from backtrace crate
- Standard library traits: `Hash`, `PartialEq`, `Eq`, `fmt::Display`

## Design Patterns
- Newtype pattern wrapping `BacktraceSymbol` to add missing traits
- Comprehensive equality/hash implementation covering all symbol metadata
- Optional field handling throughout (names, addresses, locations may be None)
- Position-aware hashing via `parent_hash` for trace context preservation
# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/task/trace/tree.rs
@source-hash: f1c989a80de1a45c
@generated: 2026-02-09T17:58:21Z

## Purpose
This module provides tree representation and visualization for execution traces in Tokio's task tracing system. It converts linear backtraces into hierarchical tree structures for better debugging visualization.

## Core Components

### Tree struct (L11-19)
Adjacency list representation of execution traces with:
- `roots`: HashSet of root symbols (typically single root but supports multiple)
- `edges`: HashMap mapping each symbol to its child symbols

### Key Methods

#### Tree::from_trace() (L23-44)
Primary constructor that converts a `Trace` into a `Tree`:
- Iterates through backtraces and converts each to `SymbolTrace` via `to_symboltrace()`
- Identifies root symbols (first symbol in each trace)
- Builds parent-child relationships by linking consecutive symbols in traces
- Uses peekable iterator pattern to establish adjacency relationships

#### Tree::consequences() (L47-49)
Returns iterator over child symbols for a given parent symbol. Uses Option chaining for safe HashMap access.

#### Tree::display() (L52-90)
Recursive tree formatter with Unicode box-drawing characters:
- Uses `├╼` for non-terminal nodes, `└╼` for terminal nodes
- Manages prefix strings for proper indentation
- Complex character manipulation (L72-77) strips first two characters from formatted strings

#### fmt::Display implementation (L92-99)
Public interface that calls `display()` for each root with base formatting.

## Utility Functions

### to_symboltrace() (L103-126)
Converts raw backtrace frames into Symbol sequences:
- Resolves backtrace symbols using backtrace crate
- Reverses iteration order for proper call stack representation
- Uses `DefaultHasher` to generate unique parent hashes for symbol identification
- Creates `Symbol` structs with resolved symbol info and parent context

## Dependencies
- std collections (HashMap, HashSet, DefaultHasher)
- super module types: Backtrace, Symbol, SymbolTrace, Trace
- backtrace crate for symbol resolution

## Architecture Notes
- Tree construction is eager (processes all traces upfront)
- Uses hash-based symbol identification to handle duplicate symbols in different contexts
- Supports forest structure (multiple roots) for robustness
- Display formatting uses non-breaking spaces (\u{a0}) for proper alignment
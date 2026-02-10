# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/proc-macro2-1.0.103/src/extra.rs
@source-hash: 29f094473279a29b
@generated: 2026-02-09T18:11:43Z

## Purpose
Provides additional APIs for proc-macro2 that don't exist in the standard `proc_macro` crate, primarily span management utilities for handling large-scale source code processing.

## Key Components

### invalidate_current_thread_spans() (L73-75)
**Purpose**: Clears thread-local span data structures to prevent wraparound issues when processing >4GB of source code on a single thread.

**Critical Details**:
- Only available with `span_locations` feature
- Panics if called from within a procedural macro
- Necessary because proc-macro2 uses 32-bit source locations that wrap after 4GB
- Example use case: parsing all crates.io code (200GB total, 16GB latest versions)

### DelimSpan struct (L82-85)
**Purpose**: Compact representation of a `Group`'s opening and closing spans together.

**Fields**:
- `inner: DelimSpanEnum` - Internal span representation
- `_marker: ProcMacroAutoTraits` - Auto-trait marker

### DelimSpanEnum (L88-96)
**Purpose**: Internal enum handling both compiler and fallback span implementations.

**Variants**:
- `Compiler` (L90-94) - Holds compiler spans (join, open, close) when `wrap_proc_macro` enabled
- `Fallback` (L95) - Uses fallback span implementation

### Key Methods

#### DelimSpan::new() (L99-117)
**Purpose**: Constructor that extracts span information from a `Group`.
- Conditionally compiles different implementations based on `wrap_proc_macro` feature
- Stores join, open, and close spans for compiler variant
- Uses single span for fallback variant

#### DelimSpan::join() (L120-126)
**Purpose**: Returns span covering entire delimited group.

#### DelimSpan::open() (L129-135)
**Purpose**: Returns span for opening punctuation only.
- Uses `first_byte()` for fallback implementation

#### DelimSpan::close() (L138-144)
**Purpose**: Returns span for closing punctuation only.
- Uses `last_byte()` for fallback implementation

## Dependencies
- `crate::fallback` - Fallback span implementation
- `crate::imp` - Core implementation types
- `crate::marker` - Auto-trait markers
- `crate::Span` - Main span type

## Architectural Patterns
- Feature-gated compilation (`span_locations`, `wrap_proc_macro`)
- Dual implementation strategy (compiler vs fallback)
- Marker-based auto-trait management
- Efficient span storage optimization
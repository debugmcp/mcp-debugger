# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/proc-macro2-1.0.103/src/wrapper.rs
@source-hash: 057b7baa778e8205
@generated: 2026-02-09T18:11:50Z

This file provides wrapper abstractions that unify the native `proc_macro` API with a fallback implementation, allowing proc-macro2 to work both inside and outside of procedural macros.

## Primary Purpose
Implements dual-mode token processing by wrapping either the compiler's native `proc_macro` types or fallback implementations, with runtime detection to choose the appropriate variant.

## Key Enums and Wrapper Types

### TokenStream (L20-24)
Core enum wrapping either `DeferredTokenStream` (compiler) or `fallback::TokenStream`. Provides unified interface for token stream operations regardless of execution context.

### DeferredTokenStream (L30-34) 
Performance optimization wrapper for compiler token streams that defers expensive `extend` operations by batching tokens in `extra` vector. Key methods:
- `evaluate_now` (L70-77): Flushes deferred tokens to underlying stream
- `into_token_stream` (L79-82): Consumes wrapper and returns native stream

### LexError (L36-43)
Unified error type wrapping compiler/fallback lex errors, plus `CompilerPanic` variant for rustc panic workaround (issue #58736).

### Core Token Types
- **Span** (L369-373): Location information wrapper
- **Group** (L557-561): Delimiter grouping wrapper  
- **Ident** (L662-666): Identifier wrapper
- **Literal** (L757-761): Literal value wrapper

## Runtime Dispatch Pattern
All wrapper types use `inside_proc_macro()` detection to choose implementation:
- Inside proc macros: Use native `proc_macro` types
- Outside proc macros: Use fallback implementations

## Key Implementation Details

### Performance Optimization (L26-29, L70-77)
DeferredTokenStream addresses Rust issue #65080 by batching `Extend` operations. Comments indicate 6% performance improvement in winrt macro expansion.

### Mismatch Handling (L45-56)
Cold path function `mismatch()` panics when compiler/fallback variants are incorrectly mixed, with optional backtrace support.

### Type Conversions
- `unwrap_nightly()` methods extract compiler types (panic on fallback)
- `unwrap_stable()` methods extract fallback types (panic on compiler)
- Extensive `From` trait implementations for seamless conversions

### Literal Factory Methods (L763-915)
Macro-generated methods for creating numeric literals:
- `suffixed_numbers!` (L763-773): Creates typed literals with suffix
- `unsuffixed_integers!` (L775-785): Creates untyped integer literals
- Special handling for floating-point, string, character, and byte literals

## Conditional Compilation
Heavy use of feature flags:
- `span_locations`: Enable span location tracking
- `proc_macro_span*`: Various span-related capabilities
- `super_unstable`: Unstable proc_macro features
- `no_*`: Disable specific literal types on older compilers

## Notable Invariants
- Compiler and fallback variants must not be mixed (enforced by `mismatch()`)
- All operations maintain span information across wrapper boundaries
- Deferred token streams must call `evaluate_now()` before conversion
# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/proc-macro2-1.0.103/src/
@generated: 2026-02-09T18:16:29Z

## Primary Purpose

This directory contains the core implementation of proc-macro2, a compatibility shim and wrapper that provides portable procedural macro APIs. The library enables proc-macro-like functionality in non-procedural-macro contexts (main.rs, build.rs, unit tests) and bridges differences between compiler versions by providing both native proc_macro wrappers and pure Rust fallback implementations.

## Architecture Overview

The codebase uses a **dual-mode architecture** with runtime detection:

1. **Detection Layer** (`detection.rs`): Thread-safe detection of whether code is running inside a procedural macro context, using either modern `proc_macro::is_available()` or legacy panic-based detection
2. **Wrapper Mode** (`wrapper.rs`): When inside proc macros, wraps native `proc_macro` types with additional functionality 
3. **Fallback Mode** (`fallback.rs`): When outside proc macros, provides complete pure Rust reimplementation of token stream APIs
4. **Unified Interface** (`lib.rs`): Public API that abstracts over both modes seamlessly

## Key Components & Data Flow

### Core Token Processing Pipeline
- **Parsing** (`parse.rs`): Tokenizes Rust source code into token trees, handling all literal types, identifiers, punctuation, and nested delimiters
- **Storage** (`rcvec.rs`): Reference-counted vectors with copy-on-write semantics for efficient token tree sharing
- **Span Management**: Position tracking through either native spans or fallback location system (`location.rs`)

### Feature Adaptation System
- **Probe Directory**: Compile-time feature detection for various `proc_macro::Span` APIs across Rust versions
- **Conditional Compilation**: Extensive use of cfg flags to adapt to different compiler capabilities
- **Version Compatibility**: Handles API differences from legacy Rust through cutting-edge nightly features

### Token Type Hierarchy
All token types (TokenStream, Group, Ident, Punct, Literal, Span) exist in dual implementations with unified public interfaces, automatic trait derivations via marker types (`marker.rs`), and comprehensive factory methods for literal construction.

## Public API Surface

### Main Entry Points
- **TokenStream**: Core token sequence type with parsing, iteration, and conversion capabilities
- **TokenTree**: Individual token enum (Group/Ident/Punct/Literal) with span information
- **Span**: Source location and hygiene tracking with optional position methods

### Factory Functions
- **Literal constructors**: Type-specific methods for all Rust literal types (integers, floats, strings, characters, bytes)
- **Span constructors**: `call_site()`, `mixed_site()`, `def_site()` for different hygiene contexts
- **Parsing utilities**: `FromStr` implementations and explicit parsing functions

### Advanced Features
- **DelimSpan** (`extra.rs`): Detailed span information for opening/closing delimiters
- **Thread management**: `invalidate_current_thread_spans()` for large-scale processing
- **String literal utilities** (`rustc_literal_escaper.rs`): Comprehensive escape sequence handling

## Critical Design Patterns

### Runtime Mode Selection
Uses atomic flags and lazy initialization to choose between compiler and fallback implementations without runtime overhead after initialization.

### Memory Management
Reference-counted token storage with copy-on-write semantics prevents deep copying while allowing mutation when needed.

### Error Handling
Unified error types that wrap both compiler and fallback errors, with fallback to pure Rust implementations when compiler panics.

### Feature Gating
Extensive conditional compilation ensures APIs are only available when the underlying Rust version supports them, maintaining compatibility from stable to nightly.

## Internal Organization

The module provides a complete token processing ecosystem that seamlessly bridges the gap between native procedural macro contexts and ordinary Rust compilation, making procedural macros testable and enabling macro-like functionality throughout the Rust compilation pipeline.
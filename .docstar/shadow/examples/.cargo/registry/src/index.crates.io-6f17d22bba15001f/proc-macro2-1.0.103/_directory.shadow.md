# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/proc-macro2-1.0.103/
@generated: 2026-02-09T18:16:53Z

## Overall Purpose and Responsibility

This directory contains the complete implementation of **proc-macro2**, a foundational Rust crate that provides portable procedural macro APIs. The library serves as a compatibility shim that enables proc-macro-like functionality in any Rust context (main.rs, build.rs, unit tests, regular libraries) while maintaining seamless integration with the standard library's `proc_macro` types when available.

## Key Components and Architecture

### Dual-Mode Runtime Architecture
The crate employs a sophisticated **detection and adaptation system**:

- **Build-Time Feature Detection** (`build.rs`): Probes compiler capabilities and emits configuration flags for conditional compilation based on Rust version and available proc_macro APIs
- **Runtime Mode Selection** (`src/detection.rs`): Thread-safe detection of procedural macro context availability using atomic flags and lazy initialization
- **Wrapper Mode** (`src/wrapper.rs`): When inside proc macros, provides thin wrappers around native `proc_macro` types with enhanced functionality
- **Fallback Mode** (`src/fallback.rs`): Complete pure Rust reimplementation for non-proc-macro contexts
- **Unified Public Interface** (`src/lib.rs`): Seamless abstraction that automatically selects appropriate backend

### Core Token Processing Pipeline
- **Lexical Analysis** (`src/parse.rs`): Full Rust tokenizer handling all literal types, identifiers, punctuation, and nested delimiter structures
- **Memory Management** (`src/rcvec.rs`): Reference-counted vectors with copy-on-write semantics for efficient token tree sharing and mutation
- **Position Tracking** (`src/location.rs` + span systems): Comprehensive source location and hygiene context management
- **String Processing** (`src/rustc_literal_escaper.rs`): Complete escape sequence handling matching rustc behavior

## Public API Surface

### Primary Entry Points
- **`TokenStream`**: Core token sequence type with parsing, iteration, formatting, and conversion capabilities
- **`TokenTree`**: Individual token enum (Group/Ident/Punct/Literal) with span information and hierarchical structure
- **`Span`**: Source location tracking with hygiene contexts (`call_site()`, `mixed_site()`, `def_site()`)

### Factory and Utility APIs
- **Literal Constructors**: Type-specific factory methods for all Rust literal types (integers, floats, strings, characters, bytes, C-strings)
- **Parsing Interface**: `FromStr` implementations and explicit parsing functions for converting source code to token streams
- **Advanced Features**: DelimSpan for delimiter-specific spans, thread management utilities, semver-exempt APIs

### Integration Points
- **Procedural Macro Compatibility**: Drop-in replacement for `proc_macro` types when building proc macros
- **Testing Support**: Enables unit testing of procedural macro logic outside of macro contexts
- **Build Script Usage**: Allows token manipulation in build.rs and other non-macro compilation phases

## Internal Organization and Data Flow

### Feature Adaptation System
The crate uses extensive conditional compilation to adapt across Rust versions:
- Compiler version detection enables progressive API enhancement
- Feature flags control access to experimental or version-gated functionality
- Probe-based compilation testing ensures accurate capability detection

### Token Type Hierarchy
All major types exist in dual implementations with:
- Unified public interfaces hiding implementation details
- Automatic trait derivations via marker type system
- Consistent error handling across wrapper and fallback modes
- Memory layout optimization and size tracking

### Quality Assurance Framework
Comprehensive testing validates:
- API compatibility with stdlib proc_macro types
- String representation consistency
- Memory layout stability across compilation modes
- Feature flag isolation and conditional API surface
- Edge case handling and error recovery

## Critical Design Patterns

### Zero-Cost Abstraction
After initialization, runtime overhead is eliminated through compile-time mode selection and efficient memory management patterns.

### Progressive Enhancement
APIs gracefully degrade based on compiler capabilities while maintaining functional compatibility, enabling the same code to work across stable and nightly Rust versions.

### Hybrid Implementation Strategy
Combines the reliability of stdlib implementations when available with the flexibility of pure Rust fallbacks, providing the best of both worlds for procedural macro development and testing.

This crate serves as the foundational layer for Rust's procedural macro ecosystem, enabling portable, testable, and version-agnostic token manipulation while maintaining perfect compatibility with the standard library's proc_macro infrastructure.
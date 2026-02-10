# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/proc-macro2-1.0.103/
@generated: 2026-02-09T18:16:16Z

## Purpose and Overview

This directory contains the complete source distribution of `proc-macro2` version 1.0.103, a critical Rust crate that provides a stable, version-independent wrapper around Rust's procedural macro system. The library serves as essential infrastructure for the Rust macro ecosystem by abstracting over compiler version differences and providing a consistent API surface.

## Key Components and Integration

The directory is organized into three main components that work together to provide robust cross-version compatibility:

### Build System (`build.rs`)
The build script serves as the intelligence layer that:
- Detects the current Rust compiler version and available features at compile time
- Probes for specific proc-macro capabilities using test compilation
- Configures conditional compilation flags based on detected features
- Handles special cases like `RUSTC_BOOTSTRAP` environments and compiler self-bootstrap

### Core Library (`src/`)
Contains the main library implementation that:
- Provides the stable `proc-macro2` API (TokenStream, TokenTree, Group, Ident, Punct, Literal)
- Implements version-bridging logic using conditional compilation
- Includes a feature detection system (`probe/` subdirectory) for runtime capability testing
- Maintains zero-cost abstractions when possible

### Test Suite (`tests/`)
Validates the library's functionality across different compiler configurations and ensures API stability.

## Public API Surface

The library exposes a stable procedural macro API that mirrors Rust's built-in `proc_macro` but with enhanced compatibility:
- `TokenStream` - Stable token stream handling
- Core token types (Group, Ident, Punct, Literal)
- Parsing and formatting utilities
- Span manipulation and source location features (when available)

## Data Flow and Architecture

1. **Build-time Configuration**: `build.rs` probes compiler capabilities and sets feature flags
2. **Conditional Compilation**: Source code uses these flags to enable/disable functionality
3. **API Abstraction**: Public API remains stable regardless of underlying compiler differences
4. **Runtime Adaptation**: Library adapts behavior based on compile-time detected features

## Key Patterns

- **Version Bridging**: Maintains API stability across Rust compiler versions (handles differences from rustc 1.57 to latest)
- **Feature Probing**: Uses compile-time detection rather than version checks for robust compatibility
- **Graceful Degradation**: Disables advanced features on older compilers while maintaining core functionality
- **Bootstrap Safety**: Special handling for Rust compiler self-compilation scenarios

This crate is foundational infrastructure that enables procedural macros to be portable and reliable across the Rust ecosystem, serving as the de facto standard for proc-macro compatibility layers.
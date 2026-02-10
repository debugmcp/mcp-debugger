# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/macros.rs
@source-hash: ba63c9018fe21b20
@generated: 2026-02-09T18:11:44Z

This file defines essential utility macros for the libc crate, providing conditional compilation capabilities and standardized type derivation patterns for C interoperability.

## Primary Purpose
Collection of declarative macros that simplify cross-platform C bindings by automating conditional compilation, trait derivation, and C-compatible type definitions.

## Core Macros

### `cfg_if` (L9-62)
A cascade conditional compilation macro that emulates C preprocessor `#if/elif/else` chains. Matches the first `#[cfg]` condition and emits only that implementation block, avoiding redundant conditional clauses. Uses internal recursive helpers `@__items` and `@__apply` for pattern matching and attribute application.

### `prelude` (L65-102)  
Establishes a standardized internal module structure with common core type re-exports (`Clone`, `Copy`, `Send`, `Sync`, etc.) and C primitive types (`c_char`, `c_int`, `size_t`, etc.). Creates consistent namespace for platform-specific implementations.

### Structure Definition Macros
- `s` (L109-138): Defines C-compatible structs with `#[repr(C)]` and conditional trait derivation based on `extra_traits` feature. Automatically derives `Clone`, `Copy`, `Debug`, and optionally `Eq`, `Hash`, `PartialEq`. Prevents union usage via compile-time error.
- `s_paren` (L144-163): Identical to `s` but for tuple structs
- `s_no_extra_traits` (L169-204): Struct/union variant that only derives basic traits (`Clone`, `Copy`, `Debug`), excluding comparison traits. Provides custom `Debug` implementation for unions using `finish_non_exhaustive()`.

### Enum Definition Macros
- `missing` (L208-217): Creates empty enums without any derived traits, explicitly allowing missing `Copy` implementations
- `e` (L222-241): Standard enum macro with conditional `extra_traits` derivation (deprecated in favor of `c_enum`)
- `c_enum` (L250-297): Advanced C enum emulation using type aliases and constants instead of Rust enums to handle C's duplicate values and arbitrary representations. Generates sequential values with explicit override support.

### Function Definition Macros
- `f` (L300-314): Generates `unsafe extern "C"` functions with optional `const` support
- `safe_f` (L317-331): Generates safe `extern "C"` functions with optional `const` support

### Utility Macros
- `__item` (L333-337): Simple pass-through for item expansion
- `deprecated_mach` (L340-371): Deprecation wrapper for items migrated to `mach2` crate

## Key Dependencies
- `core::` modules for fundamental traits and types
- `crate::types::{CEnumRepr, Padding}` for C-compatible type representations
- Feature flag `extra_traits` controls trait derivation scope

## Architectural Patterns
- Extensive use of nested macro patterns with internal helpers (prefixed `@__`)
- Conditional compilation through `cfg_attr` for feature-dependent behavior
- C ABI compatibility enforced through `#[repr(C)]` and `extern "C"`
- Recursive macro expansion for complex pattern matching

## Test Coverage (L374-446)
Comprehensive tests for `c_enum` macro validating sequential value assignment, explicit value overrides, type representation, and duplicate value handling.
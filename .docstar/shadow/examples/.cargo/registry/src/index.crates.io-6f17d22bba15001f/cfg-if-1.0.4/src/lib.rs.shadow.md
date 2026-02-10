# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/cfg-if-1.0.4/src/lib.rs
@source-hash: c09723e0890d1581
@generated: 2026-02-09T18:11:30Z

## Purpose
This is a no-std Rust crate providing the `cfg_if!` macro for conditional compilation. The macro allows cascading `#[cfg]` conditions similar to C preprocessor if/elif chains, emitting only the first matching implementation.

## Key Components

### `cfg_if!` Macro (L34-96)
The primary macro with two main patterns:
- **Entry pattern (L34-54)**: Accepts if/else-if/else syntax with `#[cfg]` conditions and transforms into internal representation
- **Internal recursive pattern (L61-90)**: Processes the conditional chains by:
  - Collecting previous cfg conditions to negate them in subsequent branches
  - Applying `#[cfg(all(...))]` with positive conditions AND negation of all previous conditions
  - Using `@__temp_group` helper to ensure all tokens in a block are properly grouped under one cfg attribute
- **Helper pattern (L93-95)**: `@__temp_group` unwraps token sequences to solve the "issue #90" problem where cfg attributes only applied to first item in a block

## Architecture & Logic
The macro implements a two-phase transformation:
1. Parse user-friendly if/else-if/else syntax into structured token lists
2. Recursively emit each branch with cumulative negation logic ensuring mutual exclusivity

The negation strategy ensures only one branch can be active: each subsequent condition must match its positive cfg AND negate all previous conditions.

## Dependencies
- `#![no_std]` - No standard library dependency
- Uses only `core` module for internal operations

## Test Coverage (L98-212)
Comprehensive tests demonstrating:
- Basic conditional compilation (L100-140)
- Multiple item handling per branch (L147-155) - addresses "issue #90"
- Usage within functions (L181-193)
- Usage within trait implementations (L203-211)
- Edge cases with non-existent target configurations

## Critical Invariants
- Each branch condition automatically excludes all previous branch conditions
- All tokens within a cfg block are grouped together to prevent partial application of cfg attributes
- The macro is fully recursive and handles arbitrary nesting depth
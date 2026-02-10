# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/macros/try_join.rs
@source-hash: b1c7e416685bc19c
@generated: 2026-02-09T18:06:42Z

## Purpose
Documentation and implementation file for Tokio's `try_join!` macro - a concurrent async execution utility that waits for multiple futures to complete successfully or returns on first error.

## Key Components

### Documentation Generator (L1-157)
- `doc!` macro_rules that wraps the actual implementation with comprehensive documentation
- Provides extensive usage examples and behavioral explanations
- Documents concurrency vs parallelism characteristics, fairness, and biased polling modes

### Documentation-Only Stub (L159-162)
- Minimal stub definition used only when building documentation (`#[cfg(doc)]`)
- Shows macro signature but contains `unimplemented!()` placeholder

### Core Implementation (L164-283)
Main `try_join!` macro with sophisticated multi-stage expansion:

**Entry Points (L272-282):**
- `biased; expr,+` - deterministic polling order using `SelectBiased`
- `expr,+` - fair round-robin polling using `SelectNormal` 
- Empty variants return `Ok(())` immediately

**Normalization Stage (L267-269):**
- Recursively processes input expressions
- Builds counting tokens and skip patterns for tuple field extraction
- Transforms user input into internal representation

**Execution Engine (L166-263):**
- Creates `maybe_done` wrappers for each future to track completion
- Uses rotator pattern for fair polling when not in biased mode
- Implements two-phase polling loop with skip logic
- Returns `Err` immediately on first future failure (L234-236)
- Collects all `Ok` values into tuple when all futures complete (L247-260)

## Key Behavioral Characteristics

**Concurrency Model:**
- Runs all futures on single task (concurrent, not parallel)
- Uses `poll_fn` with manual polling rotation
- Respects async runtime's cooperative scheduling

**Error Handling:**
- Fail-fast semantics - returns immediately on first `Err`
- Uses `maybe_done` wrapper to track completion state safely

**Memory Management:**
- Stack-allocated futures tuple (no heap allocation)
- Unsafe `Pin::new_unchecked` usage with careful lifetime management (L229, L253)

## Dependencies
- `$crate::macros::support::{maybe_done, poll_fn, Future, Pin, RotatorSelect}`
- `Poll::{Ready, Pending}` for async state management
- `SelectBiased`/`SelectNormal` rotator implementations for polling fairness

## Critical Invariants
- Futures tuple must never be moved after pinning (L185-190)
- `maybe_done` wrappers ensure safe completion state tracking
- Skip counting must align with tuple field extraction patterns
- Rotator state maintains fairness across polling cycles
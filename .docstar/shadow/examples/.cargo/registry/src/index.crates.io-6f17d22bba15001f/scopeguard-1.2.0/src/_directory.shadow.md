# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/scopeguard-1.2.0/src/
@generated: 2026-02-09T18:16:10Z

## Primary Purpose

This directory contains the `scopeguard` crate - a Rust library that implements scope guards for guaranteed cleanup operations. Scope guards are RAII constructs that execute cleanup closures when leaving scope, providing deterministic resource management even during panic unwinding. The library supports both `std` and `no_std` environments.

## Key Components & Architecture

The module centers around a single core type with strategic execution patterns:

**Core Type**: `ScopeGuard<T, F, S>` - A generic container that owns a value `T`, cleanup closure `F`, and execution strategy `S`. Uses `ManuallyDrop` for safe memory management and `PhantomData` for zero-cost strategy typing.

**Strategy System**: Three execution strategies determine when cleanup occurs:
- `Always` - Executes cleanup unconditionally (default behavior)
- `OnSuccess` - Executes only on normal scope exit (requires `use_std` feature)
- `OnUnwind` - Executes only during panic unwinding (requires `use_std` feature)

**Memory Safety**: The `Drop` implementation safely extracts both the wrapped value and closure using `unsafe ptr::read()`, then conditionally executes the closure based on the strategy's `should_run()` method.

## Public API Surface

**Main Entry Points**:
- `guard(value, closure)` - Creates an always-executing scope guard
- `guard_on_success(value, closure)` - Creates success-only guard (std only)
- `guard_on_unwind(value, closure)` - Creates unwind-only guard (std only)

**Convenience Macros**:
- `defer!` - Creates always-executing guard from statement block
- `defer_on_success!` - Creates success-only guard from statement (std only)
- `defer_on_unwind!` - Creates unwind-only guard from statement (std only)

**Core Methods**:
- `ScopeGuard::with_strategy()` - Constructor with explicit strategy
- `into_inner()` - Consumes guard without executing cleanup, extracting wrapped value
- `Deref`/`DerefMut` traits allow direct access to wrapped value

## Internal Organization & Data Flow

1. **Creation**: Guards are created via factory functions or macros, wrapping a value and closure with a strategy
2. **Usage**: The wrapped value is accessed transparently through `Deref` traits
3. **Cleanup**: When the guard goes out of scope, `Drop::drop()` conditionally executes the closure based on strategy and current execution context
4. **Escape Hatch**: `into_inner()` provides a way to extract the value without running cleanup

## Important Patterns & Conventions

- **Zero-cost abstractions**: Strategy selection happens at compile time with no runtime overhead
- **RAII pattern**: Guaranteed cleanup through Rust's drop semantics
- **Strategy pattern**: Pluggable execution policies for different use cases
- **Safe unsafe code**: Uses `ManuallyDrop` and careful `ptr::read()` operations to avoid double-drops
- **Feature gating**: Panic-aware strategies require `use_std` feature for `std::thread::panicking()`

## Critical Invariants

- Cleanup closures execute at most once per guard instance
- Value extraction in `Drop` is memory-safe despite using unsafe operations  
- Guards work correctly in both normal and panic unwinding scenarios
- `no_std` compatibility maintained for basic always-execute functionality
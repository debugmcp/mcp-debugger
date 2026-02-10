# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/scopeguard-1.2.0/src/lib.rs
@source-hash: 3fb8bba122772495
@generated: 2026-02-09T18:11:51Z

## Primary Purpose

A Rust library providing scope guards - RAII constructs that execute cleanup closures when leaving scope, even during panic unwinding. Supports no_std environments and three execution strategies (always, on success, on unwind).

## Core Types & Functions

**ScopeGuard<T, F, S>** (L304-313): Generic scope guard struct that owns a value `T` and closure `F`, with strategy `S` determining when to run. Uses `ManuallyDrop` for safe memory management.

**Strategy trait** (L201-205): Defines when guard closures should execute via `should_run() -> bool`.

**Strategy implementations**:
- **Always** (L213): Always runs closure (L229-234)
- **OnUnwind** (L220): Runs only during panic unwinding (L237-242) - requires `use_std` feature  
- **OnSuccess** (L227): Runs only on normal scope exit (L245-250) - requires `use_std` feature

**Core functions**:
- **guard()** (L375-380): Creates Always strategy guard
- **guard_on_success()** (L388-393): Creates OnSuccess guard - requires `use_std`
- **guard_on_unwind()** (L425-430): Creates OnUnwind guard - requires `use_std`

**ScopeGuard methods**:
- **with_strategy()** (L326-332): Constructor with explicit strategy
- **into_inner()** (L357-369): Consumes guard without running closure, extracting inner value

## Macros

**defer!** (L257-261): Creates Always strategy guard from statement block
**defer_on_success!** (L271-275): Creates OnSuccess guard - requires `use_std`
**defer_on_unwind!** (L285-289): Creates OnUnwind guard - requires `use_std`

## Key Traits & Implementations

**Deref/DerefMut** (L443-463): Allows accessing wrapped value directly
**Drop** (L465-478): Core cleanup logic - reads value/closure unsafely and conditionally executes based on strategy
**Sync** (L435-441): Custom unsafe Sync impl since closure isn't accessible from references
**Debug** (L480-491): Shows wrapped value only

## Architecture Patterns

- RAII pattern for guaranteed cleanup
- Strategy pattern for conditional execution
- Zero-cost abstractions with compile-time strategy selection
- ManuallyDrop usage prevents double-drop scenarios
- PhantomData for strategy type without storage overhead

## Critical Invariants

1. Closure executes exactly once if guard runs to completion
2. Value and closure are safely extracted in `Drop::drop()` using unsafe `ptr::read`
3. `into_inner()` prevents closure execution by consuming guard
4. Strategy determines execution context (always/success/unwind)

## Dependencies

- `std`/`core` conditional compilation based on `use_std` feature
- Uses `ManuallyDrop`, `PhantomData`, `ptr` for low-level memory management
- `std::thread::panicking()` for unwind detection (when `use_std` enabled)
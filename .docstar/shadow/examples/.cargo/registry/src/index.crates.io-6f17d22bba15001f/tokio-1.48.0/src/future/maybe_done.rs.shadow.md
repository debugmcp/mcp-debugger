# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/future/maybe_done.rs
@source-hash: 73d8ecfc524a69c2
@generated: 2026-02-09T18:06:34Z

## Primary Purpose
A future combinator that tracks completion state, allowing futures to be polled until done and their results extracted or checked without re-polling. Part of Tokio's future utilities for managing asynchronous computation states.

## Key Components

### MaybeDone Enum (L8-23)
Pin-projected enum with three states:
- `Future`: Contains unpinned future awaiting completion
- `Done`: Holds completed future's output  
- `Gone`: Empty state after output extraction

Uses `#[repr(C)]` for Miri compatibility and generates projection types (`MaybeDoneProj`, `MaybeDoneProjReplace`).

### maybe_done() Factory (L25-30)
Creates `MaybeDone` wrapper from any `IntoFuture` type, converting input to future and wrapping in `Future` variant.

### Core Methods (L32-58)
- `output_mut()` (L37-42): Returns mutable reference to completed output if available
- `take_output()` (L47-57): Extracts output value, transitioning `Done` → `Gone` state using `project_replace()`

### Future Implementation (L60-72)  
`poll()` drives wrapped future to completion:
- Polls inner future when in `Future` state
- Returns `Poll::Ready(())` immediately when `Done`
- Panics when `Gone` (prevents use-after-take)
- Transitions `Future` → `Done` on completion

## Key Dependencies
- `pin_project_lite`: Generates safe pinning projections
- `std::future`: Core future traits and utilities
- `std::task::ready!`: Macro for handling `Poll::Pending`

## Architectural Patterns
- State machine pattern with explicit transitions
- Pin projection for safe async handling  
- Take-once semantics preventing double consumption
- Panic on invalid state access (polling after take)

## Critical Invariants
- Once `Gone`, future cannot be polled (runtime panic)
- Output can only be taken once via `take_output()`
- `poll()` always returns `()`, not the wrapped future's output
- Safe to poll repeatedly until completion
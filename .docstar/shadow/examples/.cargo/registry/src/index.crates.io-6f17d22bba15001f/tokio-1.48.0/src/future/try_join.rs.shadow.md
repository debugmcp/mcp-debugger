# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/future/try_join.rs
@source-hash: 0ea5a069b17a34bb
@generated: 2026-02-09T18:06:33Z

## Purpose
Implements a `try_join` combinator for exactly 3 futures that return `Result` types, providing fail-fast semantics where the first error terminates the entire operation.

## Key Components

**try_join3 function (L8-23)**
- Factory function that creates a `TryJoin3` future combinator
- Takes 3 futures that each return `Result<T, E>` with the same error type `E`
- Wraps each future in `MaybeDone` to track completion state
- Generic over success types `T1, T2, T3` but requires uniform error type `E`

**TryJoin3 struct (L25-39)**
- Pin-projected struct containing three `MaybeDone<F>` fields
- Uses `pin_project_lite` for safe pinning of internal futures
- Each future field is marked with `#[pin]` for proper projection
- Constrains all futures to implement the `Future` trait

**Future Implementation (L41-82)**
- Returns `Result<(T1, T2, T3), E>` - tuple of success values or first error
- Implements fail-fast semantics: immediately returns first encountered error (L56-58, L62-64, L68-70)
- Polls all futures sequentially, tracking completion with `all_done` flag
- Only returns success tuple when all futures complete successfully (L72-77)
- Uses multiple `unwrap()` calls assuming `MaybeDone` invariants hold

## Dependencies
- `crate::future::maybe_done::{maybe_done, MaybeDone}` - completion tracking wrapper
- `pin_project_lite::pin_project` - safe pinning macro
- Standard async primitives: `Future`, `Pin`, `Context`, `Poll`

## Architectural Patterns
- **Combinator Pattern**: Composes multiple futures into a single future
- **Fail-Fast Semantics**: First error terminates entire operation
- **State Machine**: Uses `MaybeDone` to track individual future completion
- **Pin Projection**: Safe handling of self-referential async state

## Critical Invariants
- All input futures must have same error type `E`
- `MaybeDone` wrapper ensures futures are polled at most once
- Pin safety maintained through `pin_project_lite` macro
- Futures are polled in declaration order (future1, future2, future3)
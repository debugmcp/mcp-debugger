# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/future/
@generated: 2026-02-09T18:16:11Z

## Overall Purpose
The `future` directory provides core future utilities and combinators for the Tokio async runtime. It serves as a feature-gated collection of async primitives that bridge synchronous and asynchronous execution, manage future lifecycle states, enable tracing integration, and provide specialized future joining operations.

## Key Components and Relationships

### Core Future Utilities
- **`maybe_done.rs`**: Implements a stateful future wrapper (`MaybeDone`) that tracks completion and allows result extraction without re-polling. Used as a building block by other combinators.
- **`try_join.rs`**: Provides `try_join3` combinator for fail-fast execution of exactly 3 futures with uniform error types, internally leveraging `MaybeDone` for state tracking.

### Runtime Integration
- **`block_on.rs`**: Critical sync-async bridge that executes futures synchronously. Provides two implementations based on runtime availability - uses runtime's blocking region when available, falls back to cached park thread otherwise.
- **`trace.rs`**: Enables tracing integration through `InstrumentedFuture` trait abstraction, allowing runtime inspection of tracing span IDs for instrumented futures.

### Module Organization
- **`mod.rs`**: Acts as a feature-aware orchestrator, conditionally exposing components based on Tokio feature flags (`macros`, `process`, `sync`, `trace`). Provides trait aliasing between standard and instrumented `Future` types.

## Public API Surface
- **Primary Entry Points**:
  - `block_on<F: Future>(f: F) -> F::Output` - Synchronous future execution
  - `try_join3(f1, f2, f3)` - Fail-fast joining of 3 result-returning futures
  - `maybe_done(future)` - State-tracking future wrapper
  - `InstrumentedFuture` trait - Tracing-aware future abstraction

- **Internal Utilities**: All exports use `pub(crate)` visibility, indicating these are internal Tokio building blocks rather than user-facing APIs.

## Internal Organization and Data Flow
1. **Feature-Gated Compilation**: Heavy use of conditional compilation (`cfg_*!` macros) to minimize binary size by only including needed functionality
2. **State Management**: `MaybeDone` provides the foundation for tracking future completion states, used by combinators like `try_join3`
3. **Bridge Pattern**: `block_on` bridges sync/async boundaries with runtime-aware implementations
4. **Trait Abstraction**: `InstrumentedFuture` provides optional tracing integration without tight coupling

## Important Patterns and Conventions
- **Pin Projection**: Extensive use of `pin_project_lite` for safe handling of self-referential async structures
- **Fail-Fast Semantics**: Error propagation stops execution immediately in combinators like `try_join3`
- **State Machine Design**: Explicit state tracking with transitions (Future → Done → Gone in `MaybeDone`)
- **Conditional Compilation**: Feature flags control API surface and implementation strategies
- **Error Handling**: Panic-on-invalid-state pattern for preventing misuse (e.g., polling after completion)

## Role in Larger System
This module provides foundational async building blocks for Tokio's runtime, enabling safe composition of futures, sync-async interop, and optional observability integration. It serves as a utility layer that other Tokio components build upon for more complex async patterns.
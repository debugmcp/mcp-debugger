# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/task/coop/consume_budget.rs
@source-hash: 4e23ec515c9cdf93
@generated: 2026-02-09T18:03:19Z

**Purpose:** Provides cooperative yielding mechanism for CPU-intensive tasks in Tokio runtime to prevent monopolization of executor threads.

**Core Function:**
- `consume_budget()` (L25-39): Async function that conditionally yields execution back to the Tokio runtime when the task's cooperative budget is exhausted. Uses a stateful poll function that tracks whether yielding has already occurred.

**Implementation Details:**
- Uses `std::future::poll_fn` (L28) with mutable status tracking to implement single-yield semantics
- Integrates with Tokio's tracing system via `crate::trace::trace_leaf` (L29)
- Calls `crate::task::coop::poll_proceed` (L33) to check/consume cooperative budget and get restoration handle
- Marks progress via `restore.made_progress()` (L34) when budget allows continuation

**Key Dependencies:**
- `crate::task::coop::poll_proceed` - Core cooperative scheduling logic
- `crate::trace::trace_leaf` - Tokio's tracing integration
- `std::task::{Poll, ready!}` - Standard async polling primitives

**Usage Pattern:**
Designed for insertion into tight loops or CPU-bound computations that don't naturally yield (e.g., iterating over large datasets). Only yields when the entire cooperative budget is exhausted, avoiding unnecessary context switches.

**Runtime Feature:**
Conditional compilation under "rt" feature flag (L24), indicating this is part of Tokio's runtime functionality rather than utilities.
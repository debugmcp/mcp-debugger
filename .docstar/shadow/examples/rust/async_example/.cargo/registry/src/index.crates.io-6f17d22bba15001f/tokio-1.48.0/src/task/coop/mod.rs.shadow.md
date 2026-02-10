# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/task/coop/mod.rs
@source-hash: e6efc19435559c86
@generated: 2026-02-09T18:03:34Z

This module implements Tokio's cooperative scheduling system to prevent task starvation in the async runtime. It provides mechanisms for tasks to voluntarily yield control back to the executor through a budget-based system.

## Core Components

**Budget struct (L94-127)**: Opaque type tracking remaining "work" units a task can perform before yielding. Contains `Option<u8>` where `None` means unconstrained, `Some(n)` tracks remaining budget. Initial budget is 128 operations (L115-117).

**BudgetDecrement struct (L99-102)**: Return type from budget decrement operations indicating success and whether budget hit zero.

## Key Functions

**budget() (L132-134)**: Entry point that runs a closure with initial budget (128 operations), automatically restoring previous budget when done.

**with_unconstrained() (L139-141)**: Runs closure without cooperative scheduling constraints.

**has_budget_remaining() (L223-227)**: Public API to check if current task has remaining budget, returns true if budget unavailable (thread-local shutdown).

**poll_proceed() (L343-364)**: Core cooperative scheduling primitive. Decrements budget and returns `Poll::Pending` if exhausted, or `RestoreOnPending` guard if budget available. Used by Tokio internals to add yield points.

## Advanced Types

**RestoreOnPending (L260-289)**: RAII guard that automatically restores budget on drop unless `made_progress()` is called. Prevents double-counting when tasks don't actually make progress.

**Coop<F> future wrapper (L434-456)**: Wraps any future to automatically consume budget before polling, ensuring cooperation even for third-party futures.

**cooperative() function (L490-492)**: Creates Coop wrapper for making non-Tokio futures cooperative.

## Internal Utilities

**with_budget() (L144-168)**: Core implementation using RAII guard to manage budget context via thread-local storage.

**poll_budget_available() (L371-379)**: Non-consuming budget check for internal use.

**stop() (L240-246)**: Forcibly removes budget constraints and returns remaining budget.

## Architecture Notes

- Uses thread-local storage via `context::budget()` for per-task budget tracking
- Budget decrements happen in leaf futures to avoid double-counting in nested polling
- Integrates with Tokio's waker system to properly reschedule yielded tasks
- Metrics integration tracks forced yields when budget exhausted
- Conditional compilation supports different runtime configurations (multi-thread, single-thread, no-runtime)

## Usage Patterns

Tasks automatically yield when budget exhausted through Tokio's built-in yield points. Custom futures can integrate via `poll_proceed()` or wrap with `cooperative()`. The `unconstrained()` wrapper opts out of cooperation when needed for performance-critical code.

The system balances fairness (preventing starvation) with efficiency (amortizing scheduling overhead) through the 128-operation budget chosen to allow meaningful work while limiting monopolization.
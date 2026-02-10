# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/task/coop/
@generated: 2026-02-09T18:16:09Z

This directory implements Tokio's **cooperative task scheduling system** - a fairness mechanism that prevents individual async tasks from monopolizing executor threads and starving other tasks.

## Overall Purpose

The cooperative scheduling system ensures fair task execution by giving each task a "budget" of operations (128 by default) before requiring it to yield control back to the runtime. This prevents CPU-intensive tasks from blocking the entire async executor while maintaining high performance through amortized scheduling overhead.

## Core Architecture

**Budget Management (`mod.rs`)**:
- `Budget` struct tracks remaining operations per task via thread-local storage
- `budget()` function provides main entry point, running closures with cooperative constraints
- `poll_proceed()` serves as the fundamental yield point primitive used throughout Tokio internals
- `RestoreOnPending` RAII guard prevents double-counting budget when tasks don't make progress

**Voluntary Yielding (`consume_budget.rs`)**:
- `consume_budget()` provides explicit yield point for CPU-intensive user code
- Integrates with Tokio's tracing system and uses single-yield semantics to avoid unnecessary context switches
- Designed for insertion into tight loops that don't naturally yield

**Opt-out Mechanism (`unconstrained.rs`)**:
- `Unconstrained<F>` wrapper disables cooperative scheduling for performance-critical code
- `unconstrained()` constructor allows bypassing fairness when appropriate
- Zero-cost abstraction when cooperative features disabled at compile time

## Public API Surface

**Primary Entry Points**:
- `budget(closure)` - Run code with cooperative scheduling enabled
- `consume_budget().await` - Explicit yield point for user tasks
- `unconstrained(future)` - Disable cooperation for wrapped future
- `has_budget_remaining()` - Check current task's budget status

**Advanced Integration**:
- `poll_proceed()` - Internal primitive for adding yield points to custom futures
- `cooperative(future)` - Wrap non-Tokio futures to make them cooperative
- `with_unconstrained(closure)` - Run code without budget constraints

## Internal Data Flow

1. **Budget Initialization**: Tasks start with 128-operation budget via thread-local storage
2. **Budget Consumption**: Each yield point calls `poll_proceed()` to decrement budget
3. **Forced Yielding**: When budget exhausted, task returns `Poll::Pending` and gets rescheduled
4. **Budget Restoration**: New scheduling cycle restores full budget
5. **Progress Tracking**: `RestoreOnPending` guards ensure accurate budget accounting

## Key Patterns

**Conditional Compilation**: Entire system can be compiled out when cooperative scheduling disabled, providing zero-cost abstraction for single-threaded or custom runtimes.

**Integration Points**: The system integrates seamlessly with Tokio's existing infrastructure - waker system for rescheduling, tracing for observability, and metrics for monitoring forced yields.

**Balance Design**: The 128-operation budget strikes a balance between fairness (preventing starvation) and efficiency (allowing meaningful work before context switches).

## Usage Guidelines

- Use `consume_budget()` in CPU-intensive loops that don't naturally yield
- Apply `unconstrained()` carefully only when certain futures will yield voluntarily
- Leverage automatic cooperation through Tokio's built-in yield points in most cases
- Monitor forced yield metrics to tune application cooperative behavior
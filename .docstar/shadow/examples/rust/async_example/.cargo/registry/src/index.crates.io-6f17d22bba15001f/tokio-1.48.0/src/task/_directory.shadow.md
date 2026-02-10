# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/task/
@generated: 2026-02-09T18:16:29Z

## Overall Purpose

The `task` directory implements Tokio's **cooperative task scheduling system** - a fairness mechanism that prevents individual async tasks from monopolizing executor threads and starving other tasks. The system ensures fair task execution by giving each task a "budget" of operations (128 by default) before requiring it to yield control back to the runtime.

## Key Components and Relationships

**Budget Management (`coop/mod.rs`)**:
- `Budget` struct tracks remaining operations per task via thread-local storage
- Provides the core budgeting primitives and RAII guards for accurate accounting
- Manages the fundamental yield point mechanism used throughout Tokio internals

**Voluntary Yielding (`coop/consume_budget.rs`)**:
- Implements explicit yield points for CPU-intensive user code
- Integrates with Tokio's tracing and metrics systems
- Designed for insertion into tight loops that don't naturally yield

**Opt-out Mechanism (`coop/unconstrained.rs`)**:
- Provides escape hatch to disable cooperative scheduling for performance-critical code
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

## Internal Organization and Data Flow

1. **Budget Initialization**: Tasks start with 128-operation budget via thread-local storage
2. **Budget Consumption**: Each yield point decrements budget through `poll_proceed()`
3. **Forced Yielding**: When budget exhausted, task returns `Poll::Pending` and gets rescheduled
4. **Budget Restoration**: New scheduling cycle restores full budget
5. **Progress Tracking**: RAII guards ensure accurate budget accounting

## Important Patterns and Conventions

**Conditional Compilation**: Entire system can be compiled out when cooperative scheduling disabled, providing zero-cost abstraction for single-threaded or custom runtimes.

**Seamless Integration**: The system integrates with Tokio's waker system for rescheduling, tracing for observability, and metrics for monitoring forced yields.

**Balance Design**: The 128-operation budget strikes a balance between fairness (preventing starvation) and efficiency (allowing meaningful work before context switches).

**Usage Guidelines**: Use `consume_budget()` in CPU-intensive loops, apply `unconstrained()` carefully only when futures will yield voluntarily, and leverage automatic cooperation through Tokio's built-in yield points for most cases.
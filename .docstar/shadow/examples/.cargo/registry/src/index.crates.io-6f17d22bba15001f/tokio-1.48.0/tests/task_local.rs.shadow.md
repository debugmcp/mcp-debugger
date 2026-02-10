# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/task_local.rs
@source-hash: f51b5a58b7272431
@generated: 2026-02-09T18:12:33Z

## Purpose
Test suite for Tokio's task-local storage functionality, verifying scoped task-local variables work correctly across async tasks, including during task abortion and completion.

## Key Test Functions

**`local` (L8-38)**: Core functionality test demonstrating task-local variable scoping across multiple spawned tasks. Creates two task-local variables (`REQ_ID: u32`, `FOO: bool`) and verifies each task maintains its own scoped values even when running concurrently.

**`task_local_available_on_abort` (L40-89)**: Tests task-local accessibility during task abortion. Uses custom `MyFuture` struct (L46-64) that never completes (`Poll::Pending`) and sends the task-local value via oneshot channel when dropped after abortion.

**`task_local_available_on_completion_drop` (L91-119)**: Verifies task-local values remain accessible during future drop after completion. Uses `MyFuture` struct (L97-111) that completes immediately (`Poll::Ready(())`) and captures task-local value in drop handler.

**`take_value` (L121-130)**: Tests the `take_value` method which extracts the task-local value from a scoped future, making it unavailable for subsequent calls.

**`poll_after_take_value_should_fail` (L132-147)**: Verifies that after calling `take_value`, the task-local variable is no longer accessible within the future, causing `try_with` to return an error.

**`get_value` (L149-171)**: Tests both `get()` and `try_get()` methods for accessing task-local values, and confirms that `try_get()` fails after `take_value` is called.

## Key Patterns

- **Task isolation**: Each spawned task maintains independent task-local values
- **Scoped execution**: Task-local values are available only within their scope
- **Drop safety**: Task-local values remain accessible during future destruction
- **Error handling**: Graceful failure when accessing non-existent task-local values

## Dependencies
- `tokio::sync::oneshot` for inter-task communication
- `std::future::Future` and related traits for custom future implementation
- Multi-threaded runtime required (excluded on WASI targets)

## Critical Constraints
- Task-local values are scoped to specific async execution contexts
- Values persist through task abortion and completion
- `take_value` permanently removes access to the task-local value
- Access attempts after `take_value` result in errors
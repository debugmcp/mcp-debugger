# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/tests/inject.rs
@source-hash: 97b68f6c22f6861b
@generated: 2026-02-09T18:03:13Z

## Test Suite for Runtime Inject Queue

Unit tests for Tokio's runtime task injection queue, specifically testing the `inject::Shared` data structure used for cross-thread task scheduling.

### Key Test Functions

**`push_and_pop` (L3-23)**: Core LIFO behavior test
- Creates inject queue with 2 tasks using `inject::Shared::new()`
- Validates length tracking during push operations (L10)
- Uses `super::unowned(async {})` to create test tasks (L11)
- Requires `unsafe` blocks for all push/pop operations (L12, L17, L22)
- Tests empty queue behavior returns `None` (L22)

**`push_batch_and_pop` (L25-39)**: Batch operations test
- Tests `push_batch()` with iterator of 10 tasks (L30-33)
- Validates `pop_n()` partial consumption behavior (L35-37)
- Confirms exact count semantics: 5+5+0 pattern

**`pop_n_drains_on_drop` (L41-54)**: Resource cleanup test
- Tests that `pop_n()` properly drains remaining tasks on drop
- Creates 10 tasks, pops all, verifies queue length is 0 (L52)
- Ensures no task leaks when iterator is dropped unused (L50)

### Dependencies & Patterns

**Dependencies**:
- `crate::runtime::scheduler::inject` - Core injection queue implementation
- `super::unowned()` - Test utility for creating unowned tasks

**Safety Requirements**: All inject queue operations require `unsafe` blocks, indicating raw pointer manipulation or lock-free data structures.

**Testing Pattern**: Uses `inject::Shared::new()` returning `(inject, synced)` tuple where `synced` appears to be synchronization state passed to all operations.

### Critical Behavior

The inject queue implements LIFO semantics for single operations and supports batch operations with precise count control. Length tracking is maintained consistently across all operations.
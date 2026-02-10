# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/tests/loom_set_once.rs
@source-hash: 149f3d579fbf35f0
@generated: 2026-02-09T18:03:18Z

**Purpose**: Loom-based concurrency tests for Tokio's `SetOnce` synchronization primitive, validating memory safety and correct behavior under different thread interleavings.

**Key Components**:

- **DropCounter (L9-30)**: Test utility struct that tracks drop counts using atomic operations
  - `new()` (L15-19): Creates instance with zero drop count
  - `assert_num_drops()` (L21-23): Validates expected number of drops occurred
  - `Drop` implementation (L26-29): Increments atomic counter on drop

**Test Cases**:

- **set_once_drop_test (L32-53)**: Validates drop semantics and race conditions
  - Creates two threads attempting to set values concurrently (L41, L45)  
  - Ensures exactly one set operation succeeds (`assert!(res != set)` L51)
  - Verifies proper cleanup with 2 drops expected (L50)
  - Uses loom model checking to explore all possible interleavings

- **set_once_wait_test (L55-72)**: Tests async waiting behavior
  - One thread sets value (L62-64), another waits asynchronously (L66-68)
  - Validates that `wait()` correctly receives the set value
  - Combines blocking thread operations with async/await patterns

**Dependencies**:
- `crate::sync::SetOnce`: The synchronization primitive under test
- `loom`: Deterministic concurrency testing framework for exploring all thread interleavings
- Standard atomic operations for drop counting

**Testing Strategy**: Uses loom's model checking to exhaustively test race conditions and memory ordering scenarios that could occur in real concurrent usage, ensuring SetOnce behaves correctly across all possible execution orders.
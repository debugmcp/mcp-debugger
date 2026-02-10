# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/rt_threaded.rs
@source-hash: c45e24c8b0be1cee
@generated: 2026-02-09T18:12:37Z

## Purpose
Comprehensive test suite for Tokio's multi-threaded runtime (`rt_threaded`). Tests runtime behavior, task spawning, scheduling, blocking operations, cooperative yielding, and various edge cases to ensure the multi-threaded executor works correctly under different conditions.

## Key Test Categories

### Basic Runtime Tests
- **single_thread** (L27-35): Verifies single-threaded multi-thread runtime creation
- **many_oneshot_futures** (L37-66): Stress tests 1000 concurrent tasks with atomic counters
- **spawn_two** (L68-98): Tests nested task spawning with oneshot channels and metrics validation

### Complex Scheduling Tests  
- **many_multishot_futures** (L100-162): Complex message forwarding chains (200 chain length, 5 cycles, 50 tracks) testing task handoff
- **lifo_slot_budget** (L164-188): Tests LIFO slot behavior and task budgeting with recursive spawning
- **multi_threadpool** (L372-391): Cross-runtime communication between two separate runtimes

### Blocking Operations
- **blocking** (L324-369): Tests `block_in_place` with barriers, ensuring worker thread handoff occurs
- **coop_and_block_in_place** (L399-446): Validates cooperative yielding after `block_in_place` returns
- **yield_after_block_in_place** (L448-472): Tests yielding behavior with nested runtime creation
- **mutex_in_block_in_place** (L668-693): Tests async mutex usage within blocking contexts

### Runtime Configuration
- **max_blocking_threads** (L475-481): Validates blocking thread configuration
- **max_blocking_threads_set_to_zero** (L483-490): Should panic test for invalid config
- **global_queue_interval_set_to_one** (L497-518): Regression test for issue #6445

### Shutdown and Cleanup
- **spawn_shutdown** (L190-208): Tests proper shutdown with TCP client-server
- **drop_threadpool_drops_futures** (L234-288): Ensures futures are dropped on runtime shutdown with custom `Never` future
- **start_stop_callbacks_called** (L290-322): Validates thread start/stop callback execution
- **hang_on_shutdown** (L520-532): Prevents shutdown hangs with blocking tasks

### Edge Cases and Regressions
- **wake_during_shutdown** (L534-596): Tests waker behavior during shutdown (issue #3869)
- **test_nested_block_in_place_with_block_on_between** (L623-648): Nested blocking operations (issue #5239)
- **test_tuning** (L700-813): Runtime tuning logic validation with load-based interval adjustment

### Block-in-Place Validation
- **test_block_in_place1-4** (L598-620): Various context validations for `block_in_place` usage

## Helper Functions
- **rt()** (L815-817): Creates default multi-threaded runtime
- **client_server()** (L210-232): TCP echo server for network testing
- **cfg_metrics!** macro (L18-25): Conditional compilation for unstable metrics

## Unstable Features Module (L819-884)
- **test_disable_lifo_slot** (L824-865): Tests LIFO slot disabling with background thread coordination
- **runtime_id_is_same/runtime_ids_different** (L867-883): Runtime ID uniqueness validation

## Key Dependencies
- Standard async I/O (`AsyncReadExt`, `AsyncWriteExt`)
- Networking (`TcpListener`, `TcpStream`) 
- Synchronization primitives (`oneshot`, `mpsc`, `Mutex`, `Barrier`)
- Task management (`JoinSet`, cooperative yielding)

## Architecture Notes
- Extensive use of atomic counters for coordination
- Barrier-based synchronization for deterministic testing
- Message passing patterns for cross-task communication
- Comprehensive coverage of blocking/async interaction edge cases
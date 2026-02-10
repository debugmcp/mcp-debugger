# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/tests/loom_list.rs
@source-hash: 54321d0a1a21e65d
@generated: 2026-02-09T18:03:19Z

## Purpose
Loom-based concurrency test for Tokio's MPSC list channel implementation. Tests thread-safe multi-producer single-consumer message passing under systematic concurrency exploration.

## Key Components
- **smoke test function (L6-48)**: Primary test that validates concurrent message ordering and delivery
- **Constants**: NUM_TX=2 producers, NUM_MSG=2 messages per producer (L10-11)
- **Channel setup (L14-15)**: Creates list::channel() with shared Arc-wrapped transmitter
- **Producer threads (L17-25)**: Spawns NUM_TX threads, each pushing (thread_id, message_index) tuples
- **Consumer loop (L29-46)**: Single receiver polling with backpressure handling

## Dependencies
- `crate::sync::mpsc::list`: Tokio's lock-free MPSC list channel implementation
- `loom::thread`: Deterministic thread scheduling for concurrency testing
- `crate::sync::mpsc::block::Read`: Enum for channel read states

## Test Logic
The test verifies:
1. **Message ordering**: Each thread's messages arrive in sequential order (L32-33)
2. **Completeness**: All messages from all producers are received (L35-36)
3. **Proper termination**: Test completes when all expected messages received
4. **Backpressure handling**: Uses thread::yield_now() when channel empty (L43)

## Loom Integration
Uses `loom::model()` wrapper (L13) for systematic exploration of all possible thread interleavings, ensuring the MPSC list implementation is race-condition free under all scheduling scenarios.

## Architectural Notes
- Arc-shared transmitter enables multiple producers while maintaining single ownership semantics
- Read::Value vs Read::Closed distinction handles graceful vs error termination
- Vector tracking (`next`) ensures per-producer message ordering without global ordering requirements
# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/io_sink.rs
@source-hash: 98d78179d21101c3
@generated: 2026-02-09T18:12:15Z

**Purpose**: Test suite verifying cooperative behavior of Tokio's IO sink operations to ensure they properly yield control in async contexts.

**Key Components**:
- `sink_poll_write_is_cooperative` (L6-18): Tests that `write_all()` operations on `tokio::io::sink()` are cooperative and will yield to other tasks
- `sink_poll_flush_is_cooperative` (L20-31): Tests that `flush()` operations on the sink are cooperative
- `sink_poll_shutdown_is_cooperative` (L33-44): Tests that `shutdown()` operations on the sink are cooperative

**Test Pattern**: All tests use identical structure with `tokio::select!` and `biased` prioritization:
- First branch runs infinite loop performing sink operation
- Second branch waits for `tokio::task::yield_now()`
- Tests verify that operations don't monopolize the executor by allowing yield_now to complete

**Dependencies**:
- `tokio::io::AsyncWriteExt` (L4): Provides async write extension methods
- `tokio::io::sink()`: Creates a sink that discards all written data
- `tokio::select!` with `biased`: Ensures deterministic branch selection for testing

**Architecture**: Cooperative scheduling verification tests ensuring async IO operations respect Tokio's task yielding semantics to prevent starvation of other tasks in the executor.
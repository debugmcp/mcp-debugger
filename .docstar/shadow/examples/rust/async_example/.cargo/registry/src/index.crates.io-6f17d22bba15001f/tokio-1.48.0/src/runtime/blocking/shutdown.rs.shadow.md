# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/blocking/shutdown.rs
@source-hash: 6eaf2a1418b885bc
@generated: 2026-02-09T18:03:02Z

## Purpose
Implements a shutdown coordination channel for Tokio's blocking thread pool. Workers hold `Sender` handles; when all are dropped, the `Receiver` gets notified, enabling graceful shutdown synchronization.

## Core Components

**Sender (L11-14)**: Clone-able shutdown signal handle
- Contains `_tx: Arc<oneshot::Sender<()>>` - Arc-wrapped oneshot sender
- Dropping all Sender instances triggers shutdown notification
- Clone-able so multiple workers can hold handles

**Receiver (L16-19)**: Shutdown signal awaiter
- Contains `rx: oneshot::Receiver<()>` - oneshot receiver for shutdown signal
- Single-use receiver that waits for all Senders to drop

**channel() (L21-27)**: Factory function
- Creates connected (Sender, Receiver) pair using oneshot channel
- Wraps sender in Arc for cloning, returns both ends

## Key Methods

**Receiver::wait() (L37-70)**: Blocking shutdown wait with timeout
- Blocks current thread until all Sender handles drop
- Takes `timeout: Option<Duration>` - None means wait indefinitely
- Returns `bool`: true if shutdown received, false if timeout elapsed
- Handles zero timeout as immediate false return (L40-42)
- Requires blocking context - panics if called from async context (L44-57)
- Uses `try_enter_blocking_region()` to validate execution context
- Gracefully handles panicking threads to avoid panic-in-panic (L47-49)

## Dependencies
- `crate::loom::sync::Arc` - Thread-safe reference counting
- `crate::sync::oneshot` - Single-use channel primitive  
- `crate::runtime::context::try_enter_blocking_region` - Async context validation
- `std::time::Duration` - Timeout specification

## Architecture Notes
- Uses oneshot channel as underlying primitive - completes with Err when all senders drop
- Arc wrapping enables multiple worker threads to hold shutdown handles
- Blocking region validation prevents deadlocks from async context misuse
- Timeout handling uses `block_on_timeout()` vs `block_on()` variants
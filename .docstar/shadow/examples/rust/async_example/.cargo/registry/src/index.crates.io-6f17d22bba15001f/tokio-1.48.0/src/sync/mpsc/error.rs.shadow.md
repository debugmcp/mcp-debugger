# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/sync/mpsc/error.rs
@source-hash: c01936bd2dbf382f
@generated: 2026-02-09T18:03:17Z

**Primary Purpose**: Defines error types for Tokio's MPSC (Multi-Producer Single-Consumer) channel operations, providing structured error handling for send/receive failures.

**Key Error Types**:

- **SendError<T> (L6-22)**: Generic error for blocking send operations when channel is closed. Contains the unsent value of type T. Implements standard error traits with "channel closed" display message.

- **TrySendError<T> (L26-77)**: Enum for non-blocking send failures with two variants:
  - `Full(T)` (L32): Channel at capacity, would require blocking
  - `Closed(T)` (L36): Receiver dropped/closed
  - Provides `into_inner()` method (L40-47) to extract unsent value
  - Includes `From<SendError<T>>` conversion (L73-77)

- **TryRecvError (L81-101)**: Enum for non-blocking receive failures:
  - `Empty` (L86): No data available but senders still connected
  - `Disconnected` (L89): All senders dropped, no more data possible

- **RecvError (L105-119)**: **DEPRECATED** - marked as unused since `recv()` returns `Option` instead of `Result`. Hidden from docs but maintained for compatibility.

- **SendTimeoutError<T> (L124-168)**: Conditional compilation (`cfg_time!`) error for timeout-based sends:
  - `Timeout(T)` (L129): Send timed out while channel full
  - `Closed(T)` (L133): Receiver closed during timeout
  - Provides `into_inner()` method (L137-144)

**Dependencies**: 
- `std::error::Error` and `std::fmt` for standard error handling
- Conditional time feature compilation

**Architecture Patterns**:
- All error types preserve the original value (T) for recovery
- Consistent trait implementations: `Debug`, `Display`, `Error`, `PartialEq`, `Eq`, `Clone`, `Copy`
- Error messages clearly distinguish between capacity issues and channel closure
- Type conversions provided where semantically appropriate (SendError → TrySendError)
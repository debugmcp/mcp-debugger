# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/task/error.rs
@source-hash: 0c84e9189f351c6e
@generated: 2026-02-09T18:03:07Z

**Purpose**: Error handling for Tokio task join operations, representing failures when awaiting spawned tasks.

**Core Types**:
- `JoinError` (L9-12): Main error type returned when tasks fail to complete successfully, containing failure reason and task ID
- `Repr` enum (L15-18): Internal representation distinguishing between task cancellation and panic scenarios

**Key Functions**:

**Constructors (internal)**:
- `JoinError::cancelled()` (L21-26): Creates error for cancelled tasks
- `JoinError::panic()` (L28-33): Creates error for panicked tasks, wrapping panic payload in `SyncWrapper`

**Public API**:
- `is_cancelled()` (L40-42): Returns true if task was cancelled
- `is_panic()` (L63-65): Returns true if task panicked
- `into_panic()` (L93-96): Consumes error and returns panic payload (panics if not a panic error)
- `try_into_panic()` (L119-124): Safe version returning `Result<payload, JoinError>`
- `id()` (L130-132): Returns the task ID that failed

**Trait Implementations**:
- `Display` (L135-153): User-friendly error messages with task ID and panic details
- `Debug` (L155-167): Debug formatting with structured output
- `std::error::Error` (L169): Standard error trait
- `From<JoinError> for io::Error` (L171-181): Conversion to IO errors

**Utilities**:
- `panic_payload_as_str()` (L183-198): Extracts string representation from panic payloads, handling common `String` and `&'static str` cases

**Dependencies**:
- `super::Id`: Task identifier type
- `SyncWrapper`: Thread-safe wrapper for panic payloads
- Standard library types for error handling and formatting

**Architecture**: Uses type-safe enum representation to distinguish error types, with panic payloads safely wrapped for cross-thread usage. Task IDs provide debugging context for error sources.
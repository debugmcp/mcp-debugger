# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/runtime/task/id.rs
@source-hash: b011009444d37687
@generated: 2026-02-09T18:03:08Z

## Purpose
Provides a unique task identification system for Tokio's async runtime. Defines the `Id` type for uniquely identifying tasks and functions to retrieve the current task's ID.

## Key Components

### `Id` Struct (L31-32)
- Opaque wrapper around `NonZeroU64` representing a unique task identifier
- Derives standard traits: `Clone`, `Copy`, `Debug`, `Hash`, `Eq`, `PartialEq`, `PartialOrd`, `Ord`
- Internal field is crate-private, ensuring controlled access

### Public API Functions

#### `id()` (L44-47)
- Returns the current task's `Id`
- **Panics** if called outside a task context (including `block_on` calls)
- Uses `#[track_caller]` for better panic diagnostics
- Delegates to `context::current_task_id()`

#### `try_id()` (L57-60)
- Non-panicking variant that returns `Option<Id>`
- Returns `None` when called outside task context
- Also uses `#[track_caller]`

### Internal Implementation

#### `Id::next()` (L69-87)
- Atomic ID generation using `StaticAtomicU64` starting from 1
- Uses relaxed memory ordering for performance
- Conditional compilation for loom testing (L73-79)
- Infinite loop ensures non-zero IDs (skips 0 if counter wraps)

#### `Id::as_u64()` (L89-91)
- Extracts the underlying `u64` value
- Crate-private utility method

### Display Implementation (L62-66)
- Formats the ID by delegating to the underlying `NonZeroU64`

## Dependencies
- `crate::runtime::context` - for current task context access
- `std::num::NonZeroU64` - for the underlying ID storage
- `crate::loom::sync::atomic` - for atomic counter operations

## Key Constraints
- IDs are not sequential and don't indicate spawn order
- ID reuse only after task exits AND no active handles remain
- Zero is never a valid ID (enforced by `NonZeroU64`)
- Thread-safe ID generation through atomic operations
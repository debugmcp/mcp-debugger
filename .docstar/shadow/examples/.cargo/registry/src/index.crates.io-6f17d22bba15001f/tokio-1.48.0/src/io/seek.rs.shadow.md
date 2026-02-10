# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/seek.rs
@source-hash: 56c8405acdd82b84
@generated: 2026-02-09T18:06:33Z

## Purpose
Provides a Future implementation for async seek operations on seekable streams, wrapping the async seek protocol into a single future that can be awaited.

## Key Components

### Seek Future (L10-21)
- `Seek<'a, S>`: Pin-projected future struct that manages async seek state
- Fields:
  - `seek: &'a mut S`: Mutable reference to the seekable stream
  - `pos: Option<SeekFrom>`: Target position (Some during initial seek, None during completion)
  - `_pin: PhantomPinned`: Makes future !Unpin for async trait compatibility

### Constructor Function (L23-32)
- `seek()`: Creates new Seek future from mutable reference and target position
- Requires `S: AsyncSeek + ?Sized + Unpin`
- Returns initialized Seek with position stored in `pos` field

### Future Implementation (L34-56)
- `poll()` implements two-phase seek protocol:
  1. **Initial phase** (L43-52): When `pos` is Some
     - Ensures no seek in progress via `poll_complete()` (L45)
     - Calls `start_seek()` with target position (L46)
     - Transitions to completion phase by setting `pos = None` (L48)
     - Immediately polls for completion (L49)
  2. **Completion phase** (L54): When `pos` is None
     - Simply polls `poll_complete()` until ready

## Dependencies
- `AsyncSeek` trait from crate::io for seek operations
- `pin_project_lite` for safe pin projection
- Standard library: Future, Pin, Poll, SeekFrom, PhantomPinned

## Architectural Patterns
- **State machine**: Uses Option<SeekFrom> to track seek phase
- **Pin projection**: Safely handles pinned references in async context  
- **Two-phase protocol**: Separates seek initiation from completion
- **Error propagation**: ready!() macro handles WouldBlock states
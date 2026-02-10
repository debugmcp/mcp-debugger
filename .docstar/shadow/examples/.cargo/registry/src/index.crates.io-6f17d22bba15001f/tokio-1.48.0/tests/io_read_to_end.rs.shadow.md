# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/io_read_to_end.rs
@source-hash: 25930c25798e432b
@generated: 2026-02-09T18:12:21Z

## Purpose
Comprehensive test suite for Tokio's `AsyncReadExt::read_to_end()` functionality, validating buffer initialization behavior, capacity management, and edge cases with mock readers.

## Key Components

### Test Functions
- **read_to_end() (L10-18)**: Basic functionality test reading from byte slice into vector
- **read_to_end_uninit() (L69-79)**: Tests uninitialized buffer handling with custom UninitTest reader
- **read_to_end_doesnt_grow_with_capacity() (L81-112)**: Comprehensive capacity preservation test across various buffer sizes and read patterns
- **read_to_end_grows_capacity_if_unfit() (L114-125)**: Validates capacity doubling behavior when buffer is too small

### Custom AsyncRead Implementation
- **State enum (L20-25)**: Three-state machine (Initializing, JustFilling, Done) controlling read behavior
- **UninitTest struct (L27-30)**: Mock reader tracking initialization state and buffer position
- **AsyncRead::poll_read() (L32-67)**: Complex state machine that manipulates buffer initialization and advancement patterns

## Dependencies
- `tokio::io::{AsyncRead, AsyncReadExt, ReadBuf}` - Core async I/O traits and buffer management
- `tokio_test::{assert_ok, io::Builder}` - Testing utilities and mock I/O builder

## Key Behavioral Patterns

### Buffer Management Testing
The tests validate three critical aspects:
1. **Initialization tracking**: UninitTest verifies `ReadBuf` properly tracks initialized vs filled regions
2. **Capacity preservation**: Extensive testing ensures `read_to_end` doesn't unnecessarily reallocate when buffer capacity is sufficient
3. **Growth strategy**: Confirms doubling behavior when buffer capacity is insufficient

### Mock Reader Strategy
UninitTest simulates complex buffer states:
- Initializes 2 bytes per call during Initializing phase (until 24 total)
- Fills 1 byte per call during JustFilling phase (down to 15 remaining)
- Triggers buffer resize by transitioning to Done state

## Critical Invariants
- Buffer capacity should not change if initially sufficient (L106-108)
- Capacity grows by factor of 4 when insufficient due to double-doubling pattern (L124)
- Total bytes read must match expected length regardless of read chunking patterns (L104)

## Architecture Notes
Uses state machine pattern in UninitTest to simulate real-world scenarios where AsyncRead implementations have complex buffer initialization requirements, ensuring `read_to_end` handles all edge cases correctly.
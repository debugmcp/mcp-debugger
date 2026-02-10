# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/io_panic.rs
@source-hash: 80222a47b45c71a4
@generated: 2026-02-09T18:12:20Z

## Purpose
Test file that verifies panic location reporting for Tokio IO operations. Ensures panics originate from the correct caller location rather than being obscured by internal Tokio implementation details.

## Architecture
Uses panic recovery mechanism (`support::panic::test_panic`) to catch panics and verify they report the test file as the panic source location.

## Key Components

### Mock Types
- **RW struct (L14)**: Minimal AsyncRead/AsyncWrite implementation for testing
  - `poll_read` (L17-24): Returns single byte "z" immediately
  - `poll_write` (L28-34): Always accepts 1 byte
  - `poll_flush`/`poll_shutdown` (L36-42): No-op implementations
- **MockFd struct (L49-55, Unix only)**: Mock file descriptor that returns fd 0

### Test Categories

#### ReadBuf Panic Location Tests (L58-118)
Tests that ReadBuf method panics report correct caller location:
- `read_buf_initialize_unfilled_to_panic_caller` (L59-71): Tests `initialize_unfilled_to(2)` on empty buffer
- `read_buf_advance_panic_caller` (L74-86): Tests `advance(2)` on empty buffer  
- `read_buf_set_filled_panic_caller` (L89-101): Tests `set_filled(2)` on empty buffer
- `read_buf_put_slice_panic_caller` (L104-118): Tests `put_slice()` on empty buffer

#### IO Split Panic Location Test (L120-132)
- `unsplit_panic_caller` (L121-132): Tests panic when calling `unsplit()` with mismatched reader/writer pairs

#### AsyncFd Panic Location Tests (L134-222, Unix only)
Tests AsyncFd constructor panics when no IO driver is available:
- `async_fd_new_panic_caller` (L136-154): Tests `AsyncFd::new()`
- `async_fd_with_interest_panic_caller` (L158-177): Tests `AsyncFd::with_interest()`
- `async_fd_try_new_panic_caller` (L181-199): Tests `AsyncFd::try_new()`
- `async_fd_try_with_interest_panic_caller` (L203-222): Tests `AsyncFd::try_with_interest()`

## Dependencies
- **tokio::io**: Core IO traits and utilities (ReadBuf, split, AsyncFd)
- **support::panic::test_panic**: Panic recovery utility for location verification
- **std::task**: Future polling context types

## Platform Support
- Core tests run on all platforms except WASI (no panic recovery support)
- AsyncFd tests are Unix-specific (`#[cfg(unix)]`)
- Requires unwind panic strategy (`#[cfg(panic = "unwind")]`)

## Test Pattern
All tests follow identical pattern:
1. Call `test_panic()` with closure that triggers expected panic
2. Assert panic location file matches current test file (`file!()`)
3. Return `Ok(())` for test framework compatibility
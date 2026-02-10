# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/solarish/compat.rs
@source-hash: 4346fbe9f8640868
@generated: 2026-02-09T18:03:23Z

## Purpose
Provides compatibility functions missing from illumos and Solaris systems but commonly needed by other crates. Implements terminal control, pseudo-terminal operations, and thread-safe password/group entry retrieval functions.

## Key Dependencies
- `crate::unix::solarish::*` - Platform-specific constants and types
- `crate::{c_char, c_int, size_t}` - C type aliases
- `core::cmp::min` - Minimum value comparison

## Core Functions

### Terminal Control Functions
- **`cfmakeraw`** (L8-31): Configures terminal for raw mode by clearing input/output processing flags and setting MIN/TIME parameters for non-canonical input. Critical implementation detail: forces VMIN=1 to match Linux/FreeBSD behavior instead of inheriting EOF value (4).

- **`cfsetspeed`** (L33-39): Sets both input and output baud rates simultaneously. Always returns 0 since underlying illumos/Solaris functions never fail.

### Pseudo-terminal Functions (illumos only)
- **`bail`** (L42-52): Error cleanup helper that closes file descriptors while preserving errno state.

- **`openpty`** (L55-126): Creates pseudo-terminal pair with proper STREAMS module setup. Key operations:
  - Opens master with `posix_openpt` (L67)
  - Grants permissions and unlocks with `grantpt`/`unlockpt` (L73)
  - Opens subordinate device (L85)
  - Pushes PTEM and LDTERM STREAMS modules if not present (L94-102)
  - Optionally sets terminal parameters and window size (L105-112)

- **`forkpty`** (L129-178): Combines `openpty` with `fork` to create child process attached to pseudo-terminal. In child process:
  - Closes master side (L154)
  - Calls `setsid()` and `TIOCSCTTY` to establish controlling terminal (L160-161)
  - Redirects stdin/stdout/stderr to subordinate device (L162-164)
  - Exits on failure to avoid corrupting parent state (L169)

### Thread-safe Entry Retrieval
- **`getpwent_r`** (L180-198): Thread-safe wrapper around `native_getpwent_r` with errno handling and buffer size clamping.

- **`getgrent_r`** (L200-218): Thread-safe wrapper around `native_getgrent_r` with identical errno/buffer handling pattern.

## Architectural Patterns
- **Error handling**: Consistent errno preservation pattern in entry retrieval functions
- **Platform-specific compilation**: Uses `#[cfg(target_os = "illumos")]` for pseudo-terminal functions
- **Resource cleanup**: `bail` function ensures proper cleanup on error paths
- **Buffer safety**: Clamps buffer sizes to `c_int::MAX` to prevent overflow

## Critical Invariants
- All functions marked `unsafe` - caller must ensure pointer validity
- Terminal operations modify termios structure in-place
- Pseudo-terminal functions handle STREAMS module setup specific to Solaris/illumos
- Child process in `forkpty` uses `_exit()` to avoid shared state corruption
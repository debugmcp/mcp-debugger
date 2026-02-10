# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/signal.py
@source-hash: 0363c964c90ac0b3
@generated: 2026-02-09T18:07:20Z

## Purpose and Responsibility

This file provides a Python wrapper layer around the `_signal` module to add IntEnum support for signal handling. It converts raw integer signal constants into type-safe enum members while maintaining compatibility with the underlying C signal interface.

## Key Components

### Enum Definitions (L7-22)
- **Signals enum**: Auto-generated from uppercase constants starting with 'SIG' (excluding 'SIG_') or 'CTRL_' using `_IntEnum._convert_`
- **Handlers enum**: Contains standard signal handlers (`SIG_DFL`, `SIG_IGN`)  
- **Sigmasks enum**: Platform-conditional enum for pthread signal masks (`SIG_BLOCK`, `SIG_UNBLOCK`, `SIG_SETMASK`) - only created if `pthread_sigmask` exists

### Conversion Utilities
- **`_int_to_enum(value, enum_klass)` (L24-33)**: Safely converts integers to enum members, returns original value if not a known enum member
- **`_enum_to_int(value)` (L36-43)**: Converts enum members back to integers for C interface compatibility
- **`_wraps(wrapped)` (L50-54)**: Minimal decorator that only copies `__doc__` attribute (lighter than `functools.wraps`)

### Enhanced Signal Functions
- **`signal(signalnum, handler)` (L57-59)**: Wraps `_signal.signal` with enum conversion for both parameters and return value
- **`getsignal(signalnum)` (L63-65)**: Returns signal handlers as Handler enum members instead of raw integers

### Conditional Platform Functions (L68-91)
All wrapped with platform availability checks:
- **`pthread_sigmask(how, mask)`**: Returns set of Signal enums instead of integers
- **`sigpending()`**: Returns pending signals as Signal enum set
- **`sigwait(sigset)`**: Returns awaited signal as Signal enum
- **`valid_signals()`**: Returns all valid signals as Signal enum set

## Architecture Patterns

- **Enum Bridge Pattern**: Systematically converts between C integers and Python enums at API boundaries
- **Conditional Wrapping**: Uses runtime globals inspection to only wrap functions that exist on the current platform
- **Transparent Enhancement**: Maintains identical API signatures while adding type safety
- **Import Star Strategy**: Re-exports all `_signal` module contents while selectively overriding specific functions

## Critical Constraints

- Maintains backward compatibility with integer-based signal APIs
- Graceful degradation: unknown integer values pass through unchanged rather than raising exceptions
- Platform-dependent function availability handled via runtime checks of `_globals`
# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/signal.py
@source-hash: 0363c964c90ac0b3
@generated: 2026-02-09T18:09:02Z

## Purpose
Python signal handling module wrapper that provides enum-based signal constants and enhanced type safety. Acts as a compatibility layer over the low-level `_signal` module, converting between numeric signal values and human-readable enum members.

## Key Components

### Enum Creation (L7-22)
- **Signals enum**: Auto-generated from uppercase constants starting with 'SIG' (excluding 'SIG_' prefixed) or 'CTRL_'
- **Handlers enum**: Contains SIG_DFL and SIG_IGN signal handler constants  
- **Sigmasks enum**: Contains SIG_BLOCK, SIG_UNBLOCK, SIG_SETMASK (conditionally created if pthread_sigmask available)

### Core Utility Functions
- **`_int_to_enum(value, enum_klass)` (L24-33)**: Converts numeric values to enum members, preserving non-numeric values unchanged
- **`_enum_to_int(value)` (L36-43)**: Converts enum members to integers, preserving non-enum values unchanged  
- **`_wraps(wrapped)` (L50-54)**: Minimal decorator that only copies `__doc__` attribute (lighter than functools.wraps)

### Enhanced Signal Functions
- **`signal(signalnum, handler)` (L57-59)**: Wrapper around `_signal.signal` with enum support for both parameters and return values
- **`getsignal(signalnum)` (L63-65)**: Returns handler as enum member instead of raw integer

### Platform-Conditional Functions (L68-91)
Functions only defined if corresponding `_signal` functions exist:
- **`pthread_sigmask(how, mask)` (L70-72)**: Returns set of Signal enum members
- **`sigpending()` (L77-78)**: Returns set of pending Signal enum members  
- **`sigwait(sigset)` (L83-85)**: Returns Signal enum member for received signal
- **`valid_signals()` (L90-91)**: Returns set of all valid Signal enum members

## Dependencies
- `_signal`: Low-level signal handling module (all functions imported via `from _signal import *`)
- `enum.IntEnum`: Base class for signal constant enums

## Architecture Notes
- Uses conditional function definition based on `_signal` module capabilities
- Maintains backward compatibility while adding enum-based type safety
- All wrapper functions preserve original docstrings via `_wraps` decorator
- Enum conversion is bidirectional and graceful (preserves non-enum values unchanged)
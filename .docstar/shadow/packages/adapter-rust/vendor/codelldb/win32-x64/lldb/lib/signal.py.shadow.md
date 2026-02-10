# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/signal.py
@source-hash: 0363c964c90ac0b3
@generated: 2026-02-09T18:13:04Z

## Signal Module Enhancement Layer

This module provides an enhanced interface to Python's `_signal` module by adding IntEnum-based type safety and automatic conversion between numeric signal values and enum constants. It acts as a wrapper layer that maintains backward compatibility while providing more type-safe signal handling.

### Core Architecture

The module creates three IntEnum classes using dynamic conversion:
- **Signals Enum (L7-12)**: Contains signal constants (SIG* patterns, excluding SIG_*, plus CTRL_* patterns)
- **Handlers Enum (L14-16)**: Contains signal handler constants (SIG_DFL, SIG_IGN)  
- **Sigmasks Enum (L19-21)**: Contains signal mask constants (SIG_BLOCK, SIG_UNBLOCK, SIG_SETMASK) - only if pthread_sigmask is available

### Key Utility Functions

- **`_int_to_enum(value, enum_klass)` (L24-33)**: Converts numeric values to IntEnum members, returning original value if conversion fails
- **`_enum_to_int(value)` (L36-43)**: Converts IntEnum members to numeric values, with fallback for non-enum values
- **`_wraps(wrapped)` (L50-54)**: Minimal decorator that only preserves `__doc__` attribute (lighter than functools.wraps)

### Enhanced Signal Functions

All wrapper functions maintain the same signatures as their `_signal` counterparts but add enum conversion:

- **`signal(signalnum, handler)` (L57-59)**: Wraps signal registration with enum conversion for both input and return values
- **`getsignal(signalnum)` (L63-65)**: Wraps signal handler retrieval with enum conversion for return value
- **`pthread_sigmask(how, mask)` (L70-72)**: Conditionally available, returns set of Signal enum members
- **`sigpending()` (L77-78)**: Conditionally available, returns set of pending Signal enum members  
- **`sigwait(sigset)` (L83-85)**: Conditionally available, returns Signal enum member
- **`valid_signals()` (L90-91)**: Conditionally available, returns set of valid Signal enum members

### Platform Compatibility

The module uses runtime checks (L18, L68, L75, L81, L88) to conditionally wrap functions that may not be available on all platforms, ensuring cross-platform compatibility.

### Dependencies

- `_signal`: Core signal functionality from Python standard library
- `enum.IntEnum`: For type-safe signal constant definitions

The module exports all symbols from `_signal` via wildcard import (L2) while selectively overriding specific functions with enhanced versions.
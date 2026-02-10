# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/signal.py
@source-hash: 0363c964c90ac0b3
@generated: 2026-02-09T18:08:00Z

## Purpose
Python signal module wrapper that provides enum-based interfaces for POSIX signal handling. Enhances the low-level `_signal` module by converting numeric signal constants to IntEnum types for better type safety and readability.

## Architecture
- **Base Import (L1-2)**: Imports and re-exports all symbols from `_signal` C extension module
- **Enum Generation (L7-22)**: Dynamically creates IntEnum classes from signal constants using reflection
- **Conversion Layer (L24-44)**: Bidirectional conversion between integers and enum members
- **Wrapper Functions (L56-92)**: Enhanced versions of signal functions with enum support

## Key Components

### Enum Classes (L7-22)
- **Signals**: Auto-generated from constants matching `SIG*` (not `SIG_*`) or `CTRL_*` patterns
- **Handlers**: Contains `SIG_DFL` and `SIG_IGN` signal handler constants  
- **Sigmasks**: Platform-conditional enum for `SIG_BLOCK`, `SIG_UNBLOCK`, `SIG_SETMASK`

### Conversion Utilities
- **`_int_to_enum(value, enum_klass)` (L24-33)**: Safely converts integers to enum members, returns original value if not found
- **`_enum_to_int(value)` (L36-43)**: Converts enum members to integers, handles non-enum inputs gracefully
- **`_wraps(wrapped)` (L50-54)**: Lightweight decorator that only copies `__doc__` attribute

### Enhanced Signal Functions
- **`signal(signalnum, handler)` (L57-59)**: Wraps `_signal.signal()` with enum conversion for both parameters and return value
- **`getsignal(signalnum)` (L63-65)**: Returns handler as Handlers enum member
- **`pthread_sigmask(how, mask)` (L70-72)**: Platform-conditional, returns set of Signals enums
- **`sigpending()` (L77-78)**: Platform-conditional, returns set of pending Signals
- **`sigwait(sigset)` (L83-85)**: Platform-conditional, returns waited Signal enum
- **`valid_signals()` (L90-91)**: Platform-conditional, returns set of valid Signals

## Dependencies
- `_signal`: Low-level C extension module for signal operations
- `enum.IntEnum`: Base class for signal constant enums

## Design Patterns
- **Facade Pattern**: High-level enum interface over low-level integer-based signal API
- **Dynamic Enum Generation**: Uses `_convert_()` to automatically discover signal constants
- **Conditional Feature Detection**: Platform-specific functions only wrapped if available in `_signal`
- **Transparent Compatibility**: Maintains backward compatibility while adding type safety
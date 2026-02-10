# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/signal.py
@source-hash: 0363c964c90ac0b3
@generated: 2026-02-09T18:09:56Z

## Purpose
This module provides a high-level wrapper around Python's low-level `_signal` module, converting raw integer signal constants and return values into more readable `IntEnum` types. It serves as part of LLDB's Python integration within a Rust adapter package.

## Key Enumerations
- **Signals** (L7-12): Auto-generated `IntEnum` containing signal constants (SIGTERM, SIGKILL, etc.) and Windows control signals (CTRL_*). Created by filtering uppercase names starting with 'SIG' but not 'SIG_' or starting with 'CTRL_'.
- **Handlers** (L14-16): Enum for signal handler constants `SIG_DFL` and `SIG_IGN`
- **Sigmasks** (L18-21): Conditionally created enum for pthread signal mask operations (`SIG_BLOCK`, `SIG_UNBLOCK`, `SIG_SETMASK`)

## Core Conversion Functions
- **`_int_to_enum(value, enum_klass)`** (L24-33): Safely converts integer values to enum members, returning original value if conversion fails
- **`_enum_to_int(value)`** (L36-43): Converts enum members to integers, handling non-enum inputs gracefully
- **`_wraps(wrapped)`** (L50-54): Minimal decorator that only copies `__doc__` attribute (lighter than `functools.wraps`)

## Wrapped Signal Functions
All functions wrap their `_signal` counterparts with enum conversion:
- **`signal(signalnum, handler)`** (L56-59): Sets signal handler, converts both parameters and return value
- **`getsignal(signalnum)`** (L62-65): Gets current signal handler, converts return value to Handler enum
- **`pthread_sigmask(how, mask)`** (L68-72): Modifies thread signal mask, returns set of Signal enums
- **`sigpending()`** (L75-78): Returns pending signals as Signal enum set
- **`sigwait(sigset)`** (L81-85): Waits for signal, returns Signal enum
- **`valid_signals()`** (L88-91): Returns valid signals as Signal enum set

## Architecture Notes
- Uses conditional function definition based on platform availability checks (`'pthread_sigmask' in _globals`)
- Maintains backward compatibility by preserving original numeric behavior when enum conversion fails
- All wrapped functions maintain original documentation through `_wraps` decorator
- Imports all symbols from `_signal` module while providing enhanced interface
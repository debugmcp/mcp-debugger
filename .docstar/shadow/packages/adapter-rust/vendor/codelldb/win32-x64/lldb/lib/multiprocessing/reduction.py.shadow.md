# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/multiprocessing/reduction.py
@source-hash: 4999f8b9ae7b3e8a
@generated: 2026-02-09T18:11:19Z

## Purpose
Platform-specific pickling and handle/file descriptor passing for multiprocessing, providing serialization of objects that can't be pickled by standard pickle module and enabling inter-process resource sharing.

## Key Classes

### ForkingPickler (L33-54)
Subclass of `pickle.Pickler` with extended reduction capabilities for multiprocessing objects.
- `_extra_reducers` (L35): Class-level dict storing custom reduction functions
- `register()` (L44-46): Registers custom reduction functions for specific types
- `dumps()` (L49-52): Serializes objects to bytes using custom dispatch table
- Combines standard copyreg dispatch with multiprocessing-specific reducers

### DupHandle (L104-135) - Windows Only
Picklable wrapper for Windows handles enabling cross-process handle sharing.
- `__init__()` (L106-119): Duplicates handle into target process using Win32 API
- `detach()` (L121-135): Retrieves handle, transferring ownership from source process
- Uses `_winapi.DuplicateHandle` for secure handle transfer

### AbstractReducer (L251-281)
Abstract base class providing interface for custom reduction implementations.
- Aggregates all platform-specific functionality into single interface
- Conditionally includes Windows (`steal_handle`, `duplicate`, `DupHandle`) or Unix (`sendfds`, `recvfds`, `DupFd`) methods

## Key Functions

### Platform Detection & Handle Support
- `HAVE_SEND_HANDLE` (L24-27): Capability detection for handle passing
- Platform-specific implementations split at L66 (Windows) and L137 (Unix)

### Windows Handle Management (L71-102)
- `duplicate()` (L71-81): Duplicates handles between processes
- `steal_handle()` (L83-93): Forcibly transfers handle from another process
- `send_handle()` (L95-98): Sends handle over connection using DupHandle wrapper
- `recv_handle()` (L100-102): Receives and detaches handle from connection

### Unix File Descriptor Management (L145-200)
- `sendfds()` (L145-151): Sends FD array over AF_UNIX socket using SCM_RIGHTS
- `recvfds()` (L153-179): Receives FD array with optional macOS acknowledgment
- `DupFd()` (L191-200): Creates FD wrapper, delegates to context or resource_sharer
- `ACKNOWLEDGE` (L143): macOS-specific acknowledgment requirement

## Custom Reduction Functions (L206-248)
Registers pickle reducers for complex types:
- Method objects (L206-214): Handles bound/unbound methods via `getattr`
- Method descriptors (L217-220): Built-in methods like `list.append`
- Partial functions (L223-227): Reconstructs `functools.partial` objects
- Socket objects (L233-248): Platform-specific socket pickling using handle/FD duplication

## Dependencies
- Core: `pickle`, `copyreg`, `functools`, `socket`, `io`, `os`, `sys`
- Platform-specific: `_winapi` (Windows), `array` (Unix)
- Internal: `.context`, `.resource_sharer`

## Architecture Notes
- Platform abstraction through conditional imports and function definitions
- Handle/FD passing uses OS-specific APIs (Win32 DuplicateHandle vs Unix SCM_RIGHTS)
- Custom pickle dispatch table combines standard and multiprocessing-specific reducers
- Resource ownership transfer semantics vary by platform but provide unified interface
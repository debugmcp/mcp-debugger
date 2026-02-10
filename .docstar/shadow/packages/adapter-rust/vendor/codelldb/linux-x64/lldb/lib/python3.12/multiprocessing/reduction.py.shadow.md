# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/multiprocessing/reduction.py
@source-hash: 4999f8b9ae7b3e8a
@generated: 2026-02-09T18:06:15Z

## Primary Purpose
Core serialization module for multiprocessing that handles pickling of objects and inter-process handle/file descriptor passing. Provides platform-specific implementations for Windows (handle duplication) and Unix (file descriptor passing via SCM_RIGHTS).

## Key Components

### ForkingPickler (L33-55)
Custom pickle.Pickler subclass that extends standard pickling with multiprocessing-specific reducers:
- `_extra_reducers` (L35): Class-level registry for custom reduction functions
- `register()` (L44-46): Adds custom reduction functions for specific types
- `dumps()` (L49-52): Serializes objects to bytes using custom reducers
- Inherits `loads` from standard pickle (L54)

### Platform Detection (L24-27)
`HAVE_SEND_HANDLE` determines handle passing capability based on platform and socket features.

### Windows Implementation (L66-136)
- `duplicate()` (L71-81): Duplicates handles between processes using _winapi
- `steal_handle()` (L83-93): Forcibly obtains handle from another process
- `send_handle()`/`recv_handle()` (L95-102): Handle transmission over connections
- `DupHandle` class (L104-135): Picklable handle wrapper with `detach()` method for handle retrieval

### Unix Implementation (L137-200)
- `sendfds()`/`recvfds()` (L145-179): File descriptor passing via AF_UNIX sockets using SCM_RIGHTS
- `ACKNOWLEDGE` (L143): MacOSX-specific acknowledgment requirement
- `send_handle()`/`recv_handle()` (L181-189): Handle transmission wrapper functions
- `DupFd()` (L191-200): File descriptor wrapper factory, delegates to spawning context or resource_sharer

### Built-in Type Reducers (L206-248)
Custom reduction functions for common non-picklable types:
- `_reduce_method()` (L206-210): Handles bound/unbound methods
- `_reduce_method_descriptor()` (L217-218): Handles built-in method descriptors (L219-220)
- `_reduce_partial()`/`_rebuild_partial()` (L223-226): Handles functools.partial objects
- Socket reducers (L233-248): Platform-specific socket serialization using DupSocket/DupFd

### AbstractReducer (L251-281)
Abstract base class providing a complete reduction interface with all platform-appropriate methods and reducers. Initializes standard type registrations in constructor.

## Dependencies
- Standard library: pickle, socket, functools, io, os, sys, copyreg, array
- Platform-specific: _winapi (Windows)
- Internal: context module, resource_sharer (conditional)

## Architecture Notes
- Clean platform separation using sys.platform checks
- Lazy imports for platform-specific modules
- Registry pattern for extensible type reduction
- Handle/FD passing abstracted behind common interface
- Error handling for malformed ancillary data on Unix
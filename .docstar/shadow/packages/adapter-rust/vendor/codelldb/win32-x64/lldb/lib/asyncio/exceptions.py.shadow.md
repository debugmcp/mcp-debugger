# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/asyncio/exceptions.py
@source-hash: a5971f88be14cd14
@generated: 2026-02-09T18:12:19Z

## Purpose
This file defines the core exception hierarchy for Python's asyncio library, providing specialized error types for asynchronous operations and I/O scenarios.

## Key Exception Classes

### CancelledError (L10-11)
- Inherits from `BaseException` (not `Exception`)
- Raised when a Future or Task is cancelled
- Base-level exception to ensure it propagates through normal exception handling

### TimeoutError (L14)
- Local alias for Python's built-in `TimeoutError`
- Used for timeout-related failures in async operations

### InvalidStateError (L17-18)
- General-purpose exception for state-related violations
- Inherits from `Exception`

### SendfileNotAvailableError (L21-26)
- RuntimeError subclass for OS-level sendfile syscall unavailability
- Handles platform-specific limitations for zero-copy file transmission

### IncompleteReadError (L29-44)
- EOFError subclass for partial read scenarios
- Attributes: `partial` (bytes read), `expected` (total bytes expected)
- Custom `__init__` formats error message with read vs expected byte counts (L36-41)
- Implements `__reduce__` for proper pickling support (L43-44)

### LimitOverrunError (L47-58)
- Exception subclass for buffer limit violations during separator searches
- Attribute: `consumed` (bytes that need to be consumed)
- Custom `__reduce__` implementation for serialization (L57-58)

### BrokenBarrierError (L61-62)
- RuntimeError subclass for barrier synchronization failures
- Triggered by explicit `barrier.abort()` calls

## Architecture Notes
- All exceptions follow standard Python exception conventions
- Two classes (`IncompleteReadError`, `LimitOverrunError`) implement custom `__reduce__` methods for proper serialization
- Exception hierarchy designed for asyncio's specific error handling patterns
- Mixed inheritance from different base exception types based on semantic meaning
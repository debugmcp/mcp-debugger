# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/unittest/signals.py
@source-hash: f8286e818ca56e10
@generated: 2026-02-09T18:12:21Z

## Primary Purpose
Signal handling utility for unittest framework that manages SIGINT (Ctrl+C) interruption behavior during test execution. Provides graceful test termination by stopping registered test results when interrupted.

## Key Components

### _InterruptHandler Class (L9-40)
Custom signal handler that wraps the original SIGINT handler with test-aware behavior:
- `__init__(L10-26)`: Normalizes different signal handler types (SIG_DFL, SIG_IGN, callables) into consistent callable form
- `__call__(L28-40)`: Signal handler implementation that delegates to original handler on first call, then stops all registered test results on subsequent calls
- Key attributes: `called` (L11), `original_handler` (L12), `default_handler` (L26)

### Global State Management
- `_results` (L41): WeakKeyDictionary tracking active test result objects
- `_interrupt_handler` (L48): Global singleton interrupt handler instance

### Public API Functions
- `registerResult(result)` (L42-43): Registers test result objects to be stopped on interruption
- `removeResult(result)` (L45-46): Unregisters test result objects, returns success boolean
- `installHandler()` (L49-54): Installs the custom interrupt handler as SIGINT handler
- `removeHandler(method=None)` (L57-71): Either removes handler globally or creates decorator for temporary handler removal

## Architecture Patterns
- **Singleton Pattern**: Single global interrupt handler instance
- **Weak References**: Uses WeakKeyDictionary to avoid memory leaks from test result registration
- **Decorator Pattern**: `removeHandler` can function as method decorator for context-specific handler removal
- **State Machine**: Handler tracks `called` state to differentiate first vs subsequent interruptions

## Critical Behavior
- First SIGINT: Sets `called=True` and stops all registered test results
- Second SIGINT: Delegates to original/default handler (typically terminates process)
- Handler delegation logic ensures proper cleanup when handler is replaced externally
- Uses `signal.getsignal()` check (L29-33) to detect if handler was replaced and delegate appropriately

## Dependencies
- `signal`: Core signal handling functionality
- `weakref`: Memory-safe result tracking
- `functools.wraps`: Decorator preservation for `removeHandler`
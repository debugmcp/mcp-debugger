# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/multiprocessing/util.py
@source-hash: 6752c4515ec69f82
@generated: 2026-02-09T18:11:24Z

## multiprocessing.util Module

Core utility module for Python's multiprocessing package providing logging, finalization, fork handling, and process management utilities.

### Primary Purpose
Provides essential infrastructure for multiprocessing operations including:
- Custom logging system with multiprocessing-aware formatters
- Object finalization using weakrefs for cleanup
- Fork-aware thread-safe constructs
- Process lifecycle management and cleanup
- File descriptor management utilities

### Key Components

#### Logging System (L32-104)
- **Logging levels**: SUBDEBUG(5), DEBUG(10), INFO(20), SUBWARNING(25) (L32-36)
- **Core functions**: `sub_debug()`, `debug()`, `info()`, `sub_warning()` (L44-58) - conditional logging based on `_logger` existence
- **`get_logger()`** (L60-85): Thread-safe logger initialization with cleanup ordering via atexit manipulation
- **`log_to_stderr()`** (L87-103): Configures stderr handler with multiprocessing-specific format

#### Abstract Socket Support (L107-126)
- **`_platform_supports_abstract_sockets()`** (L108-113): Linux/Android detection
- **`is_abstract_socket_namespace()`** (L116-123): Validates abstract socket addresses (null-byte prefixed)

#### Temporary Directory Management (L132-156)
- **`_remove_temp_dir()`** (L132-142): Cleanup function with FileNotFoundError handling
- **`get_temp_dir()`** (L144-156): Process-local temp directory with automatic cleanup via Finalize

#### Fork-Aware Registry (L162-175)
- **`_afterfork_registry`** (L162): WeakValueDictionary for post-fork callbacks
- **`register_after_fork()`** (L174-175): Registers cleanup functions for fork events
- **`_run_after_forkers()`** (L165-172): Executes registered callbacks with exception handling

#### Finalization System (L181-309)
- **`Finalize` class** (L185-268): Weakref-based cleanup with priority support
  - Constructor validates exitpriority and sets up weakref callback (L189-206)
  - `__call__()` method handles cleanup with process ID validation (L208-230)
  - `cancel()` and `still_active()` for lifecycle management (L232-248)
- **`_run_finalizers()`** (L271-309): Priority-ordered execution of finalizers with thread-safety considerations

#### Process Exit Handling (L315-365)
- **`is_exiting()`** (L315-319): Global exit state check
- **`_exit_function()`** (L323-364): Comprehensive shutdown sequence:
  - Runs finalizers with priority ≥ 0
  - Terminates daemon processes
  - Joins remaining active processes
  - Runs remaining finalizers

#### Fork-Aware Threading (L371-392)
- **`ForkAwareThreadLock`** (L371-385): Threading.Lock wrapper that reinitializes after fork
- **`ForkAwareLocal`** (L388-392): threading.local that clears state after fork

#### File Descriptor Management (L398-470)
- **`close_all_fds_except()`** (L403-408): Closes all FDs except specified ones using os.closerange
- **`spawnv_passfds()`** (L450-463): Spawns process with specified FDs kept open
- **`close_fds()`** (L466-469): Utility to close multiple FDs

#### Stream Utilities (L413-444)
- **`_close_stdin()`** (L413-430): Safely closes stdin and redirects to devnull
- **`_flush_std_streams()`** (L436-444): Flushes stdout/stderr with error handling

#### Test Cleanup (L472-493)
- **`_cleanup_tests()`** (L472-492): Comprehensive cleanup for test environments including forkserver and resource tracker shutdown

### Dependencies
- Standard library: os, sys, threading, weakref, atexit, itertools
- Internal: process module from same package
- subprocess._args_from_interpreter_flags for interpreter state

### Architectural Patterns
- Extensive use of global state with thread-safe initialization
- Weakref-based cleanup to avoid circular references  
- Priority-based finalization system
- Fork-aware constructs that reinitialize after process forking
- Exception-safe cleanup with comprehensive error handling
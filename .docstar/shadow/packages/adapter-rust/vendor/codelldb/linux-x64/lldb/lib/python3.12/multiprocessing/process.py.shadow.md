# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/multiprocessing/process.py
@source-hash: 67f0c2a7a3a83c92
@generated: 2026-02-09T18:06:20Z

## Purpose and Responsibility

Core multiprocessing process management module that provides the `BaseProcess` class - Python's analogue to `threading.Thread` for separate processes. Handles process lifecycle, state management, and inter-process communication setup.

## Key Classes and Functions

### Public API Functions
- **`current_process()` (L37-41)**: Returns the current process object (`_current_process`)
- **`active_children()` (L43-48)**: Returns list of live child processes after cleanup
- **`parent_process()` (L51-55)**: Returns parent process object (`_parent_process`)

### Core Process Classes

**`BaseProcess` (L71-342)**: Abstract base class for all process objects
- **`__init__()` (L80-97)**: Process initialization with identity chain, config inheritance, target/args setup
- **`start()` (L110-126)**: Creates subprocess via `_Popen()`, manages process lifecycle
- **`run()` (L103-108)**: Entry point for subprocess execution (calls `_target`)
- **`join()` (L142-151)**: Waits for process termination with timeout support
- **`terminate()/kill()` (L128-140)**: Process termination (SIGTERM/SIGKILL)
- **`is_alive()` (L153-170)**: Checks process status via `_popen.poll()`
- **`close()` (L172-187)**: Resource cleanup, requires terminated process
- **`_bootstrap()` (L290-336)**: Process startup sequence in child process

**Key Properties:**
- **`name`** (L189-196): Process identifier string
- **`daemon`** (L198-211): Daemon process flag
- **`exitcode`** (L224-232): Process exit status
- **`ident/pid`** (L234-245): Process ID
- **`sentinel`** (L247-257): File descriptor for process monitoring

**`AuthenticationString` (L349-357)**: Security wrapper for auth keys, prevents network transmission via custom `__reduce__()`

**`_ParentProcess` (L364-392)**: Represents parent process from child's perspective
- Uses connection waiting for `is_alive()` and `join()` operations

**`_MainProcess` (L397-419)**: Represents the main Python process
- Sets up default config with random auth key and semaphore prefix

## Global State Management

- **`_current_process`** (L422): Current process singleton (`_MainProcess` initially)
- **`_parent_process`** (L421): Parent process reference
- **`_process_counter`** (L423): Unique process ID generator
- **`_children`** (L424): Set tracking active child processes
- **`_dangling`** (L439): WeakSet for debugging leaked processes

### Internal Functions
- **`_cleanup()` (L61-65)**: Removes finished child processes from tracking
- **`_after_fork()` (L338-342)**: Post-fork cleanup in child process

## Dependencies and Architecture

**Key Imports:**
- `threading`: For thread-safe operations and main thread handling
- `signal`: For exit code mapping and process signals  
- `_weakrefset.WeakSet`: For leak detection tracking
- `os`: For PID management and system calls

**Design Patterns:**
- Template method pattern: `BaseProcess._Popen()` must be implemented by subclasses
- Process identity chain: `_identity` tuple tracks process hierarchy
- Config inheritance: Child processes inherit parent's `_config` dictionary
- Lifecycle management: Strict state transitions (initial → started → stopped/closed)

## Critical Invariants

1. **Single start constraint**: Process can only be started once (`_popen is None` check)
2. **Parent-child relationship**: Only parent process can join/test child processes  
3. **Daemon restriction**: Daemon processes cannot create children
4. **Resource management**: Processes must be terminated before closing
5. **Identity chain**: Each process extends parent's identity tuple
6. **Auth key security**: AuthenticationString prevents accidental network transmission
# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/asyncio/base_tasks.py
@source-hash: 56efac65b63db927
@generated: 2026-02-09T18:10:17Z

## Purpose
Core task debugging utilities for the asyncio library, providing task representation, stack inspection, and debugging output functionality. Part of Python's asyncio implementation within the LLDB debugger's embedded Python environment.

## Key Components

### Task Representation Functions
- `_task_repr_info(task)` (L9-25): Extracts detailed task information for debugging display, including cancellation status, task name, waiter objects, and coroutine details. Builds upon base_futures._future_repr_info().
- `_task_repr(task)` (L28-31): Creates formatted string representation of tasks using reprlib.recursive_repr decorator to handle circular references.

### Stack Inspection Functions  
- `_task_get_stack(task, limit)` (L34-66): Extracts frame stack from task's coroutine, handling multiple coroutine types:
  - Async def coroutines (cr_frame attribute)
  - Legacy generator-based coroutines (gi_frame attribute) 
  - Async generators (ag_frame attribute)
  - Falls back to exception traceback if coroutine frame unavailable
- `_task_print_stack(task, limit, file)` (L69-94): Formats and prints task stack traces with source code context using linecache for line retrieval and traceback module for formatting.

## Dependencies
- `linecache`: Source line caching and retrieval
- `reprlib`: Safe representation with recursion handling
- `traceback`: Stack trace formatting
- `base_futures`: Future representation utilities
- `coroutines`: Coroutine formatting utilities

## Key Patterns
- Multi-case coroutine type detection using hasattr() checks for different frame attributes
- Defensive programming with None checks and limit handling
- Stack frame traversal using f_back linkage with reversal for correct order
- Exception traceback extraction as fallback when coroutine frames unavailable
- Source code context inclusion via linecache integration

## Critical Constraints
- Frame traversal respects optional limit parameter to prevent excessive memory usage
- Handles both active coroutines and completed tasks with exceptions
- Thread-safe linecache usage with per-file cache validation
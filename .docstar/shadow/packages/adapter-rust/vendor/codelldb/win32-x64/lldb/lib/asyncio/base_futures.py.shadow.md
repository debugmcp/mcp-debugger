# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/asyncio/base_futures.py
@source-hash: 2f3798c4b82f5ac7
@generated: 2026-02-09T18:10:17Z

## Purpose
Internal asyncio utility module providing Future state constants and helper functions for Future representation and duck-typing detection. Part of the asyncio library's base infrastructure for asynchronous programming.

## Key Components

**State Constants (L8-10)**
- `_PENDING`, `_CANCELLED`, `_FINISHED`: String constants defining the three possible Future states
- Used throughout asyncio for Future state management

**Future Detection (L13-21)**
- `isfuture(obj)`: Duck-typing detector that identifies Future-compatible objects
- Checks for `_asyncio_future_blocking` attribute on the object's class
- Returns True if attribute exists and is not None

**Representation Helpers (L24-67)**
- `_format_callbacks(cb)` (L24-41): Formats callback lists for display
  - Handles empty, single, double, and multiple callback scenarios
  - Uses `format_helpers._format_callback_source()` for individual callback formatting
  - Returns formatted string like "cb=[callback1, callback2]" or "cb=[callback1, <N more>, callbackN]"

- `_future_repr_info(future)` (L44-61): Extracts Future state information for representation
  - Returns list of info strings including state, result/exception, callbacks, and creation location
  - Handles finished futures by showing either exception or result (using reprlib for length limiting)
  - Includes callback formatting and source traceback information when available

- `_future_repr(future)` (L64-67): Main representation function decorated with `@reprlib.recursive_repr()`
  - Combines class name with joined info from `_future_repr_info()`
  - Returns formatted string like "&lt;Future pending&gt;" or "&lt;Task finished result=42&gt;"

## Dependencies
- `reprlib`: For recursive representation handling and result limiting
- `format_helpers`: Internal module for callback source formatting

## Architecture Notes
- Pure utility module with no class definitions
- Designed for internal asyncio use, not public API (`__all__ = ()`)
- Follows asyncio's pattern of separating representation logic from core Future implementation
- Uses duck-typing pattern for Future detection rather than isinstance checks
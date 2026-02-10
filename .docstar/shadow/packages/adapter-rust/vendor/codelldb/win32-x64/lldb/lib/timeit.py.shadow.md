# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/timeit.py
@source-hash: d47d9deb6be0136d
@generated: 2026-02-09T18:13:17Z

**Primary Purpose:** Python's `timeit` module - a precision timing utility for measuring execution time of small code snippets while avoiding common timing pitfalls.

**Core Architecture:**
- Uses dynamic code compilation with template-based execution (L69-78)
- Disables garbage collection during timing for consistent measurements (L177-183)
- Provides both library API and command-line interface

**Key Components:**

**Timer Class (L86-232):**
- Primary timing class that compiles user code into optimized timing functions
- `__init__` (L104-137): Accepts stmt/setup as strings or callables, compiles into executable template
- `timeit` (L166-184): Executes code `number` times with GC disabled, returns total time
- `repeat` (L186-210): Runs `timeit` multiple times, returns list of measurements
- `autorange` (L212-231): Automatically determines optimal iteration count (≥0.2s total time)
- `print_exc` (L139-164): Enhanced traceback printing for dynamically compiled code

**Module Functions:**
- `timeit` (L234-237): Convenience wrapper for Timer.timeit()
- `repeat` (L240-243): Convenience wrapper for Timer.repeat()
- `main` (L246-377): Command-line interface with argument parsing and result formatting

**Key Constants & Globals:**
- `template` (L69-78): Code template for dynamic function generation
- `default_timer` (L62): Points to `time.perf_counter` for high-resolution timing
- `default_number` (L60): 1,000,000 default iterations
- `dummy_src_name` (L59): Identifier for compiled code in tracebacks

**Dependencies:**
- `gc`: For disabling garbage collection during timing
- `itertools`: For efficient iteration generation
- `time`: For timing functions (`perf_counter`, `process_time`)
- `getopt`: Command-line argument parsing
- `compile`/`exec`: Dynamic code compilation

**Critical Design Patterns:**
- Template-based code generation with proper indentation handling
- GC suspension during measurements to eliminate timing variability
- Statistical guidance (prefer minimum timing over mean/median)
- Automatic scaling for human-readable time units (nsec→sec)

**Command-line Features:**
- Auto-determination of iteration count for reliable measurements
- Multiple timing modes (perf_counter vs process_time)
- Flexible output formatting with precision control
- Warning system for unreliable results (4x variance threshold, L370-376)
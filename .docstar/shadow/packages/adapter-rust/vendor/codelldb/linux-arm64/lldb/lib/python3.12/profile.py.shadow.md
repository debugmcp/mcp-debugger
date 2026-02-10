# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/profile.py
@source-hash: dee2125b2a0913fc
@generated: 2026-02-09T18:09:28Z

## Profile.py - Python Code Profiling Module

**Purpose:** Pure Python implementation of a code profiler for performance analysis and timing measurements. Part of Python's standard library profiling infrastructure.

### Core Components

**_Utils (L43-75):** Utility class providing shared functionality between profile.py and cProfile.py modules. Contains `run()` and `runctx()` methods that wrap profiler execution with SystemExit handling and result display via `_show()`.

**Profile Class (L104-551):** Main profiler implementation using deterministic profiling via sys.setprofile().

**Key Data Structures:**
- `self.cur` (L107): 6-tuple parallel stack tracking active frames: `[parent_time, internal_time, external_time, function_name, frame, previous_tuple]`
- `self.timings` (L127): Dictionary storing 5-tuples per function: `[call_count, stack_depth, internal_time, cumulative_time, callers_dict]`

**Timer Configuration (L145-181):** Adaptive timer setup supporting:
- `time.process_time()` (default) with `trace_dispatch_i()`
- Custom timer functions with appropriate dispatch methods
- Automatic detection of timer return type (scalar vs tuple)

**Dispatch Methods:**
- `trace_dispatch_i()` (L202-212): Optimized for scalar timer returns
- `trace_dispatch()` (L184-198): For 2-element timer tuples
- `trace_dispatch_l()` (L231-241): Generic for list-returning timers
- `trace_dispatch_mac()` (L217-227): Macintosh-specific (1/60th second ticks)

**Event Handlers:**
- `trace_dispatch_call()` (L258-278): Handles function entry, creates stack frame
- `trace_dispatch_return()` (L291-326): Handles function exit, updates timing statistics
- `trace_dispatch_c_call()` (L280-289): Handles C extension function calls
- `trace_dispatch_exception()` (L250-255): Handles exception propagation

**Fake Frame System (L350-372):** Creates synthetic call stack entries for profiler overhead measurement using `fake_code` and `fake_frame` classes.

**Public API:**
- `run()` (L415): Profiles string code in __main__ context
- `runctx()` (L420): Profiles with custom globals/locals
- `runcall()` (L430): Profiles single function call
- `print_stats()` (L388): Outputs formatted results via pstats
- `dump_stats()` (L393): Serializes results to file using marshal

**Calibration System (L479-550):** Measures profiler overhead by comparing timed vs profiled execution of test functions, calculating per-event bias correction.

### Module-Level Functions

**run() (L82-93):** Convenience function creating Profile instance and executing code with optional file output.

**runctx() (L95-101):** Similar to run() but accepts custom execution context.

**main() (L554-615):** Command-line interface supporting script profiling, module profiling (-m flag), output file specification (-o), and sort options (-s).

### Key Dependencies
- `time.process_time` for high-resolution timing
- `sys.setprofile()` for trace hook registration  
- `marshal` for binary stats serialization
- `pstats` for formatted output
- `importlib.machinery` for module spec creation

### Architecture Notes
- Uses parallel stack (`self.cur`) to avoid contaminating profiled code
- Supports recursive function profiling with proper cumulative time accounting
- Bias correction system for accurate micro-benchmark timing
- Multiple timer backends for platform compatibility
- Event-driven architecture with dispatch table (L329-336)
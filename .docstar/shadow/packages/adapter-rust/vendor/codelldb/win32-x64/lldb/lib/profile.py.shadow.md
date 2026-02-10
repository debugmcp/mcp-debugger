# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/profile.py
@source-hash: dee2125b2a0913fc
@generated: 2026-02-09T18:13:06Z

**Primary Purpose:** Pure Python implementation of a profiler for analyzing code execution performance. Tracks function call hierarchies, timing data, and provides detailed statistics about program execution. Part of Python's standard library profiling infrastructure.

**Key Components:**

**Public Interface Functions (L82-101):**
- `run(statement, filename, sort)` - Executes and profiles a statement string
- `runctx(statement, globals, locals, filename, sort)` - Profiles with custom globals/locals

**Core Classes:**

**_Utils Helper Class (L43-75):**
- Utility wrapper for shared functionality between profile.py and cProfile.py
- Methods: `run()`, `runctx()`, `_show()` for execution and output handling

**Profile Main Class (L104-551):**
- **Initialization (L145-181):** Configures timer function, bias calibration, and dispatcher selection
- **Timer Dispatchers:** Multiple optimized trace dispatch methods for different timer types:
  - `trace_dispatch()` (L184-198) - For tuple-returning timers
  - `trace_dispatch_i()` (L202-213) - For scalar timers (fastest, default)
  - `trace_dispatch_mac()` (L217-228) - Macintosh 1/60th second ticks
  - `trace_dispatch_l()` (L231-242) - Generic list-returning timers

- **Event Handlers (L250-326):** Process Python trace events:
  - `trace_dispatch_call()` - Function entry
  - `trace_dispatch_return()` - Function exit  
  - `trace_dispatch_c_call()` - C function calls
  - `trace_dispatch_exception()` - Exception handling

- **Data Structures:**
  - `self.cur` - 6-tuple parallel stack tracking current frame state
  - `self.timings` - Dictionary storing 5-tuple timing statistics per function
  - Function names as (filename, line_number, function_name) tuples

- **Simulation Framework (L345-386):** 
  - `fake_code`/`fake_frame` classes for injecting custom profiler entries
  - `simulate_call()`/`simulate_cmd_complete()` for stack management

- **Output Methods (L388-410):**
  - `print_stats()` - Console output via pstats module
  - `dump_stats()` - Binary marshal format for persistence
  - `create_stats()`/`snapshot_stats()` - Data preparation

- **Execution Interface (L415-437):**
  - `run()`/`runctx()` - Profile code strings
  - `runcall()` - Profile single function calls

- **Calibration System (L479-551):** Measures profiler overhead for bias correction

**Main Entry Point (L554-615):**
Command-line interface supporting module profiling, script execution, and output formatting options.

**Architecture Notes:**
- Uses sys.setprofile() hook for trace event capture
- Maintains parallel call stack to avoid contaminating profiled program
- Timer abstraction supports multiple timing sources with optimized dispatchers
- Hierarchical timing tracks both internal function time and cumulative time including subfunctions
- Calibration system compensates for profiler measurement overhead

**Dependencies:** 
- Standard library: `sys`, `time`, `marshal`, `io`, `importlib.machinery`
- Runtime dependency on `pstats` for output formatting
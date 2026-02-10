# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/profile.py
@source-hash: dee2125b2a0913fc
@generated: 2026-02-09T18:07:27Z

This is Python's standard library profiler module, providing code execution profiling capabilities for performance analysis. The module is part of LLDB's Python distribution within a CodeLLDB debugging environment.

## Primary Purpose
Profiles Python code execution by tracking function calls, execution times, and call counts using sys.setprofile() hooks. Provides both programmatic and command-line interfaces for profiling scripts and code statements.

## Key Components

### Module-Level Functions
- **run()** (L82-93): Convenience function to profile a statement, optionally saving results to file
- **runctx()** (L95-101): Profiles statement with custom globals/locals context
- **main()** (L554-611): Command-line interface handling module execution with various options

### Core Classes

**_Utils** (L43-75): Utility class shared between profile.py and cProfile.py modules
- Provides common run/runctx implementations with consistent error handling
- Methods delegate to actual profiler instances via composition pattern

**Profile** (L104-551): Main profiler implementation
- **Data structures**:
  - `timings` dict: Maps function identifiers to 5-tuples of timing statistics
  - `cur` tuple: Maintains "parallel stack" tracking current execution context
  - Stack frame format: [parent_time, internal_time, external_time, func_name, frame, parent_tuple]
- **Timer dispatch methods** (L184-241):
  - `trace_dispatch()`: Optimized for 2-tuple timers
  - `trace_dispatch_i()`: Fastest for scalar timers (default: time.process_time)
  - `trace_dispatch_l()`: Generic for list-returning timers
  - `trace_dispatch_mac()`: Legacy Macintosh timer support
- **Event handlers** (L250-326):
  - `trace_dispatch_call()`: Handles function entry, updates stack and timing data
  - `trace_dispatch_return()`: Handles function exit, calculates final timings
  - `trace_dispatch_c_call()`: Tracks C function calls
  - `trace_dispatch_exception()`: Manages exception propagation
- **Execution methods**:
  - `run()/runctx()` (L415-427): Profile code strings in specified contexts
  - `runcall()` (L430-436): Profile single function calls
- **Output methods**:
  - `print_stats()` (L388-391): Display results using pstats module
  - `dump_stats()` (L393-396): Serialize results to binary file
- **Calibration**: `calibrate()` (L479-550): Measures profiler overhead for accuracy adjustment

**Nested Classes**:
- **fake_code** (L350-358): Simulates code objects for synthetic stack frames
- **fake_frame** (L360-363): Simulates frame objects for profiler metadata

## Key Dependencies
- `sys.setprofile()`: Core profiling hook mechanism
- `time.process_time`: Default high-resolution timer
- `marshal`: Binary serialization of profiling data
- `pstats`: Statistics display and analysis
- `importlib.machinery`: Module execution support

## Architecture Patterns
- **Strategy Pattern**: Multiple timer dispatch methods selected based on timer characteristics
- **State Machine**: Event-driven profiling with dispatch table (L329-336)
- **Parallel Stack**: Maintains shadow call stack to avoid contaminating profiled code
- **Template Method**: Base calibration framework with subclass override points

## Critical Invariants
- Stack consistency: `cur[-2]` always matches current frame being profiled
- Timer bias compensation: All timing calculations subtract calibrated overhead
- Recursive call handling: Nested calls tracked via stack depth counters
- Exception safety: Finally blocks ensure sys.setprofile(None) cleanup

## Performance Optimizations
- Timer-specific dispatch methods minimize overhead
- Local variable caching for frequently accessed attributes
- Inline timing calculations in hot paths
- Bias subtraction prevents systematic timing errors
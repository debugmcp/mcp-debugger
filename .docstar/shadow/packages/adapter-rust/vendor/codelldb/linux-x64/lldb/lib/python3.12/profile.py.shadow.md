# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/profile.py
@source-hash: dee2125b2a0913fc
@generated: 2026-02-09T18:10:06Z

## Core Purpose
Python profiler implementation providing performance analysis for Python code execution. This is the standard library profile module, offering both API functions and a command-line interface for profiling Python programs.

## Architecture
The module implements a deterministic profiler using Python's `sys.setprofile()` mechanism to intercept function call events. It maintains a parallel stack to track timing data without contaminating the profiled program.

## Key Classes & Functions

### _Utils (L43-75)
Utility class providing shared functionality between profile and cProfile modules. Contains:
- `run()` (L52-59): Executes statement under profiler with optional output to file
- `runctx()` (L61-68): Executes statement with custom globals/locals context
- `_show()` (L70-74): Handles output formatting (file dump or console print)

### Profile (L104-551)
Main profiler class implementing deterministic profiling:

#### Core Data Structures
- `timings` (L146): Dictionary storing 5-tuple timing data per function: `[call_count, stack_depth, internal_time, cumulative_time, callers_dict]`
- `cur` (L147): 6-tuple parallel stack representing current execution frame: `[parent_time, internal_time, external_time, function_name, frame, previous_tuple]`

#### Timer Management & Dispatch (L145-181)
Constructor selects optimal dispatcher based on timer type:
- `trace_dispatch_i()` (L202-212): Optimized for scalar timers (default with `time.process_time`)
- `trace_dispatch()` (L184-198): For 2-element timer tuples  
- `trace_dispatch_l()` (L231-241): Generic handler for timer lists
- `trace_dispatch_mac()` (L217-227): Macintosh-specific (1/60s ticks)

#### Event Handlers
- `trace_dispatch_call()` (L258-278): Handles function entry, creates new stack frame
- `trace_dispatch_return()` (L291-326): Handles function exit, updates timing statistics
- `trace_dispatch_c_call()` (L280-289): Handles C function calls
- `trace_dispatch_exception()` (L250-255): Handles exception propagation

#### Execution Interface
- `run()` (L415-418): Profiles string in `__main__` context
- `runctx()` (L420-427): Profiles string with custom globals/locals
- `runcall()` (L430-436): Profiles single function call

#### Statistics & Output
- `create_stats()` (L398-400): Finalizes timing data collection
- `snapshot_stats()` (L402-409): Converts internal timings to stats format
- `print_stats()` (L388-391): Pretty-prints results via pstats module
- `dump_stats()` (L393-396): Serializes stats to file using marshal

#### Simulation Framework (L345-386)
- `fake_code` (L350-358): Mock code object for artificial stack frames
- `fake_frame` (L360-363): Mock frame object 
- `simulate_call()` (L365-372): Creates artificial profiler entry
- `simulate_cmd_complete()` (L377-385): Cleans up pending stack frames

#### Calibration (L479-550)
- `calibrate()` (L479-488): Measures profiler overhead per event
- `_calibrate_inner()` (L490-550): Core calibration logic using nested function calls

### Module-Level API
- `run()` (L82-93): Convenient wrapper for profiling statements
- `runctx()` (L95-101): Wrapper for profiling with custom context
- `main()` (L554-611): Command-line interface supporting module execution and script profiling

## Dependencies
- `time.process_time`: Default high-resolution timer
- `sys.setprofile()`: Python profiling hook mechanism  
- `pstats`: Statistics formatting and display
- `marshal`: Binary serialization of profiling data
- `importlib.machinery`: Module loading for `__main__` execution

## Key Invariants
- Parallel stack (`cur`) maintains frame correspondence with actual call stack
- Timing data excludes profiler overhead through bias calibration
- Recursive calls tracked via stack depth counter to avoid double-counting cumulative time
- C function calls handled separately with empty filename/line number
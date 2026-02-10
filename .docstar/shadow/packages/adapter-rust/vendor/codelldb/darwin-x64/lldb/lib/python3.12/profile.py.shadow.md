# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/profile.py
@source-hash: dee2125b2a0913fc
@generated: 2026-02-09T18:08:05Z

## Primary Purpose
Python code profiler implementation providing deterministic performance analysis. Core module for timing Python code execution with call stack tracking and statistical reporting. Part of Python's standard library profiling infrastructure, serving as foundation for cProfile and pstats modules.

## Key Classes and Functions

### _Utils (L43-75)
Utility wrapper class shared between profile.py and cProfile.py modules. Contains common functionality for running profiling sessions:
- `run(statement, filename, sort)` (L52-59): Executes code under profiler with output handling
- `runctx(statement, globals, locals, filename, sort)` (L61-68): Executes code with custom namespace
- `_show(prof, filename, sort)` (L70-74): Handles profiler output (file dump or console print)

### Profile (L104-551) 
Main profiler class implementing deterministic profiling via sys.setprofile():

#### Core Data Structures
- `self.cur`: 6-tuple parallel stack tracking active frames (L107-125)
  - [0]: Time to charge to parent frame
  - [1]: Time in current function (excluding subfunctions) 
  - [2]: Time in subfunctions
  - [-3]: Function name tuple (filename, line, funcname)
  - [-2]: Actual frame reference
  - [-1]: Parent tuple reference
- `self.timings`: Dictionary storing 5-tuple timing stats per function (L127-141)
  - [0]: Call count (non-recursive)
  - [1]: Stack presence count
  - [2]: Internal execution time
  - [3]: Cumulative time including subfunctions
  - [4]: Callers dictionary

#### Timer Dispatch System (L145-241)
Multiple optimized trace dispatch routines based on timer type:
- `trace_dispatch_i()` (L202-212): Fastest - scalar timer (time.process_time default)
- `trace_dispatch()` (L184-197): 2-tuple timer
- `trace_dispatch_l()` (L231-241): Generic list-based timer
- `trace_dispatch_mac()` (L217-227): Legacy Macintosh 60Hz timer

#### Event Handlers (L250-326)
- `trace_dispatch_call()` (L258-278): Function entry - creates new stack frame
- `trace_dispatch_return()` (L291-326): Function exit - updates timing statistics
- `trace_dispatch_c_call()` (L280-289): C function entry tracking
- `trace_dispatch_exception()` (L250-255): Exception handling with stack unwinding

#### Simulation Framework (L345-386)
- `fake_code` (L350-358): Mock code object for artificial frames
- `fake_frame` (L360-363): Mock frame object 
- `simulate_call()` (L365-372): Creates artificial profiler entries
- `simulate_cmd_complete()` (L377-385): Finalizes timing collection

#### Public Interface
- `run(cmd)` (L415-418): Profile string command in __main__ namespace
- `runctx(cmd, globals, locals)` (L420-427): Profile with custom namespaces
- `runcall(func, *args, **kw)` (L430-436): Profile single function call
- `print_stats(sort)` (L388-391): Output results via pstats
- `dump_stats(file)` (L393-396): Save binary profiling data
- `calibrate(m, verbose)` (L479-550): Measure profiler overhead

## Module-Level Functions
- `run(statement, filename, sort)` (L82-93): Convenience wrapper using default Profile
- `runctx(statement, globals, locals, filename, sort)` (L95-101): Context-aware profiling
- `main()` (L554-611): Command-line interface implementation

## Dependencies
- `time.process_time` (default timer)
- `sys.setprofile()` for trace hook installation
- `marshal` for binary stats serialization
- `pstats` module for results formatting
- `importlib.machinery` for module spec creation

## Architectural Decisions
- Parallel stack implementation avoids contaminating profiled code frames
- Multiple timer dispatch routines optimize for different timer types
- Event-driven architecture using sys.setprofile() hook
- Bias correction system accounts for profiler overhead
- Recursive call detection via stack depth tracking

## Critical Invariants
- `self.cur` maintains frame stack integrity with parent references
- Timer bias must be calibrated for accurate measurements
- Exception handling preserves stack unwinding semantics  
- C function calls tracked separately due to limited introspection
- Statistics accumulation respects recursive vs non-recursive call semantics
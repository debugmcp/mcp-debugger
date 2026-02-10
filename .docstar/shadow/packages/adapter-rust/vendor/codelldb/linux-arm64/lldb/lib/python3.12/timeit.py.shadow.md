# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/timeit.py
@source-hash: d47d9deb6be0136d
@generated: 2026-02-09T18:09:17Z

**Purpose**: Standard Python timing utility module for measuring execution time of small code snippets with statistical accuracy.

**Core Components**:

- **Timer class (L86-232)**: Main timing interface that compiles and executes code in controlled environment
  - `__init__` (L104-137): Accepts stmt/setup as strings or callables, compiles into executable template
  - `timeit` (L166-184): Executes statement N times with GC disabled, returns total time
  - `repeat` (L186-210): Calls timeit multiple times, returns list of results
  - `autorange` (L212-231): Auto-determines optimal iteration count for ~0.2s total time
  - `print_exc` (L139-164): Enhanced traceback display for timed code errors

**Standalone Functions**:
- `timeit` (L234-237): Convenience wrapper around Timer.timeit
- `repeat` (L240-243): Convenience wrapper around Timer.repeat  
- `main` (L246-377): CLI interface with argument parsing and result formatting

**Key Constants**:
- `template` (L69-78): Code template for timing loop with setup/statement placeholders
- `default_timer` (L62): Points to time.perf_counter for high-resolution timing
- `default_number/repeat` (L60-61): Default iteration counts (1M loops, 5 repeats)

**Architecture Patterns**:
- **Code generation**: Dynamic compilation of timing loops via template formatting
- **GC isolation**: Disables garbage collection during timing for consistency
- **Statistical approach**: Multiple measurements with min() recommendation for best performance
- **Dual interfaces**: Both programmatic (Timer class) and CLI interfaces

**Dependencies**: gc, itertools, sys, time, getopt, os, linecache, traceback, warnings

**Critical Invariants**:
- Template indentation must remain fixed (4 spaces setup, 8 spaces statement) for reindent() 
- GC state restored in finally block to prevent system-wide changes
- Autorange uses 1,2,5 sequence scaling to find appropriate iteration count
- CLI returns proper exit codes (0=success, 1=timing error, 2=argument error)
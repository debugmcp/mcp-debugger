# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/code.py
@source-hash: dab54e60985a3770
@generated: 2026-02-09T18:12:53Z

## Purpose
Python interactive interpreter emulation module providing classes to create REPL-like environments. Part of codelldb's LLDB debugging toolkit, enabling interactive Python execution within debugging contexts.

## Core Classes

### InteractiveInterpreter (L15-169)
Base interpreter class handling code parsing and execution state management.

**Key Methods:**
- `__init__(locals=None)` (L24): Initializes with custom namespace or default console environment
- `runsource(source, filename="<input>", symbol="single")` (L38): Main execution pipeline - compiles and runs source code, returns True if more input needed
- `runcode(code)` (L77): Executes compiled code object with exception handling (catches all except SystemExit)
- `showsyntaxerror(filename=None)` (L96): Displays syntax errors with optional filename substitution
- `showtraceback()` (L124): Shows runtime exceptions, removing interpreter stack frame
- `_showtraceback(typ, value, tb)` (L138): Internal traceback display with sys.excepthook integration
- `write(data)` (L161): Output method (defaults to sys.stderr), designed for subclass override

**State Management:**
- `self.locals`: Execution namespace dictionary
- `self.compile`: CommandCompiler instance for code compilation

### InteractiveConsole (L171-284)
Enhanced interpreter with REPL interface, input buffering, and prompting.

**Key Methods:**
- `__init__(locals=None, filename="<console>")` (L179): Inherits from InteractiveInterpreter, adds filename tracking
- `interact(banner=None, exitmsg=None)` (L197): Main REPL loop with banner/exit message handling
- `push(line)` (L251): Buffers input lines, attempts execution when complete
- `resetbuffer()` (L193): Clears input buffer
- `raw_input(prompt="")` (L272): Input method using built-in input(), designed for override

**REPL State:**
- `self.buffer`: List storing incomplete input lines
- `self.filename`: Source identifier for tracebacks

## Module Functions

### interact(banner=None, readfunc=None, local=None, exitmsg=None) (L287-310)
Convenience function creating InteractiveConsole instance with optional readline support. Backwards-compatible interface for simple REPL creation.

### Main Execution (L313-324)
Command-line interface with argparse supporting quiet mode (-q flag).

## Dependencies
- `sys`: System-specific parameters and functions
- `traceback`: Exception formatting
- `codeop.CommandCompiler`: Python code compilation with multi-line support
- `readline`: Optional GNU readline support for enhanced input

## Architecture Patterns
- Template method pattern: Base interpreter defines execution flow, console adds UI
- Exception handling hierarchy: Distinguishes SystemExit, syntax errors, and runtime exceptions
- Namespace isolation: Each interpreter maintains separate execution context
- Extensible I/O: write() and raw_input() methods designed for subclass customization

## Critical Invariants
- Buffer management: Incomplete input preserved until syntactically complete
- Exception propagation: SystemExit always re-raised, other exceptions displayed
- Namespace consistency: locals dictionary persists across interactions
- Prompt state: more/continuation determined by compilation result
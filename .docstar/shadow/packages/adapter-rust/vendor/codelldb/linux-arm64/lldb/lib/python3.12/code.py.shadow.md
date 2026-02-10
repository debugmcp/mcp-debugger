# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/code.py
@source-hash: dab54e60985a3770
@generated: 2026-02-09T18:08:37Z

## Purpose
Provides utilities to emulate Python's interactive interpreter, enabling programmatic creation of Python REPL environments. Core functionality includes command compilation, execution, and error handling for interactive code sessions.

## Key Classes

### InteractiveInterpreter (L15-169)
Base class handling code parsing and execution within a user namespace.
- **`__init__(locals=None)`** (L24-36): Initializes with optional locals dict, defaults to `{"__name__": "__console__", "__doc__": None}`
- **`runsource(source, filename, symbol)`** (L38-75): Core method that compiles and executes source code, returns boolean indicating if more input needed
- **`runcode(code)`** (L77-94): Executes compiled code object, catches all exceptions except SystemExit
- **`showsyntaxerror(filename)`** (L96-122): Displays syntax errors with optional filename substitution
- **`showtraceback()`** (L124-136): Displays runtime exceptions, removes interpreter's own stack frame
- **`_showtraceback(typ, value, tb)`** (L138-159): Internal traceback display with sys.excepthook support
- **`write(data)`** (L161-168): Output method, defaults to sys.stderr

### InteractiveConsole (L171-283)
Extends InteractiveInterpreter with prompting and input buffering for full console emulation.
- **`__init__(locals, filename)`** (L179-191): Initializes base class and sets up buffer
- **`resetbuffer()`** (L193-195): Clears input buffer
- **`interact(banner, exitmsg)`** (L197-249): Main console loop with prompts, handles EOF and KeyboardInterrupt
- **`push(line)`** (L251-270): Adds line to buffer and attempts execution, returns if more input needed
- **`raw_input(prompt)`** (L272-283): Input method, wraps built-in input()

## Key Functions

### `interact(banner, readfunc, local, exitmsg)` (L287-310)
Convenience function creating InteractiveConsole with optional readline support. Provides backwards compatibility interface.

### Main execution block (L313-324)
Command-line interface with argparse for quiet mode flag.

## Dependencies
- **sys**: System-specific parameters and functions
- **traceback**: Exception formatting utilities  
- **codeop.CommandCompiler**: Code compilation with interactive semantics
- **readline** (optional): GNU readline for enhanced input

## Architecture Patterns
- **Template Method**: InteractiveInterpreter defines execution flow, subclasses customize I/O
- **State Machine**: Console tracks "more input needed" state via boolean returns
- **Error Isolation**: Systematic exception handling separates syntax vs runtime errors

## Critical Invariants
- Buffer state must be reset after complete command execution
- SystemExit exceptions always propagate (never caught)
- Traceback display respects custom sys.excepthook handlers
- Input lines joined with newlines for multi-line command reconstruction
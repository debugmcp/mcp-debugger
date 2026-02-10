# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/code.py
@source-hash: dab54e60985a3770
@generated: 2026-02-09T18:07:05Z

## Interactive Python Interpreter Emulation Module

This module provides utilities for emulating Python's interactive interpreter, offering both basic interpretation capabilities and a full console interface.

**Primary Purpose**: Enables embedding of interactive Python sessions within applications, providing command compilation, execution, and error handling with proper prompting and buffering.

### Core Classes

**InteractiveInterpreter (L15-169)**
- Base interpreter class handling code compilation and execution
- Manages execution namespace via `locals` dictionary (defaults to `{"__name__": "__console__", "__doc__": None}`)
- Key methods:
  - `__init__(locals=None)` (L24-36): Constructor with optional namespace
  - `runsource(source, filename, symbol)` (L38-75): Compiles and executes source code, returns True if more input needed
  - `runcode(code)` (L77-94): Executes compiled code object in the interpreter's namespace
  - `showsyntaxerror(filename)` (L96-122): Displays syntax errors with filename correction
  - `showtraceback()` (L124-136): Shows runtime exceptions, removing interpreter stack frames
  - `write(data)` (L161-168): Output method (writes to stderr by default)

**InteractiveConsole (L171-283)**
- Extends InteractiveInterpreter with prompting and input buffering
- Emulates full Python console behavior with ps1/ps2 prompts
- Key methods:
  - `__init__(locals, filename)` (L179-191): Constructor with optional filename for tracebacks
  - `interact(banner, exitmsg)` (L197-249): Main console loop with banner display and exit handling
  - `push(line)` (L251-270): Adds line to buffer and attempts execution
  - `raw_input(prompt)` (L272-283): Input method (uses built-in `input()`)
  - `resetbuffer()` (L193-195): Clears input buffer

### Key Dependencies
- `sys`: System-specific parameters and functions
- `traceback`: Exception formatting
- `codeop.CommandCompiler`: Code compilation with multi-line support
- `codeop.compile_command`: Exported for external use

### Module-Level Functions

**interact(banner, readfunc, local, exitmsg)** (L287-310)
- Convenience function providing backwards-compatible interface
- Automatically attempts readline import for enhanced input editing
- Creates InteractiveConsole instance and starts interaction loop

**Main Script Behavior** (L313-324)
- Command-line interface with `-q` flag for quiet mode
- Respects `sys.flags.quiet` for banner suppression

### Key Patterns & Invariants

1. **Exception Handling**: SystemExit is always re-raised to allow proper program termination
2. **Namespace Management**: User code executes in controlled `locals` dictionary
3. **Error Display**: Custom exception formatting with filename correction for better debugging
4. **Buffer Management**: Input lines accumulated until complete statement formed
5. **Prompt State**: Uses `sys.ps1`/`sys.ps2` with fallback defaults (">>> " and "... ")
6. **Hook Compatibility**: Respects custom `sys.excepthook` while providing fallback error handling

### Critical Behaviors
- Incomplete code returns True from `runsource()` to indicate more input needed
- Syntax errors are caught and displayed without terminating session
- KeyboardInterrupt handling resets buffer and continues session
- All user code executes in the same persistent namespace across interactions
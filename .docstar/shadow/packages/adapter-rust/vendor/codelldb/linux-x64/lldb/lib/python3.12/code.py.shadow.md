# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/code.py
@source-hash: dab54e60985a3770
@generated: 2026-02-09T18:09:38Z

## Purpose
Interactive Python interpreter emulation utilities. Provides base classes and functions to create custom REPL-like environments that can parse, compile, and execute Python code interactively with proper error handling and state management.

## Core Classes

### InteractiveInterpreter (L15-169)
Base class for building interactive Python interpreters. Handles code parsing, compilation, and execution without dealing with input/output or prompting.

**Key Methods:**
- `__init__(locals=None)` (L24-36): Initializes with optional namespace dictionary, defaults to `{"__name__": "__console__", "__doc__": None}`
- `runsource(source, filename="<input>", symbol="single")` (L38-75): Central method that compiles and executes source code, returns `True` if more input needed, `False` otherwise
- `runcode(code)` (L77-94): Executes compiled code object within interpreter's local namespace, catches all exceptions except `SystemExit`
- `showsyntaxerror(filename=None)` (L96-122): Displays syntax errors with optional filename substitution
- `showtraceback()` (L124-136): Displays runtime exceptions, removes first stack frame (interpreter's own code)
- `_showtraceback(typ, value, tb)` (L138-159): Internal traceback handling with `sys.excepthook` support
- `write(data)` (L161-168): Output method, defaults to `sys.stderr.write`, designed for subclass override

### InteractiveConsole (L171-283)
Full-featured interactive console that extends `InteractiveInterpreter` with input buffering, prompting, and REPL loop functionality.

**Key Methods:**
- `__init__(locals=None, filename="<console>")` (L179-191): Extends base with filename tracking and buffer initialization
- `resetbuffer()` (L193-195): Clears input buffer (list of accumulated lines)
- `interact(banner=None, exitmsg=None)` (L197-249): Main REPL loop with banner display, prompt handling (`sys.ps1`/`sys.ps2`), and exit messaging
- `push(line)` (L251-270): Adds line to buffer, attempts compilation/execution, resets buffer if complete
- `raw_input(prompt="")` (L272-283): Input method using built-in `input()`, designed for subclass override

## Standalone Function

### interact(banner=None, readfunc=None, local=None, exitmsg=None) (L287-310)
Convenience function providing backwards-compatible interface to `InteractiveConsole`. Automatically attempts to import `readline` for enhanced input capabilities if available.

## Dependencies
- `sys`: System-specific parameters and functions
- `traceback`: Exception formatting and display
- `codeop.CommandCompiler`: Code compilation with proper handling of incomplete statements
- `codeop.compile_command`: Re-exported for external use

## Architecture Patterns
- **Template Method**: Base interpreter provides framework, subclasses customize specific behaviors
- **State Machine**: Tracks completion state of multi-line input through buffer management
- **Delegation**: Console delegates core interpretation to base class while handling I/O concerns
- **Hook System**: Supports custom `sys.excepthook` and allows method override for customization

## Critical Invariants
- `self.locals` namespace persists across executions maintaining interpreter state
- Buffer accumulates lines until complete statement is formed
- `SystemExit` exceptions always propagate up (not caught in `runcode`)
- Traceback display removes interpreter's own stack frame to show user code context
- Return values from `runsource`/`push` indicate whether more input is required (True) or statement is complete/invalid (False)
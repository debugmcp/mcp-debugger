# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/pdb.py
@source-hash: 1bde5c23a8549588
@generated: 2026-02-09T18:07:28Z

**Purpose**: Python Debugger (Pdb) - Complete interactive debugging environment for Python programs, providing breakpoints, stepping, stack inspection, and post-mortem debugging capabilities.

## Core Classes

**Restart (L91-93)**: Exception class used internally to signal debugger restart requests.

**_rstr (L120-124)**: String subclass that returns itself as repr without quotes, used for special debugger output formatting.

**_ScriptTarget (L126-164)**: Handles debugging of Python script files. Key responsibilities:
- Validates script existence and accessibility (L136-145)
- Provides execution namespace with __main__ context (L152-158)  
- Compiles script code for execution (L161-163)

**_ModuleTarget (L166-206)**: Handles debugging of Python modules via -m flag. Uses runpy for module resolution (L177-180) and provides proper module namespace setup (L197-205).

**Pdb (L215-1795)**: Main debugger class inheriting from bdb.Bdb and cmd.Cmd. Central orchestrator for all debugging operations.

### Key Pdb Methods

**Initialization & Setup**:
- `__init__` (L219-264): Sets up readline, signal handlers, RC file processing, breakpoint command infrastructure
- `setup` (L286-308): Initializes debugging session with frame/traceback, processes .pdbrc commands
- `reset`/`forget` (L273-284): Cleans up debugger state between sessions

**Core Debugging Hooks** (bdb.Bdb overrides):
- `user_call` (L312-319): Handles function call breaks
- `user_line` (L321-329): Handles line-by-line execution breaks  
- `user_return` (L355-362): Handles function return breaks
- `user_exception` (L364-381): Handles exception breaks with special StopIteration handling

**Command Processing**:
- `interaction` (L412-432): Main debugging loop with signal handling and display updates
- `onecmd` (L525-539): Command interpreter with breakpoint command list support
- `default` (L442-461): Executes Python statements in debugged program context
- `precmd` (L496-523): Handles alias expansion, command separation (;;), convenience variables

**Breakpoint Commands** (L646-1061):
- `do_break` (L731-825): Set breakpoints with file:line or function syntax, conditions
- `do_commands` (L646-728): Define command sequences for breakpoints
- `do_clear` (L1011-1058): Remove breakpoints by number or location
- `do_condition` (L944-971): Set/modify breakpoint conditions

**Execution Control** (L1125-1294):
- `do_step`/`do_next`/`do_continue` (L1150-1219): Program flow control
- `do_until` (L1125-1148): Continue until line number reached
- `do_jump` (L1221-1249): Modify execution line (bottom frame only)
- `do_return` (L1193-1200): Continue until function returns

**Inspection Commands**:
- `do_list`/`do_longlist` (L1379-1449): Source code display with breakpoint markers
- `do_where` (L1063-1072): Stack trace printing
- `do_up`/`do_down` (L1083-1123): Frame navigation
- `do_args` (L1296-1312): Function argument display
- `do_p`/`do_pp` (L1361-1377): Value printing and pretty-printing

**Advanced Features**:
- `do_display`/`do_undisplay` (L1526-1568): Auto-display expressions on frame changes
- `do_interact` (L1570-1577): Launch interactive interpreter in current context
- `do_alias`/`do_unalias` (L1579-1629): Command alias system
- `do_debug` (L1251-1271): Recursive debugger for expressions

**Convenience Variables** (L577-580): Special variables like $_frame, $_retval, $_exception accessible via $ syntax.

## Module Functions

**High-level Interface** (L818-867):
- `run()`/`runeval()`/`runctx()`: Execute code under debugger
- `runcall()`: Debug function calls  
- `set_trace()`: Hard-coded breakpoint insertion

**Post-mortem Debugging** (L871-898):
- `post_mortem()`: Debug from traceback object
- `pm()`: Debug from sys.last_traceback

**Utilities**:
- `find_function()` (L98-109): Locate function definition in source
- `lasti2lineno()` (L111-117): Convert bytecode offset to line number

## Architecture

Built on bdb (Breakpoint Debugger) foundation with cmd (Command Processor) interface. Uses Python's trace facility for execution monitoring. Supports both interactive debugging and programmatic breakpoint insertion.

**Dependencies**: bdb, cmd, sys, traceback, linecache, inspect, tokenize, signal, code, dis, plus I/O and utility modules.

**Key Patterns**: Command pattern for debugger operations, template method for bdb hooks, observer pattern for display expressions, extensive use of introspection for frame/code analysis.
# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/pdb.py
@source-hash: 1bde5c23a8549588
@generated: 2026-02-09T18:13:08Z

## Python Debugger (pdb) Module

**Primary Purpose**: Implementation of Python's interactive debugger, providing debugging capabilities including breakpoints, step execution, stack inspection, and code evaluation.

### Core Classes

**Pdb (L215-1795)**: Main debugger class inheriting from `bdb.Bdb` and `cmd.Cmd`
- Primary debugger interface with command-line interaction
- Manages breakpoints, stack frames, execution control
- Key state: `curframe`, `stack`, `aliases`, `commands`, `displaying`
- Initializes with optional parameters for input/output redirection (L219-265)

**Restart (L91-93)**: Exception class for debugger restart functionality

**_rstr (L120-123)**: String subclass with custom repr() that returns the string itself

**_ScriptTarget (L126-164)**: Handles debugging of script files
- Resolves real paths and validates file existence (L127-142)
- Provides namespace setup for `__main__` execution (L152-158)
- Generates execution code from file contents (L160-163)

**_ModuleTarget (L166-206)**: Handles debugging of Python modules
- Uses `runpy._get_module_details()` for module resolution (L177-180)
- Provides proper namespace with module spec information (L197-205)

### Key Methods

**Setup and Control**:
- `setup(f, tb)` (L286-308): Initializes debugging session with frame and traceback
- `interaction(frame, traceback)` (L412-432): Main interaction loop
- `_cmdloop()` (L384-394): Command loop with keyboard interrupt handling

**Execution Control**:
- `user_line(frame)` (L321-329): Called when stopping at a line
- `user_call(frame, argument_list)` (L312-319): Called on function entry
- `user_return(frame, return_value)` (L355-362): Called on function return
- `user_exception(frame, exc_info)` (L364-381): Called on exceptions

**Command Processing**:
- `onecmd(line)` (L525-539): Processes single commands with special handling for breakpoint commands
- `precmd(line)` (L496-523): Preprocesses commands for aliases and convenience variables
- `default(line)` (L442-461): Executes Python code in debugged context

**Breakpoint Management**:
- `do_break(arg, temporary=0)` (L731-825): Sets breakpoints with file:line or function syntax
- `do_clear(arg)` (L1011-1057): Clears breakpoints
- `bp_commands(frame)` (L331-353): Executes commands associated with breakpoints

### Utility Functions

**Module Interface**:
- `run(statement, globals, locals)` (L818-831): Execute statement under debugger
- `set_trace(*, header=None)` (L856-867): Hard-coded breakpoint entry
- `post_mortem(t=None)` (L871-890): Debug from traceback
- `pm()` (L892-898): Debug last exception

**Helper Functions**:
- `find_function(funcname, filename)` (L98-109): Locates function definition in file
- `lasti2lineno(code, lasti)` (L111-117): Converts bytecode offset to line number

### Important Patterns

**Command Definition**: All debugger commands follow `do_<command>` pattern with corresponding `complete_<command>` for tab completion

**Convenience Variables**: Special variables like `$_frame`, `$_retval` accessible in debugged context (L577-580)

**Alias System**: Command aliases with parameter substitution using %1, %2, %* (L496-523)

**Display Expressions**: Auto-evaluation of expressions on each stop (L398-410, L526-547)

### Configuration

**RC Files**: Loads `.pdbrc` from home and current directory (L242-254)
**Signal Handling**: Manages SIGINT for graceful interruption (L266-271, L414-420)
**Line Prefix**: Configurable prompt prefix for code display (L208-213)

### Dependencies

Core: `bdb`, `cmd`, `sys`, `traceback`, `inspect`, `linecache`
Optional: `readline` for enhanced command-line editing
Utility: `glob`, `tokenize`, `pprint`, `signal`, `code`

The module provides both programmatic debugging interface and standalone script execution via `main()` (L929-981) with command-line argument processing.
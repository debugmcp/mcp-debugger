# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/pdb.py
@source-hash: 1bde5c23a8549588
@generated: 2026-02-09T18:10:04Z

## Python Debugger (pdb) Implementation

**Primary Purpose**: Complete implementation of Python's interactive debugger, providing command-line debugging capabilities for Python programs with breakpoints, stack inspection, and execution control.

### Core Classes

**Pdb (L215-1795)**: Main debugger class inheriting from both `bdb.Bdb` and `cmd.Cmd`
- Combines base debugger functionality with interactive command processing
- Manages debugger state, breakpoints, stack frames, and user interaction
- Key initialization attributes: `aliases` (L227), `displaying` (L228), `mainpyfile` (L229)
- Signal handling for keyboard interrupts via `sigint_handler` (L266-271)

**Restart (L91-93)**: Exception class to trigger debugger restart
**_rstr (L120-123)**: String subclass that returns itself as repr (for safe error display)
**_ScriptTarget (L126-164)**: Handles script file execution with path validation and namespace setup
**_ModuleTarget (L166-206)**: Handles module execution using `runpy` for proper module loading

### Key Methods & Functionality

**Debugger Lifecycle**:
- `setup` (L286-308): Initialize debugging session with frame/traceback
- `interaction` (L412-432): Main debug interaction loop with signal management
- `reset`/`forget` (L273-284): Clean up debugger state

**Breakpoint Management**:
- `do_break` (L731-825): Set breakpoints with file:line or function syntax
- `do_clear` (L1011-1058): Remove breakpoints
- `do_enable`/`do_disable` (L905-941): Toggle breakpoint states
- `do_condition` (L944-971): Set conditional breakpoints

**Execution Control**:
- `do_step`/`do_next` (L1150-1169): Single-step execution
- `do_continue` (L1202-1219): Resume execution until breakpoint
- `do_return` (L1193-1200): Run until function returns
- `do_until` (L1125-1148): Run until specific line number

**Stack Navigation**:
- `do_where` (L1063-1072): Print stack trace
- `do_up`/`do_down` (L1083-1123): Navigate stack frames
- `_select_frame` (L1074-1081): Change current frame context

**Code Inspection**:
- `do_list` (L1379-1434): Display source code around current line
- `do_longlist` (L1436-1449): Show entire function/frame source
- `do_source` (L1451-465): Display source for arbitrary objects

### Advanced Features

**Convenience Variables**: `$variable` syntax automatically replaced with `__pdb_convenience_variables["variable"]` (L463-494)

**Display Expressions**: `do_display` (L1526-1548) tracks variable changes across debugging sessions

**Aliases**: `do_alias` (L1579-1616) allows custom command shortcuts with parameter substitution

**Command Lists**: `do_commands` (L646-727) attaches command sequences to breakpoints

**Interactive Mode**: `do_interact` (L1570-577) starts full Python REPL in current context

### Utility Functions

**Module Resolution**: `lookupmodule` (L1712-1734) resolves file/module names for breakpoints
**Line Validation**: `checkline` (L883-903) ensures breakpoint placement on executable lines
**Expression Evaluation**: `_getval`/`_getval_except` (L1325-1339) safely evaluate expressions in debug context

### Public API Functions (L1818-1898)

- `run(statement)`: Debug a statement string
- `runeval(expression)`: Debug and return expression result  
- `runcall(*args)`: Debug function call
- `set_trace()`: Insert breakpoint at call site
- `post_mortem(traceback)`: Debug from existing traceback
- `pm()`: Debug last exception traceback

### Command-Line Interface

**main() (L1929-1982)**: Full CLI implementation supporting:
- Script and module debugging (`-m` flag)
- Initial commands (`-c` flag)
- Automatic restart on program completion
- Post-mortem debugging on uncaught exceptions

### Dependencies

Critical imports: `bdb` (base debugger), `cmd` (command processing), `inspect` (code introspection), `linecache` (source retrieval), `signal` (interrupt handling), `traceback` (error formatting)

### Architectural Notes

- Uses multiple inheritance pattern combining debugger backend (`bdb.Bdb`) with interactive frontend (`cmd.Cmd`)
- Implements comprehensive command completion for all debugger operations
- Maintains backward compatibility with older Python debugging interfaces
- Handles both script files and importable modules through target abstraction classes
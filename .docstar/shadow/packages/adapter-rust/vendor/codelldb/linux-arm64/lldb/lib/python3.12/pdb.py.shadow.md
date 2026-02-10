# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/pdb.py
@source-hash: 1bde5c23a8549588
@generated: 2026-02-09T18:09:07Z

**Primary Purpose**: Python Debugger (Pdb) - Interactive source-level debugger for Python programs, providing breakpoint management, stack inspection, and step-through execution control.

## Core Architecture

**Main Debugger Class**: `Pdb` (L215-1796) - Inherits from `bdb.Bdb` and `cmd.Cmd`
- Combines breakpoint debugging capabilities with command-line interface
- Manages execution state, breakpoints, and user interaction
- Provides 40+ debugging commands with completion support

**Target Execution Classes**:
- `_ScriptTarget` (L126-164) - Handles debugging Python script files
- `_ModuleTarget` (L166-206) - Handles debugging Python modules via `-m` flag
- Both provide unified interface for code execution with proper namespace setup

## Key Functionality Groups

**Breakpoint Management** (L731-1061):
- `do_break`/`do_b` (L731) - Set breakpoints with conditions
- `do_tbreak` (L840) - Temporary breakpoints  
- `do_clear`/`do_cl` (L1011) - Remove breakpoints
- `do_enable`/`do_disable` (L905, L923) - Toggle breakpoint states
- `do_condition`/`do_ignore` (L944, L975) - Modify breakpoint behavior

**Execution Control** (L1125-1284):
- `do_step`/`do_s` (L1150) - Step into calls
- `do_next`/`do_n` (L1161) - Step over calls
- `do_continue`/`do_c` (L1202) - Resume execution
- `do_until` (L1125) - Run until line number
- `do_return`/`do_r` (L1193) - Run until function return
- `do_jump`/`do_j` (L1221) - Change execution line

**Stack/Frame Navigation** (L1063-1124):
- `do_where`/`do_w`/`do_bt` (L1063) - Print stack trace
- `do_up`/`do_u` (L1083) - Move up stack frames
- `do_down`/`do_d` (L1104) - Move down stack frames

**Code Inspection** (L1379-1523):
- `do_list`/`do_l` (L1379) - List source code around current line
- `do_longlist`/`do_ll` (L1436) - List entire function source
- `do_source` (L1451) - Show source for expression
- `do_whatis` (L1490) - Show object type information

**Expression Evaluation** (L1296-1377):
- `do_p` (L1361) - Print expression value
- `do_pp` (L1368) - Pretty-print expression value
- `do_args`/`do_a` (L1296) - Show function arguments
- `do_retval`/`do_rv` (L1314) - Show return value

## Core Interaction Loop

**Command Processing**:
- `interaction` (L412) - Main debugging session entry point
- `_cmdloop` (L384) - Handles keyboard interrupts during command input
- `onecmd` (L525) - Processes individual commands with breakpoint command support
- `precmd` (L496) - Handles alias expansion and convenience variables

**Event Handlers** (overriding bdb.Bdb):
- `user_line` (L321) - Called at each line execution
- `user_call` (L312) - Called at function entry
- `user_return` (L355) - Called at function exit  
- `user_exception` (L364) - Called on exceptions

## Advanced Features

**Convenience Variables** (L463-494):
- Automatic `$variable` replacement with `__pdb_convenience_variables["variable"]`
- Built-in variables: `_frame`, `_retval`, `_exception`

**Display Expressions** (L526-568):
- `do_display` (L526) - Auto-evaluate expressions on each stop
- `do_undisplay` (L551) - Remove display expressions
- Tracks value changes between stops

**Command Aliases** (L579-629):
- `do_alias` (L579) - Create command shortcuts with parameters
- Supports `%1`, `%2`, `%*` parameter substitution

**Configuration**:
- Reads `.pdbrc` files from home and current directory (L242-254)
- Supports initial command execution via `-c` flag
- Configurable via `readrc`, `nosigint` parameters

## Entry Points

**Direct Usage** (L818-898):
- `run(statement)` (L818) - Debug a statement
- `runeval(expression)` (L833) - Debug and return expression value
- `runcall(*args)` (L846) - Debug function call
- `set_trace()` (L856) - Insert hard breakpoint
- `post_mortem(traceback)` (L871) - Debug from traceback
- `pm()` (L892) - Debug last exception

**Command Line Interface** (L929-1982):
- `main()` (L929) - Entry point for `python -m pdb` 
- Supports script files and modules (`-m` flag)
- Handles program restart and exception recovery

## Dependencies
- **Core**: `bdb`, `cmd` for base debugging and command infrastructure
- **Code Analysis**: `inspect`, `dis`, `linecache`, `tokenize` for source examination  
- **Utilities**: `glob`, `pprint`, `traceback`, `signal` for various features
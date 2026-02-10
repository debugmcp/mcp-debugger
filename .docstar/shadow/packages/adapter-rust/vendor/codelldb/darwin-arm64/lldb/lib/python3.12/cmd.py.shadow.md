# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/cmd.py
@source-hash: fb82a8c4e44e5b55
@generated: 2026-02-09T18:07:12Z

## Purpose
Core framework for building line-oriented command interpreters with interactive command loops, tab completion, and help systems. Part of Python's standard library `cmd` module.

## Core Architecture

**Cmd class (L52-401)**: Main framework class providing:
- Interactive command loop with prompt-based input
- Automatic command dispatching via `do_*` method pattern
- Built-in tab completion and help system
- Customizable hooks for command processing

## Key Methods

**Command Loop & Processing**:
- `cmdloop(intro=None)` (L98-148): Main interactive loop handling input, command parsing, and dispatch
- `onecmd(line)` (L192-217): Single command interpreter - parses line and calls appropriate `do_*` method
- `parseline(line)` (L172-190): Parses input into (command, args, line) tuple with special handling for `?` (help) and `!` (shell)

**Hook Methods** (overrideable):
- `precmd(line)` (L150-155): Pre-processing hook before command execution
- `postcmd(stop, line)` (L157-159): Post-processing hook after command execution  
- `preloop()` (L161-163): Called once before cmdloop starts
- `postloop()` (L165-170): Called once when cmdloop exits
- `emptyline()` (L219-227): Handles empty input (repeats last command by default)
- `default(line)` (L229-236): Handles unrecognized commands

**Completion System**:
- `complete(text, state)` (L251-279): Main completion entry point using readline
- `completenames(text, *ignored)` (L247-249): Completes command names from `do_*` methods
- `completedefault(*ignored)` (L238-245): Default completion when no `complete_*` method exists

**Help System**:
- `do_help(arg)` (L292-336): Built-in help command showing available commands and topics
- `complete_help(*args)` (L286-290): Tab completion for help command
- `print_topics(header, cmds, cmdlen, maxcol)` (L338-344): Formats help output sections
- `columnize(list, displaywidth=80)` (L346-401): Multi-column formatting for command lists

## Configuration Attributes

**Prompts & Display**:
- `prompt` (L64): Command prompt string (default: "(Cmd) ")
- `ruler` (L66): Character for drawing separator lines in help (default: "=")
- `intro` (L68): Startup message shown when cmdloop begins

**Headers for Help System**:
- `doc_header` (L70): Header for documented commands section
- `misc_header` (L71): Header for miscellaneous help topics  
- `undoc_header` (L72): Header for undocumented commands

**Behavior Control**:
- `identchars` (L65): Valid characters for command names (letters, digits, underscore)
- `use_rawinput` (L74): Whether to use input() vs stdin.readline()
- `cmdqueue` (L95): Queue of commands to execute before prompting user

## Dependencies
- `string`: For character sets (ascii_letters, digits)
- `sys`: For stdin/stdout access
- `readline`: Optional for tab completion (imported dynamically)

## Usage Pattern
Subclass `Cmd` and implement `do_*` methods for commands. Optionally implement `complete_*` methods for tab completion and `help_*` methods for custom help topics. Call `cmdloop()` to start the interactive interpreter.

## Notable Design Decisions
- Command dispatch uses reflection (`getattr`) to find `do_*` methods
- Special syntax: `?` becomes `help`, `!` becomes `shell` (if `do_shell` exists)
- EOF handling: converts EOF input to 'EOF' command
- Completion integration with readline library for terminal-like experience
- Empty line repeats last command (stored in `lastcmd`)
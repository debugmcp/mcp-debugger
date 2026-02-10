# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/shlex.py
@source-hash: f927227de5ba5b1b
@generated: 2026-02-09T18:07:21Z

This file implements a lexical analyzer for shell-like command parsing, providing functionality to tokenize command strings with proper quote handling, escaping, and POSIX compliance options.

## Core Components

**shlex class (L19-303)** - Main lexical analyzer with state machine-based tokenization
- `__init__(L21-66)` - Configures lexer mode (POSIX/non-POSIX), punctuation handling, and character sets
- `get_token(L101-131)` - Primary token extraction with source inclusion and EOF handling
- `read_token(L133-277)` - Core tokenization state machine handling quotes, escapes, whitespace
- `push_token(L72-76)` / `push_source(L78-90)` / `pop_source(L92-99)` - Token/source stack management
- `sourcehook(L279-286)` - File inclusion mechanism with relative path resolution
- Iterator protocol via `__iter__` and `__next__` (L296-303)

**Module Functions**
- `split(L305-313)` - Convenience function to tokenize strings into lists
- `join(L316-318)` - Reconstruct command from token list with proper escaping
- `quote(L323-332)` - Shell-escape individual strings using single quotes
- `_print_tokens(L335-337)` - Debug utility for token visualization

## Key Architecture

**State Machine States:**
- `' '` (space) - Initial/whitespace state
- `'a'` - Alphanumeric word state
- `'c'` - Punctuation character state  
- Quote characters (`'"` or `'`) - Inside quoted strings
- Escape characters - Processing escaped sequences

**Character Classifications:**
- `wordchars` - Basic alphanumeric plus extended Unicode in POSIX mode
- `punctuation_chars` - Configurable operators like `();<>|&`
- `whitespace`, `quotes`, `escape`, `commenters` - Syntax elements

**Advanced Features:**
- File inclusion via `source` attribute and `sourcehook`
- Pushback queues for lookahead (`pushback`, `_pushback_chars`)
- Line number tracking for error reporting
- Debug levels 0-3 for tokenization tracing
- POSIX vs non-POSIX quote/escape handling differences

## Dependencies
- `collections.deque` for efficient queue operations
- `io.StringIO` for string-based input streams
- `re` for unsafe character detection in `quote()`
- `os` for path operations in file inclusion

## Usage Patterns
Typically used as `shlex.split(command_string)` for simple tokenization or instantiated as `shlex(input_stream)` for advanced parsing with custom configuration. The lexer handles complex shell syntax including nested quotes, escape sequences, and comment stripping.
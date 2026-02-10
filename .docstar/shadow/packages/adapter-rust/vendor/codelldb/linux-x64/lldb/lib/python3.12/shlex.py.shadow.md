# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/shlex.py
@source-hash: f927227de5ba5b1b
@generated: 2026-02-09T18:10:03Z

## Purpose
This is a lexical analyzer for shell-like command line syntaxes, providing tokenization and parsing capabilities similar to Unix shell command processing. It's a vendored Python standard library module included in the CodeLLDB adapter.

## Core Classes

### shlex (L19-304)
Main lexical analyzer class that tokenizes shell-like input streams. Supports both POSIX and non-POSIX modes, quote handling, escape sequences, and punctuation character recognition.

**Key initialization parameters (L21-22):**
- `instream`: Input source (string, file-like object, or None for stdin)
- `posix`: Boolean for POSIX compliance mode
- `punctuation_chars`: Characters to treat as punctuation tokens

**Critical state attributes:**
- `state` (L47): Current parser state (' ', 'a', 'c', or quote character)
- `token` (L51): Current token being built
- `pushback` (L48): Token pushback queue for lookahead
- `filestack` (L52): Stack for nested file inclusion

**Key methods:**
- `get_token()` (L101-131): Main tokenization method with inclusion and EOF handling
- `read_token()` (L133-277): Core state machine for character-by-character parsing
- `push_token()` (L72-76): Push token back for re-reading
- `push_source()/pop_source()` (L78-99): File inclusion stack management

## Utility Functions

### split() (L305-313)
Convenience function that creates a shlex instance and returns all tokens as a list. Commonly used for simple command line parsing.

### quote() (L323-332)
Escapes strings for safe shell usage using single quotes with embedded quote handling.

### join() (L316-318)
Joins a list of arguments into a shell-safe command string by quoting each argument.

## Key Features

**Character Classification:**
- `wordchars` (L37-41): Alphanumeric plus Unicode letters in POSIX mode
- `whitespace` (L42): Standard whitespace characters
- `quotes` (L44): Single and double quotes
- `escape` (L45): Backslash escape character
- `punctuation_chars` (L54-66): Configurable punctuation for advanced parsing

**Parsing Modes:**
- POSIX mode: More strict quote and escape handling
- Punctuation mode: Treats specified characters as separate tokens
- Whitespace splitting: Splits only on whitespace, not shell metacharacters

**State Machine States:**
- `' '`: Initial/whitespace state
- `'a'`: Alphanumeric word state  
- `'c'`: Punctuation character state
- Quote characters: Inside quoted strings
- Escape characters: Processing escape sequences

## Dependencies
- `collections.deque` for efficient queue operations
- `io.StringIO` for string stream handling
- `re` for unsafe character detection in quote()
- `os` for path operations in file inclusion

## Architecture Notes
The lexer implements a character-by-character state machine with pushback capabilities. File inclusion is supported through a stack-based approach. The design allows for both simple string splitting and complex shell-like parsing with proper quote and escape handling.

## Debug Support
Built-in debug levels (0-3) provide increasing verbosity of tokenization process, useful for understanding parsing behavior.
# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/shlex.py
@source-hash: f927227de5ba5b1b
@generated: 2026-02-09T18:09:05Z

## Purpose
A lexical analyzer for shell-like syntaxes that tokenizes input strings according to shell parsing rules. Supports POSIX compliance, quoted strings, escape sequences, comments, and file inclusion.

## Core Classes

**shlex (L19-303)**: Main lexical analyzer class implementing a finite state machine for tokenization.

### Key Attributes
- `posix` (L31): Boolean flag enabling POSIX-compliant parsing mode
- `wordchars` (L37): Characters considered part of word tokens
- `quotes` (L44): Quote characters (single and double quotes)
- `escape` (L45): Escape character (backslash)
- `punctuation_chars` (L58): Punctuation characters to treat as separate tokens
- `state` (L47): Current parser state (' ', 'a', 'c', or quote character)
- `token` (L51): Currently accumulating token string

### Core Methods
- `__init__()` (L21-66): Configures tokenizer with customizable character sets and POSIX mode
- `get_token()` (L101-131): Main tokenization entry point, handles pushback queue and file inclusion
- `read_token()` (L133-277): Core state machine implementing shell tokenization logic
- `push_token()` (L72-76): Pushes token back onto stack for lookahead
- `push_source()/pop_source()` (L78-99): File inclusion stack management

## Module Functions

**split()** (L305-313): High-level function to split shell command strings into token lists
**join()** (L316-318): Inverse of split - joins tokens into properly quoted shell string
**quote()** (L323-332): Escapes individual strings for safe shell usage

## State Machine Logic
The parser operates as a finite state machine with states:
- `' '`: Whitespace state (initial)
- `'a'`: Alphanumeric token accumulation
- `'c'`: Punctuation token accumulation
- Quote chars: Inside quoted string

## Architecture Patterns
- Uses deque for efficient pushback queues (L48, L52, L61)
- Supports nested file inclusion via stack-based source management
- Iterator protocol implementation for token streaming
- Configurable character sets for different shell dialects

## Dependencies
- `collections.deque`: Token pushback and file stack management
- `io.StringIO`: String-based input stream handling
- `re`: Unsafe character detection for quoting

## Critical Invariants
- Token accumulation is reset after each token emission
- File inclusion maintains proper stack discipline
- POSIX mode affects quote handling and character sets
- Punctuation chars are mutually exclusive with word chars
# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/textwrap.py
@source-hash: 62867e40cdea6669
@generated: 2026-02-09T18:07:32Z

## Text Wrapping and Filling Module

**Purpose**: Python standard library module providing comprehensive text wrapping, filling, and formatting utilities for console/terminal output with configurable line width and formatting options.

### Core Classes

**TextWrapper (L17-369)**: Main class for text wrapping operations with extensive configuration options.
- **Constructor (L112-137)**: Accepts 13 parameters controlling wrapping behavior (width=70, indentation, tab handling, word breaking, etc.)
- **Public Methods**:
  - `wrap(text)` (L347-359): Returns list of wrapped lines
  - `fill(text)` (L361-368): Returns single string with newlines
- **Private Methods**:
  - `_munge_whitespace(text)` (L143-154): Normalizes whitespace and expands tabs
  - `_split(text)` (L157-177): Splits text into wrappable chunks using regex
  - `_fix_sentence_endings(chunks)` (L179-195): Ensures double spaces after sentences
  - `_handle_long_word()` (L197-236): Handles words longer than line width
  - `_wrap_chunks(chunks)` (L238-339): Core wrapping algorithm with line assembly logic

### Key Regular Expressions

- `wordsep_re` (L78-95): Complex regex for intelligent word splitting with hyphen handling
- `wordsep_simple_re` (L102): Simple whitespace-based splitting
- `sentence_end_re` (L107-110): Detects sentence endings for double-space insertion
- `_whitespace_only_re` (L416): Matches whitespace-only lines for dedent
- `_leading_whitespace_re` (L417): Captures leading whitespace for dedent

### Convenience Functions

- `wrap(text, width=70, **kwargs)` (L373-384): Functional interface to TextWrapper.wrap()
- `fill(text, width=70, **kwargs)` (L386-396): Functional interface to TextWrapper.fill()
- `shorten(text, width, **kwargs)` (L398-411): Truncates text to fit width with placeholder
- `dedent(text)` (L419-467): Removes common leading whitespace from multi-line strings
- `indent(text, prefix, predicate=None)` (L470-485): Adds prefix to selected lines

### Configuration Options

TextWrapper supports extensive customization:
- Line width and indentation control (width, initial_indent, subsequent_indent)
- Whitespace handling (expand_tabs, replace_whitespace, tabsize)
- Word breaking behavior (break_long_words, break_on_hyphens)  
- Sentence formatting (fix_sentence_endings)
- Truncation support (max_lines, placeholder)

### Architectural Patterns

- **Strategy Pattern**: Configurable behavior through instance attributes
- **Template Method**: Public methods delegate to private customizable methods
- **Regex-based Parsing**: Uses pre-compiled regex patterns for efficient text splitting
- **Chunk-based Processing**: Breaks text into manageable pieces for flexible manipulation

### Dependencies

- `re` module for regex operations
- No external dependencies - pure Python standard library

### Critical Invariants

- Width must be > 0 (validated in _wrap_chunks)
- Placeholder size must fit within max_lines constraint
- Whitespace normalization preserves text content while standardizing formatting
- Chunk order maintained throughout processing pipeline
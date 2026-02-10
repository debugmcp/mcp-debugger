# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/textwrap.py
@source-hash: 62867e40cdea6669
@generated: 2026-02-09T18:08:16Z

## Text Wrapping and Formatting Module

**Primary Purpose**: Standard Python library module providing text wrapping, filling, and indentation utilities. Core functionality centers around breaking text into lines of specified width while preserving word boundaries and handling various formatting options.

### Key Classes

**TextWrapper (L17-369)**: Main text wrapping engine with comprehensive configuration options
- **Constructor (L112-137)**: Accepts 12 configuration parameters controlling wrapping behavior
- **Key attributes**: width (70), initial_indent (""), subsequent_indent (""), expand_tabs (True), replace_whitespace (True), fix_sentence_endings (False), break_long_words (True), drop_whitespace (True), break_on_hyphens (True), tabsize (8), max_lines (None), placeholder (' [...]')

### Core Processing Methods

**_munge_whitespace (L143-154)**: Normalizes whitespace by expanding tabs and converting all whitespace to spaces
**_split (L157-177)**: Breaks text into word-wrappable chunks using regex patterns, with different behavior based on break_on_hyphens setting
**_fix_sentence_endings (L179-195)**: Ensures sentence-ending punctuation is followed by two spaces when fix_sentence_endings is True
**_handle_long_word (L197-236)**: Manages words longer than line width, either breaking them or preserving intact based on break_long_words setting
**_wrap_chunks (L238-339)**: Core wrapping algorithm that assembles chunks into lines, handling indentation, max_lines truncation, and placeholder insertion

### Public Interface Methods

**wrap (L347-359)**: Returns list of wrapped lines from input text
**fill (L361-368)**: Returns single string with newline-joined wrapped lines

### Regex Patterns

**wordsep_re (L78-95)**: Complex regex for sophisticated word boundary detection with hyphen handling
**wordsep_simple_re (L102)**: Simple whitespace-based splitting
**sentence_end_re (L107-110)**: Detects sentence endings for spacing correction

### Convenience Functions

**wrap (L373-384)**: Module-level function creating TextWrapper instance for single-use wrapping
**fill (L386-396)**: Module-level function for single-use filling
**shorten (L398-411)**: Collapses whitespace and truncates text to fit width, using max_lines=1
**dedent (L419-467)**: Removes common leading whitespace from all lines using regex patterns
**indent (L470-485)**: Adds prefix to selected lines based on predicate function

### Key Dependencies

- `re` module for regex pattern matching
- Uses hardcoded US-ASCII whitespace characters (`_whitespace` L15) to avoid Unicode non-breaking space issues

### Important Constraints

- Width must be > 0 (validated in _wrap_chunks)
- Placeholder size validated against max width when max_lines is set
- Assumes US-ASCII character set for sentence ending detection (L105-106 comment)
- Regex patterns optimized for English text processing

### Architectural Patterns

- Template method pattern: public methods delegate to private methods that can be overridden
- Strategy pattern: Different regex patterns used based on break_on_hyphens setting
- Immutable configuration: All settings passed at construction time
# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/textwrap.py
@source-hash: 62867e40cdea6669
@generated: 2026-02-09T18:10:10Z

## Text Wrapping and Formatting Module

**Primary Purpose**: Provides comprehensive text wrapping, filling, indentation, and formatting utilities for processing and reformatting text strings.

### Core Components

**TextWrapper Class (L17-369)**
- Main text wrapping engine with configurable formatting options
- Key attributes control wrapping behavior: width (70), initial_indent, subsequent_indent, expand_tabs, replace_whitespace, fix_sentence_endings, break_long_words, break_on_hyphens, drop_whitespace, max_lines, placeholder
- Uses sophisticated regex patterns for text chunking and word boundary detection

**Key Methods**:
- `__init__` (L112-137): Initializes wrapper with formatting parameters
- `wrap(text)` (L347-359): Returns list of wrapped lines
- `fill(text)` (L361-368): Returns single string with newline-joined wrapped text
- `_wrap_chunks(chunks)` (L238-339): Core wrapping algorithm handling line breaks, long words, and truncation
- `_split(text)` (L157-177): Splits text into wrappable chunks using regex patterns
- `_handle_long_word` (L197-236): Handles words longer than line width
- `_munge_whitespace` (L143-154): Normalizes whitespace and expands tabs

**Regex Patterns**:
- `wordsep_re` (L78-95): Complex pattern for hyphen-aware word splitting
- `wordsep_simple_re` (L102): Simple whitespace-based splitting
- `sentence_end_re` (L107-110): Detects sentence endings for spacing fixes

### Convenience Functions

- `wrap(text, width=70, **kwargs)` (L373-384): Standalone wrapper function
- `fill(text, width=70, **kwargs)` (L386-396): Standalone fill function  
- `shorten(text, width, **kwargs)` (L398-411): Truncates text with placeholder
- `dedent(text)` (L419-467): Removes common leading whitespace from all lines
- `indent(text, prefix, predicate=None)` (L470-485): Adds prefix to selected lines

### Dependencies
- `re` module for regex operations
- Built-in string methods (expandtabs, translate, split, etc.)

### Key Constants
- `_whitespace` (L15): US-ASCII whitespace characters definition
- `unicode_whitespace_trans` (L66): Translation table for whitespace normalization
- `_whitespace_only_re`, `_leading_whitespace_re` (L416-417): Regex patterns for dedent functionality

### Architectural Notes
- Designed for extensibility through method overriding in subclasses
- Uses chunk-based processing for efficient text manipulation
- Handles edge cases like long words, sentence spacing, and text truncation
- Supports both simple and complex word boundary detection modes
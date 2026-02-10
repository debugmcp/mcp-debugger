# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/textwrap.py
@source-hash: 62867e40cdea6669
@generated: 2026-02-09T18:13:20Z

## TextWrapper Text Wrapping and Formatting Library

**Primary Purpose:** Provides intelligent text wrapping, filling, and indentation utilities for formatting text within specified column widths. This is a Python standard library module for text processing.

**Key Classes and Functions:**

### TextWrapper Class (L17-369)
Core text wrapping engine with extensive configuration options:
- `__init__` (L112-137): Configures wrapping behavior with 11+ parameters including width (70), indentation, tab expansion, word breaking, sentence fixing
- `wrap()` (L347-359): Main public method returning list of wrapped lines
- `fill()` (L361-368): Returns single string with newlines joining wrapped lines
- `_wrap_chunks()` (L238-339): Core wrapping algorithm handling line building, long words, truncation
- `_split()` (L157-177): Splits text into word/whitespace chunks using regex patterns
- `_handle_long_word()` (L197-236): Manages words longer than line width
- `_munge_whitespace()` (L143-154): Normalizes whitespace and tab expansion
- `_fix_sentence_endings()` (L179-195): Ensures double spaces after sentence punctuation

**Regex Patterns:**
- `wordsep_re` (L78-95): Complex regex for intelligent word/hyphen splitting
- `wordsep_simple_re` (L102): Simple whitespace-based splitting
- `sentence_end_re` (L107-110): Detects sentence endings for spacing fixes

### Convenience Functions (L373-411)
- `wrap(text, width=70, **kwargs)` (L373-384): Functional interface to TextWrapper.wrap()
- `fill(text, width=70, **kwargs)` (L386-396): Functional interface to TextWrapper.fill()  
- `shorten(text, width, **kwargs)` (L398-411): Collapses and truncates text to fit width

### Utility Functions (L419-485)
- `dedent(text)` (L419-467): Removes common leading whitespace from all lines
- `indent(text, prefix, predicate=None)` (L470-485): Adds prefix to selected lines

**Critical Constants:**
- `_whitespace` (L15): Hardcoded ASCII whitespace chars to avoid Unicode non-breaking spaces
- `unicode_whitespace_trans` (L66): Translation table for whitespace normalization

**Architecture Notes:**
- Uses chunk-based processing for efficient word boundary detection
- Supports hyphenated word breaking with sophisticated regex patterns
- Handles edge cases like long words, sentence spacing, truncation with placeholders
- Configurable through extensive instance attributes rather than method parameters

**Key Dependencies:**
- `re` module for regex pattern matching
- No external dependencies beyond Python standard library

**Usage Patterns:**
- Object-oriented: Create TextWrapper instance with desired settings, call wrap()/fill()
- Functional: Use module-level wrap(), fill(), shorten() for simple cases
- Utility: Use dedent()/indent() for code formatting and indentation management
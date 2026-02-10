# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/textwrap.py
@source-hash: 62867e40cdea6669
@generated: 2026-02-09T18:09:18Z

## Purpose
Python standard library module for text wrapping, filling, and formatting. Provides sophisticated text manipulation including word wrapping, indentation handling, and whitespace normalization.

## Core Components

**TextWrapper class (L17-368)**: Main text wrapping engine with extensive configuration options:
- Constructor (L112-137): Accepts 13 parameters controlling wrapping behavior including width, indentation, tab handling, word breaking, and line truncation
- Key attributes: width=70, break_long_words=True, drop_whitespace=True, max_lines=None, placeholder=' [...]'

**Primary wrapping algorithm**:
- `_split()` (L157-177): Tokenizes text into wrappable chunks using complex regex patterns
- `_wrap_chunks()` (L238-339): Core line-wrapping logic handling width constraints, indentation, and long words
- `_handle_long_word()` (L197-236): Manages words exceeding line width with optional breaking

**Text preprocessing methods**:
- `_munge_whitespace()` (L143-154): Normalizes whitespace (tab expansion, space conversion)
- `_fix_sentence_endings()` (L179-195): Ensures proper spacing after sentence-ending punctuation

**Public interface**:
- `wrap()` (L347-359): Returns list of wrapped lines
- `fill()` (L361-368): Returns single string with newline-joined wrapped text

## Regex Patterns
- `wordsep_re` (L78-95): Complex pattern for intelligent word/hyphen boundary detection
- `wordsep_simple_re` (L102): Simple whitespace-based splitting fallback
- `sentence_end_re` (L107-110): Detects sentence endings for spacing correction

## Convenience Functions
- `wrap()` (L373-384): Standalone function wrapping TextWrapper.wrap()
- `fill()` (L386-396): Standalone function wrapping TextWrapper.fill() 
- `shorten()` (L398-411): Truncates text to width with placeholder
- `dedent()` (L419-467): Removes common leading whitespace from multi-line strings
- `indent()` (L470-485): Adds prefix to selected lines

## Key Dependencies
- `re` module for regex operations
- Hardcoded US-ASCII whitespace definition (L15): `\t\n\x0b\x0c\r `

## Architectural Notes
- Uses reverse-order chunk processing for efficient stack operations (L264)
- Supports hyphen-aware word breaking with configurable behavior
- Implements placeholder-based truncation for max_lines constraint
- Unicode whitespace translation table for normalization (L66)
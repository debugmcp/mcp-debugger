# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/html/__init__.py
@source-hash: 923d82d821e75e8d
@generated: 2026-02-09T18:10:59Z

## Purpose
HTML manipulation utilities providing character escaping and unescaping functionality, implementing HTML5 standard compliance for character reference processing.

## Public API
- **escape(s, quote=True)** (L12-25): Converts HTML special characters (&, <, >, and optionally quotes) to safe HTML entities. Processes ampersands first to prevent double-encoding.
- **unescape(s)** (L122-132): Converts HTML character references (named and numeric) back to Unicode characters using HTML5 standard rules.

## Core Components
- **_invalid_charrefs** (L30-65): Mapping table for invalid numeric character references to their replacement characters, handling Windows-1252 encoding issues and control characters.
- **_invalid_codepoints** (L67-88): Set of Unicode codepoints that are invalid in HTML5, including control characters, surrogates, and noncharacters.
- **_replace_charref(s)** (L91-115): Internal function processing individual character references, handling both numeric (decimal/hex) and named entities with fallback logic.
- **_charref** (L118-120): Compiled regex pattern matching HTML character references in all valid formats.

## Dependencies
- `re` module for regex operations
- `html.entities.html5` for named character entity mappings

## Key Behavior
- Escape function processes ampersands first to prevent cascading entity creation
- Unescape function uses early return optimization when no ampersands present
- Invalid codepoints return empty string rather than replacement character
- Implements longest-match strategy for partial named entity matches
- Handles malformed numeric references with appropriate fallbacks

## Standards Compliance
Implements HTML5 specification for numeric character reference parsing, including handling of invalid codepoints and Windows-1252 compatibility mappings.